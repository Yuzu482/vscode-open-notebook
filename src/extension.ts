import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as api from './api';
import { ONContentProvider, NotebookTreeProvider } from './treeView';
import { ChatPanel } from './chatPanel';
import { t, setLanguage, getLanguage, SUPPORTED_LANGS, PROVIDERS } from './i18n';
import { getConfig, checkDocker, checkAPI, startDocker, sleep } from './setup';

export function activate(context: vscode.ExtensionContext) {

    // ---- 初始化语言 ----
    const config = getConfig();
    setLanguage(config.language);
    vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('openNotebook.language')) {
            setLanguage(getConfig().language);
        }
    });

    const API = () => getConfig().apiUrl;
    const apiUrl = () => API().endsWith('/api') ? API() : `${API()}/api`;
    const baseUrl = () => API().replace(/\/api$/, '');  // health check uses base URL

    // ---- 虚拟文档 ----
    const contentProvider = new ONContentProvider();
    context.subscriptions.push(
        vscode.workspace.registerTextDocumentContentProvider('opennotebook', contentProvider)
    );

    // ---- 侧边栏 ----
    const tree = new NotebookTreeProvider();
    context.subscriptions.push(
        vscode.window.createTreeView('onNotebooks', { treeDataProvider: tree, showCollapseAll: true })
    );

    // ---- 聊天输出 ----
    const chatChannel = vscode.window.createOutputChannel('Open Notebook Chat', { log: true });
    context.subscriptions.push(chatChannel);

    // ---- 状态栏 ----
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBar.command = 'on.refresh';
    context.subscriptions.push(statusBar);
    async function updateStatus() {
        const ok = await checkAPI(apiUrl());
        statusBar.text = ok ? `$(notebook) ${t('status.connected')}` : `$(warning) ${t('status.offline')}`;
        statusBar.tooltip = ok ? t('status.tooltip.on') : t('status.tooltip.off');
        statusBar.show();
    }
    // 首次连接带重试（Docker 可能还没完全启动）
    async function initStatus() {
        for (let i = 0; i < 10; i++) {
            const ok = await checkAPI(apiUrl());
            if (ok) { break; }
            await sleep(3000);
        }
        updateStatus();
    }
    initStatus();
    const si = setInterval(updateStatus, 30000);
    context.subscriptions.push({ dispose: () => clearInterval(si) });

    // ================================================================
    //  COMMANDS
    // ================================================================

    context.subscriptions.push(
        vscode.commands.registerCommand('on.refresh', () => tree.refresh())
    );

    // ---- 环境检测 + 自动构建 ----
    context.subscriptions.push(
        vscode.commands.registerCommand('on.checkEnv', async () => {
            const steps: string[] = [];
            const add = (s: string) => { steps.push(s); chatChannel.appendLine(s); };
            chatChannel.clear();
            chatChannel.show(true);
            add('🔍 Open Notebook 环境检测');
            add('═══════════════════════');

            // Docker
            const dockerOk = await checkDocker();
            add(dockerOk ? `✅ ${t('setup.dockerOk')}` : `❌ ${t('setup.dockerCheck')}`);

            // API
            const apiOk = await checkAPI(apiUrl());
            add(apiOk ? `✅ ${t('setup.apiCheck')}` : `⚠️ ${t('setup.apiFail')}`);

            if (!apiOk && dockerOk && config.dockerComposePath) {
                add(`🔄 ${t('setup.starting')}`);
                const started = await startDocker(config.dockerComposePath);
                if (started) {
                    await sleep(5000);
                    const retry = await checkAPI(apiUrl());
                    add(retry ? `✅ ${t('setup.started')}` : '❌ 启动超时');
                } else {
                    add('❌ 启动失败');
                }
            }

            if (!apiOk && !config.dockerComposePath) {
                const pick = await vscode.window.showOpenDialog({
                    canSelectFolders: true, openLabel: '选择 docker-compose.yml 所在目录',
                    title: '请选择 Open Notebook 项目目录'
                });
                if (pick?.length) {
                    await vscode.workspace.getConfiguration('openNotebook').update(
                        'dockerComposePath', pick[0].fsPath, vscode.ConfigurationTarget.Global
                    );
                    add('✅ 路径已保存，请重新运行检测');
                }
            }

            add(`\n${t('setup.complete')}`);
            updateStatus();
        })
    );

    // ---- 语言切换 ----
    context.subscriptions.push(
        vscode.commands.registerCommand('on.switchLang', async () => {
            const pick = await vscode.window.showQuickPick(SUPPORTED_LANGS, {
                title: 'Language / 语言', placeHolder: `当前: ${getLanguage() === 'zh-cn' ? '中文' : 'English'}`
            });
            if (pick) {
                await vscode.workspace.getConfiguration('openNotebook').update(
                    'language', pick.value, vscode.ConfigurationTarget.Global
                );
                setLanguage(pick.value);
                tree.refresh();
                updateStatus();
                vscode.window.showInformationMessage(
                    pick.value === 'zh-cn' ? '✅ 已切换为中文' : '✅ Switched to English'
                );
            }
        })
    );

    // ---- 新建笔记本 ----
    context.subscriptions.push(
        vscode.commands.registerCommand('on.createNotebook', async () => {
            const name = await vscode.window.showInputBox({
                title: t('notebook.create.title'), prompt: t('notebook.create.prompt'),
                placeHolder: t('notebook.create.placeholder'),
                validateInput: v => v ? undefined : t('notebook.create.validate')
            });
            if (!name) { return; }
            const desc = await vscode.window.showInputBox({
                title: t('notebook.create.title'), prompt: t('notebook.create.desc'),
                placeHolder: t('notebook.create.descPlaceholder')
            });
            try {
                await api.createNotebook(name, desc || '');
                tree.refresh();
                vscode.window.showInformationMessage(t('notebook.create.success', name));
            } catch (e: any) { vscode.window.showErrorMessage(t('notebook.create.error', e.message)); }
        })
    );

    // ---- 删除笔记本 ----
    context.subscriptions.push(
        vscode.commands.registerCommand('on.deleteNotebook', async (node: any) => {
            if (!node?.nb) { return; }
            const answer = await vscode.window.showWarningMessage(
                t('notebook.delete.confirm', node.nb.name), { modal: true }, t('notebook.delete.btn')
            );
            if (answer !== t('notebook.delete.btn')) { return; }
            try {
                await api.deleteNotebook(node.nb.id);
                tree.refresh();
                vscode.window.showInformationMessage(t('notebook.delete.success'));
            } catch (e: any) { vscode.window.showErrorMessage(t('notebook.delete.error', e.message)); }
        })
    );

    // ---- 打开笔记本 ----
    context.subscriptions.push(
        vscode.commands.registerCommand('on.openNotebook', async (node: any) => {
            if (!node?.nb) { return; }
            const nb = node.nb;
            const actions = [t('notebook.open.viewSources'), t('notebook.open.viewNotes'), t('notebook.open.chat'), t('notebook.open.addSource'), t('notebook.open.addNote')];
            const action = await vscode.window.showQuickPick(actions, {
                title: `📓 ${nb.name}`, placeHolder: t('notebook.open.title')
            });
            if (!action) { return; }

            if (action === actions[0]) {
                const sources = await api.listSources(nb.id);
                if (!sources.length) { vscode.window.showInformationMessage(t('source.none')); return; }
                const pick = await vscode.window.showQuickPick(
                    sources.map(s => ({ label: s.title || s.id, detail: s.content_type, source: s })),
                    { title: t('source.listTitle'), placeHolder: t('source.select') }
                );
                if (pick) { openDoc('source', pick.source.id, pick.source.title || 'Source'); }
            }
            if (action === actions[1]) {
                const notes = await api.listNotes(nb.id);
                if (!notes.length) { vscode.window.showInformationMessage(t('note.none')); return; }
                const pick = await vscode.window.showQuickPick(
                    notes.map(n => ({ label: n.title || 'Untitled', detail: (n.content || '').slice(0, 80), note: n })),
                    { title: t('note.listTitle'), placeHolder: t('note.select') }
                );
                if (pick) { openDoc('note', pick.note.id, pick.note.title || 'Note'); }
            }
            if (action === actions[2]) { vscode.commands.executeCommand('on.openChat', node); }
            if (action === actions[3]) { vscode.commands.executeCommand('on.createSource', node); }
            if (action === actions[4]) { vscode.commands.executeCommand('on.createNote', node); }
        })
    );

    // ---- 打开资料/笔记 ----
    context.subscriptions.push(
        vscode.commands.registerCommand('on.openSource', (s: api.Source) => openDoc('source', s.id, s.title || 'Source')),
        vscode.commands.registerCommand('on.openNote', (n: api.Note) => openDoc('note', n.id, n.title || 'Note'))
    );

    // ---- 添加资料 ----
    context.subscriptions.push(
        vscode.commands.registerCommand('on.createSource', async (node: any) => {
            if (!node?.nb) { return; }
            const type = await vscode.window.showQuickPick(
                [t('source.add.url'), t('source.add.text')],
                { title: t('source.add.title', node.nb.name), placeHolder: t('source.add.type') }
            );
            if (!type) { return; }
            const isUrl = type === t('source.add.url');

            if (isUrl) {
                const url = await vscode.window.showInputBox({
                    title: t('source.add.urlTitle'), prompt: t('source.add.urlPrompt'),
                    placeHolder: t('source.add.urlPlaceholder'),
                    validateInput: v => v ? undefined : t('source.add.urlValidate')
                });
                if (!url) { return; }
                const title = await vscode.window.showInputBox({
                    title: t('source.add.titleLabel'), placeHolder: t('source.add.titlePlaceholder')
                });
                try {
                    await fetch(`${apiUrl()}/sources`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ notebook_id: node.nb.id, type: 'url', url, title }),
                    });
                    tree.refresh();
                    vscode.window.showInformationMessage(`✅ ${t('source.add.success')}`);
                } catch (e: any) { vscode.window.showErrorMessage(t('source.add.error', e.message)); }
            } else {
                const title = await vscode.window.showInputBox({
                    title: t('source.add.textTitle'), placeHolder: t('source.add.textPlaceholder'),
                    validateInput: v => v ? undefined : t('notebook.create.validate')
                });
                if (!title) { return; }
                const content = await vscode.window.showInputBox({
                    title: t('source.add.textContent'), prompt: t('source.add.textContentPrompt'),
                    validateInput: v => v ? undefined : t('source.add.textContentValidate')
                });
                if (!content) { return; }
                try {
                    await fetch(`${apiUrl()}/sources`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ notebook_id: node.nb.id, type: 'text', title, content }),
                    });
                    tree.refresh();
                    vscode.window.showInformationMessage(`✅ ${t('source.add.success')}`);
                } catch (e: any) { vscode.window.showErrorMessage(t('source.add.error', e.message)); }
            }
        })
    );

    // ---- 添加笔记 ----
    context.subscriptions.push(
        vscode.commands.registerCommand('on.createNote', async (node: any) => {
            if (!node?.nb) { return; }
            const title = await vscode.window.showInputBox({
                title: t('note.create.title', node.nb.name), prompt: t('note.create.prompt'),
                placeHolder: t('note.create.placeholder'),
                validateInput: v => v ? undefined : t('note.create.validate')
            });
            if (!title) { return; }
            const content = await vscode.window.showInputBox({
                title: t('note.create.content'), prompt: t('note.create.contentPrompt')
            });
            if (!content) { return; }
            try {
                await api.createNote(node.nb.id, title, content);
                tree.refresh();
                vscode.window.showInformationMessage(`✅ ${t('note.create.success')}`);
            } catch (e: any) { vscode.window.showErrorMessage(t('note.create.error', e.message)); }
        })
    );

    // ---- 对话（ChatPanel Webview） ----
    context.subscriptions.push(
        vscode.commands.registerCommand('on.openChat', async (node: any) => {
            if (!node?.nb) { return; }
            await ChatPanel.createOrShow(node.nb.id, node.nb.name);
        })
    );

    // ---- 全局 AI 分析（ChatPanel Webview） ----
    context.subscriptions.push(
        vscode.commands.registerCommand('on.askAI', async () => {
            await ChatPanel.createGlobal();
        })
    );

    // ---- 搜索 ----
    context.subscriptions.push(
        vscode.commands.registerCommand('on.search', async () => {
            const query = await vscode.window.showInputBox({
                title: t('search.title'), prompt: t('search.prompt'), placeHolder: t('search.placeholder'),
            });
            if (!query) { return; }
            const busy = vscode.window.createQuickPick();
            busy.placeholder = t('search.searching'); busy.busy = true; busy.show();

            try {
                const res = await fetch(`${apiUrl()}/search`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query, search_type: 'text' }),
                });
                const data: any = await res.json();
                busy.hide();
                const results: any[] = data.results || [];
                if (!results.length) { vscode.window.showInformationMessage(t('search.noResults')); return; }

                const pick = await vscode.window.showQuickPick(
                    results.map((r: any) => ({
                        label: r.title || r.name || '(untitled)',
                        detail: (r.content || JSON.stringify(r)).slice(0, 120), result: r,
                    })),
                    { title: `🔍 "${query}"`, placeHolder: t('search.results', results.length), matchOnDetail: true }
                );
                if (pick) {
                    chatChannel.clear(); chatChannel.show(true);
                    chatChannel.appendLine(`🔍 "${query}"\n📌 ${pick.label}\n──────────────────────────\n${pick.detail || ''}`);
                }
            } catch (e: any) {
                busy.hide();
                vscode.window.showErrorMessage(t('search.failed', e.message));
            }
        })
    );

    // ---- 配置 AI ----
    context.subscriptions.push(
        vscode.commands.registerCommand('on.configureAI', async () => {
            const provs = PROVIDERS.map(p => ({
                label: p.label, detail: p.detail, provider: p.provider
            }));
            const provider = await vscode.window.showQuickPick(provs, {
                title: t('ai.config.title'), placeHolder: t('ai.config.placeholder')
            });
            if (!provider) { return; }

            if (provider.provider === 'ollama') {
                const baseUrl = await vscode.window.showInputBox({
                    title: t('ai.config.ollamaTitle'), prompt: t('ai.config.ollamaPrompt'),
                    placeHolder: 'http://localhost:11434', value: 'http://localhost:11434'
                });
                if (!baseUrl) { return; }
                try {
                    const res = await fetch(`${apiUrl()}/credentials`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ provider: 'ollama', name: 'Ollama', api_base: baseUrl, api_key: 'ollama' }),
                    });
                    const cred: any = await res.json();
                    if (cred.id) {
                        await fetch(`${apiUrl()}/credentials/${cred.id}/discover`, { method: 'POST' });
                        await fetch(`${apiUrl()}/credentials/${cred.id}/register-models`, { method: 'POST' });
                        vscode.window.showInformationMessage(`✅ ${t('ai.config.ollamaSuccess')}`);
                    }
                } catch (e: any) { vscode.window.showErrorMessage(t('ai.config.failed', e.message)); }
                return;
            }

            const apiKey = await vscode.window.showInputBox({
                title: provider.label + t('ai.config.apiKeyTitle'), prompt: t('ai.config.apiKeyPrompt'),
                placeHolder: t('ai.config.apiKeyPlaceholder'), password: true,
                validateInput: v => v ? undefined : t('ai.config.apiKeyValidate')
            });
            if (!apiKey) { return; }
            try {
                const res = await fetch(`${apiUrl()}/credentials`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ provider: provider.provider, name: provider.label, api_key: apiKey }),
                });
                const cred: any = await res.json();
                if (cred.id) {
                    vscode.window.showInformationMessage(t('ai.config.discovering', provider.label));
                    await fetch(`${apiUrl()}/credentials/${cred.id}/discover`, { method: 'POST' });
                    const regRes = await fetch(`${apiUrl()}/credentials/${cred.id}/register-models`, { method: 'POST' });
                    const regData: any = await regRes.json();
                    vscode.window.showInformationMessage(`✅ ${t('ai.config.success', provider.label, regData?.registered ?? '?')}`);

                    const setDefault = await vscode.window.showQuickPick(
                        ['是，选择默认模型', '跳过，稍后手动设置'],
                        { title: '要设置默认 AI 模型吗？' }
                    );
                    if (setDefault?.startsWith('是')) { vscode.commands.executeCommand('on.setDefaultModel'); }
                }
            } catch (e: any) { vscode.window.showErrorMessage(t('ai.config.failed', e.message)); }
        })
    );

    // ---- 设置默认模型 ----
    context.subscriptions.push(
        vscode.commands.registerCommand('on.setDefaultModel', async () => {
            try {
                const modelsRes = await fetch(`${apiUrl()}/models`);
                const modelsData: any = await modelsRes.json();
                const models: any[] = modelsData.models || modelsData || [];

                const types = ['chat', 'embedding', 'speech_to_text', 'text_to_speech'];
                for (const type of types) {
                    const typedModels = models.filter((m: any) => m.type === type || m.model_type === type);
                    if (!typedModels.length) { continue; }
                    const pick = await vscode.window.showQuickPick(
                        typedModels.map((m: any) => ({
                            label: m.name || m.id || m.model,
                            detail: m.provider || '',
                            model: m,
                        })),
                        { title: `选择默认「${type}」模型`, placeHolder: 'Skip 跳过...' }
                    );
                    if (pick) {
                        await fetch(`${apiUrl()}/models/config`, {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ type, model_id: pick.model.id || pick.model.name }),
                        });
                    }
                }
                vscode.window.showInformationMessage('✅ 默认模型已设置');
            } catch (e: any) { vscode.window.showErrorMessage('设置失败: ' + e.message); }
        })
    );

    // ---- 导入当前文件 ----
    context.subscriptions.push(
        vscode.commands.registerCommand('on.importCurrentFile', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) { vscode.window.showWarningMessage(t('import.noFile')); return; }
            const doc = editor.document;
            const fileName = path.basename(doc.fileName);
            const content = doc.getText();
            const nb = await pickNotebook();
            if (!nb) { return; }
            try {
                await fetch(`${apiUrl()}/sources`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ notebook_id: nb.id, type: 'text', title: fileName, content: content.slice(0, 50000) }),
                });
                tree.refresh();
                vscode.window.showInformationMessage(`✅ ${t('import.currentSuccess', fileName, nb.name)}`);
            } catch (e: any) { vscode.window.showErrorMessage(t('import.error', e.message)); }
        })
    );

    // ---- 右键导入文件 ----
    context.subscriptions.push(
        vscode.commands.registerCommand('on.importFile', async (clickedUri: vscode.Uri, selectedUris?: vscode.Uri[]) => {
            const uris = selectedUris?.length ? selectedUris : [clickedUri];
            if (!uris?.length) { return; }
            const nb = await pickNotebook();
            if (!nb) { return; }
            let imported = 0;
            for (const uri of uris) {
                try {
                    const content = fs.readFileSync(uri.fsPath, 'utf-8').slice(0, 50000);
                    await fetch(`${apiUrl()}/sources`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ notebook_id: nb.id, type: 'text', title: path.basename(uri.fsPath), content }),
                    });
                    imported++;
                } catch { /* skip */ }
            }
            tree.refresh();
            vscode.window.showInformationMessage(`✅ ${t('import.batchSuccess', imported, uris.length, nb.name)}`);
        })
    );

    // ---- 编辑器右键导入 ----
    context.subscriptions.push(
        vscode.commands.registerCommand('on.importFileFromEditor', async (uri: vscode.Uri) => {
            vscode.commands.executeCommand('on.importFile', uri, [uri]);
        })
    );

    // ---- 自动检测（首次激活时） ----
    if (config.autoStartDocker) {
        (async () => {
            const apiOk = await checkAPI(apiUrl());
            if (!apiOk && config.dockerComposePath) {
                await startDocker(config.dockerComposePath);
                await sleep(5000);
            }
            updateStatus();
        })();
    }
}

// ---- 辅助 ----

function openDoc(type: string, id: string, title: string) {
    const uri = vscode.Uri.parse(`opennotebook:///${type}/${id}`);
    vscode.workspace.openTextDocument(uri).then(doc => vscode.window.showTextDocument(doc, { preview: true }));
}

async function pickNotebook(): Promise<api.Notebook | null> {
    const nbList = await api.listNotebooks();
    if (!nbList.length) { vscode.window.showWarningMessage(t('import.noNb')); return null; }
    const pick = await vscode.window.showQuickPick(
        nbList.map(n => ({ label: n.name, notebook: n })),
        { title: t('import.selectNb'), placeHolder: t('import.selectNb') }
    );
    return pick?.notebook || null;
}

export function deactivate() { }
