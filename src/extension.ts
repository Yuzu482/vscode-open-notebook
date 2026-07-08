import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as api from './api';
import { ONContentProvider, NotebookTreeProvider } from './treeView';
import { ChatPanel } from './chatPanel';
import { t, setLanguage, getLanguage, SUPPORTED_LANGS, PROVIDERS } from './i18n';
import { getConfig, checkDocker, checkAPI, startDocker, sleep } from './setup';

export function activate(context: vscode.ExtensionContext) {

    const config = getConfig();
    setLanguage(config.language);
    vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('openNotebook.language')) setLanguage(getConfig().language);
    });

    const apiUrl = () => {
        const u = getConfig().apiUrl;
        return u.endsWith('/api') ? u : `${u}/api`;
    };
    const baseUrl = () => getConfig().apiUrl.replace(/\/api$/, '');

    // Virtual docs
    const cp = new ONContentProvider();
    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider('opennotebook', cp));

    // Tree
    const tree = new NotebookTreeProvider();
    context.subscriptions.push(vscode.window.createTreeView('onNotebooks', { treeDataProvider: tree }));

    // Output channel
    const out = vscode.window.createOutputChannel('Open Notebook', { log: true });
    context.subscriptions.push(out);

    // Status bar - connection
    const sbConn = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    sbConn.command = 'on.refresh'; context.subscriptions.push(sbConn);

    // Status bar - BIG CHAT BUTTON
    const sbChat = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
    sbChat.text = '$(comment-discussion) 💬 AI 对话';
    sbChat.tooltip = '点击开始 AI 对话（搜索所有笔记本的资料和笔记）';
    sbChat.command = 'on.askAI';
    sbChat.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    sbChat.show();
    context.subscriptions.push(sbChat);

    async function updateConn() {
        const ok = await checkAPI(baseUrl());
        sbConn.text = ok ? '$(notebook) ON' : '$(warning) ON(offline)';
        sbConn.tooltip = ok ? 'Connected' : 'Cannot reach API';
        sbConn.show();
    }
    // Retry on startup
    (async () => { for (let i = 0; i < 10; i++) { if (await checkAPI(baseUrl())) break; await sleep(3000); } updateConn(); })();
    const si = setInterval(updateConn, 30000);
    context.subscriptions.push({ dispose: () => clearInterval(si) });

    // ========== COMMANDS ==========

    context.subscriptions.push(vscode.commands.registerCommand('on.refresh', () => tree.refresh()));

    // Environment check
    context.subscriptions.push(vscode.commands.registerCommand('on.checkEnv', async () => {
        out.clear(); out.show(true);
        out.appendLine('🔍 Environment Check');
        const dOk = await checkDocker();
        out.appendLine(dOk ? '✅ Docker running' : '❌ Docker not found');
        const aOk = await checkAPI(baseUrl());
        out.appendLine(aOk ? '✅ API connected' : '⚠️ API unreachable');
        if (!aOk && dOk && config.dockerComposePath) {
            out.appendLine('🔄 Starting services...');
            if (await startDocker(config.dockerComposePath)) { await sleep(5000); out.appendLine(await checkAPI(baseUrl()) ? '✅ Started' : '❌ Timeout'); }
        }
        updateConn();
    }));

    // Language switch
    context.subscriptions.push(vscode.commands.registerCommand('on.switchLang', async () => {
        const p = await vscode.window.showQuickPick(SUPPORTED_LANGS, { title: 'Language', placeHolder: getLanguage() === 'zh-cn' ? '中文' : 'English' });
        if (p) { await vscode.workspace.getConfiguration('openNotebook').update('language', p.value, true); setLanguage(p.value); tree.refresh(); updateConn(); }
    }));

    // Create notebook
    context.subscriptions.push(vscode.commands.registerCommand('on.createNotebook', async () => {
        const n = await vscode.window.showInputBox({ title: t('notebook.create.title'), placeHolder: t('notebook.create.placeholder'), validateInput: v => v ? undefined : 'Required' });
        if (!n) return;
        const d = await vscode.window.showInputBox({ title: t('notebook.create.title'), placeHolder: t('notebook.create.descPlaceholder') });
        try { await api.createNotebook(n, d || ''); tree.refresh(); vscode.window.showInformationMessage(`✅ ${n}`); }
        catch (e: any) { vscode.window.showErrorMessage(e.message); }
    }));

    // Delete notebook
    context.subscriptions.push(vscode.commands.registerCommand('on.deleteNotebook', async (node: any) => {
        if (!node?.nb) return;
        if ('Delete' !== await vscode.window.showWarningMessage(`Delete "${node.nb.name}"?`, { modal: true }, 'Delete')) return;
        try { await api.deleteNotebook(node.nb.id); tree.refresh(); } catch (e: any) { vscode.window.showErrorMessage(e.message); }
    }));

    // Open notebook
    context.subscriptions.push(vscode.commands.registerCommand('on.openNotebook', async (node: any) => {
        if (!node?.nb) return;
        const nb = node.nb;
        const acts = [t('notebook.open.viewSources'), t('notebook.open.viewNotes'), t('notebook.open.chat'), t('notebook.open.addSource'), t('notebook.open.addNote')];
        const a = await vscode.window.showQuickPick(acts, { title: nb.name });
        if (!a) return;
        if (a === acts[0]) { const ss = await api.listSources(nb.id); if (!ss.length) { vscode.window.showInformationMessage(t('source.none')); return; } const p = await vscode.window.showQuickPick(ss.map((s: api.Source) => ({ label: s.title || s.id, detail: s.content_type, source: s })), { title: t('source.listTitle') }); if (p) openDoc('source', p.source.id); }
        if (a === acts[1]) { const ns = await api.listNotes(nb.id); if (!ns.length) { vscode.window.showInformationMessage(t('note.none')); return; } const p = await vscode.window.showQuickPick(ns.map((n: api.Note) => ({ label: n.title || 'Untitled', detail: (n.content || '').slice(0, 80), note: n })), { title: t('note.listTitle') }); if (p) openDoc('note', p.note.id); }
        if (a === acts[2]) { vscode.commands.executeCommand('on.openChat', node); }
        if (a === acts[3]) { vscode.commands.executeCommand('on.createSource', node); }
        if (a === acts[4]) { vscode.commands.executeCommand('on.createNote', node); }
    }));

    context.subscriptions.push(
        vscode.commands.registerCommand('on.openSource', (s: api.Source) => openDoc('source', s.id)),
        vscode.commands.registerCommand('on.openNote', (n: api.Note) => openDoc('note', n.id))
    );

    // Add source
    context.subscriptions.push(vscode.commands.registerCommand('on.createSource', async (node: any) => {
        if (!node?.nb) return;
        const type = await vscode.window.showQuickPick([t('source.add.url'), t('source.add.text')], { title: t('source.add.title', node.nb.name) });
        if (!type) return;
        const isUrl = type === t('source.add.url');
        if (isUrl) {
            const url = await vscode.window.showInputBox({ title: t('source.add.urlTitle'), placeHolder: t('source.add.urlPlaceholder'), validateInput: v => v ? undefined : 'Required' });
            if (!url) return;
            const title = await vscode.window.showInputBox({ title: t('source.add.titleLabel') });
            try { await fetch(`${apiUrl()}/sources`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notebook_id: node.nb.id, type: 'url', url, title }) }); tree.refresh(); vscode.window.showInformationMessage('✅ Added'); }
            catch (e: any) { vscode.window.showErrorMessage(e.message); }
        } else {
            const title = await vscode.window.showInputBox({ title: t('source.add.textTitle'), validateInput: v => v ? undefined : 'Required' });
            if (!title) return;
            const content = await vscode.window.showInputBox({ title: t('source.add.textContent'), validateInput: v => v ? undefined : 'Required' });
            if (!content) return;
            try { await fetch(`${apiUrl()}/sources`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notebook_id: node.nb.id, type: 'text', title, content }) }); tree.refresh(); vscode.window.showInformationMessage('✅ Added'); }
            catch (e: any) { vscode.window.showErrorMessage(e.message); }
        }
    }));

    // Add note
    context.subscriptions.push(vscode.commands.registerCommand('on.createNote', async (node: any) => {
        if (!node?.nb) return;
        const title = await vscode.window.showInputBox({ title: t('note.create.title', node.nb.name), validateInput: v => v ? undefined : 'Required' });
        if (!title) return;
        const content = await vscode.window.showInputBox({ title: t('note.create.content') });
        if (!content) return;
        try { await api.createNote(node.nb.id, title, content); tree.refresh(); vscode.window.showInformationMessage('✅ Created'); }
        catch (e: any) { vscode.window.showErrorMessage(e.message); }
    }));

    // Chat
    context.subscriptions.push(vscode.commands.registerCommand('on.openChat', async (node: any) => {
        if (!node?.nb) return;
        await ChatPanel.createOrShow(node.nb.id, node.nb.name);
    }));

    // Global AI
    context.subscriptions.push(vscode.commands.registerCommand('on.askAI', async () => {
        await ChatPanel.createGlobal();
    }));

    // Search
    context.subscriptions.push(vscode.commands.registerCommand('on.search', async () => {
        const q = await vscode.window.showInputBox({ title: t('search.title'), placeHolder: t('search.placeholder') });
        if (!q) return;
        const busy = vscode.window.createQuickPick(); busy.busy = true; busy.placeholder = t('search.searching'); busy.show();
        try {
            const r = await fetch(`${apiUrl()}/search`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q, search_type: 'text' }) });
            const d: any = await r.json(); busy.hide();
            const results = d.results || [];
            if (!results.length) { vscode.window.showInformationMessage(t('search.noResults')); return; }
            const items: any[] = results.map((r: any) => ({ label: r.title || r.name || '(untitled)', detail: (r.content || '').slice(0, 120) }));
            const p = await vscode.window.showQuickPick(items, { title: q, placeHolder: `${results.length} results`, matchOnDetail: true });
            if (p) { out.clear(); out.show(true); out.appendLine(`🔍 ${q}\n📌 ${p.label}\n──\n${p.detail || ''}`); }
        } catch (e: any) { busy.hide(); vscode.window.showErrorMessage(e.message); }
    }));

    // Configure AI
    context.subscriptions.push(vscode.commands.registerCommand('on.configureAI', async () => {
        const prov = await vscode.window.showQuickPick(PROVIDERS.map(p => ({ label: p.label, detail: p.detail, provider: p.provider })), { title: t('ai.config.title') });
        if (!prov) return;

        if (prov.provider === 'ollama') {
            const u = await vscode.window.showInputBox({ title: 'Ollama URL', value: 'http://localhost:11434' });
            if (!u) return;
            try {
                const cr = await (await fetch(`${apiUrl()}/credentials`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: 'ollama', name: 'Ollama', api_base: u, api_key: 'ollama' }) })).json();
                if (cr.id) {
                    await fetch(`${apiUrl()}/credentials/${cr.id}/discover`, { method: 'POST' });
                    const dr = await (await fetch(`${apiUrl()}/credentials/${cr.id}/discover`, { method: 'POST' })).json();
                    const disc = dr?.discovered || [];
                    if (disc.length) {
                        await fetch(`${apiUrl()}/credentials/${cr.id}/register-models`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ models: disc.map((m: any) => ({ name: m.name, provider: 'ollama', model_type: 'chat' })) }) });
                    }
                    vscode.window.showInformationMessage('✅ Ollama configured');
                }
            } catch (e: any) { vscode.window.showErrorMessage(e.message); }
            return;
        }

        const key = await vscode.window.showInputBox({ title: prov.label + ' API Key', password: true, validateInput: v => v ? undefined : 'Required' });
        if (!key) return;
        try {
            const cr = await (await fetch(`${apiUrl()}/credentials`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: prov.provider, name: prov.label, api_key: key }) })).json();
            if (cr.id) {
                const dr = await (await fetch(`${apiUrl()}/credentials/${cr.id}/discover`, { method: 'POST' })).json();
                const disc: any[] = dr?.discovered || [];
                if (disc.length) {
                    const models = disc.map((m: any) => ({ name: m.name, provider: m.provider || prov.provider, model_type: m.model_type || 'chat' }));
                    await fetch(`${apiUrl()}/credentials/${cr.id}/register-models`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ models }) });
                    // Get model IDs and set default
                    const allM = await (await fetch(`${apiUrl()}/models`)).json();
                    const chatMs = (allM.value || allM.models || []).filter((m: any) => m.type === 'chat');
                    if (chatMs.length) {
                        await fetch(`${apiUrl()}/models/defaults`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ default_chat_model: chatMs[0].id }) });
                    }
                }
                vscode.window.showInformationMessage(`✅ ${prov.label} configured (${disc.length} models)`);
                // Offer model selection
                if (disc.length > 1) {
                    const pick = await vscode.window.showQuickPick(['Select default model', 'Skip'], { title: 'Set default chat model?' });
                    if (pick?.startsWith('Select')) vscode.commands.executeCommand('on.setDefaultModel');
                }
            }
        } catch (e: any) { vscode.window.showErrorMessage(e.message); }
    }));

    // Set default model
    context.subscriptions.push(vscode.commands.registerCommand('on.setDefaultModel', async () => {
        try {
            const mRes = await fetch(`${apiUrl()}/models`);
            const mData: any = await mRes.json();
            const models: any[] = mData.value || mData.models || [];
            for (const type of ['chat', 'embedding']) {
                const typed = models.filter((m: any) => m.type === type || m.model_type === type);
                if (!typed.length) continue;
                const pick = await vscode.window.showQuickPick(typed.map((m: any) => ({ label: m.name, detail: m.id, id: m.id })), { title: `Default ${type} model`, placeHolder: 'Skip' });
                if (pick) {
                    await fetch(`${apiUrl()}/models/defaults`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [`default_${type}_model`]: pick.id }) });
                }
            }
            vscode.window.showInformationMessage('✅ Default models set');
        } catch (e: any) { vscode.window.showErrorMessage(e.message); }
    }));

    // Import file
    context.subscriptions.push(
        vscode.commands.registerCommand('on.importCurrentFile', async () => {
            const e = vscode.window.activeTextEditor;
            if (!e) { vscode.window.showWarningMessage(t('import.noFile')); return; }
            const nb = await pickNb(); if (!nb) return;
            try {
                await fetch(`${apiUrl()}/sources`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notebook_id: nb.id, type: 'text', title: path.basename(e.document.fileName), content: e.document.getText().slice(0, 50000) }) });
                tree.refresh(); vscode.window.showInformationMessage('✅ Imported');
            } catch (e: any) { vscode.window.showErrorMessage(e.message); }
        }),
        vscode.commands.registerCommand('on.importFile', async (uri: vscode.Uri, uris?: vscode.Uri[]) => {
            const files = uris?.length ? uris : [uri]; if (!files?.length) return;
            const nb = await pickNb(); if (!nb) return;
            let n = 0;
            for (const f of files) {
                try {
                    const c = fs.readFileSync(f.fsPath, 'utf-8').slice(0, 50000);
                    await fetch(`${apiUrl()}/sources`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notebook_id: nb.id, type: 'text', title: path.basename(f.fsPath), content: c }) });
                    n++;
                } catch { }
            }
            tree.refresh(); vscode.window.showInformationMessage(`✅ ${n}/${files.length} imported`);
        }),
        vscode.commands.registerCommand('on.importFileFromEditor', async (uri: vscode.Uri) => { vscode.commands.executeCommand('on.importFile', uri, [uri]); })
    );
}

function openDoc(type: string, id: string) {
    vscode.workspace.openTextDocument(vscode.Uri.parse(`opennotebook:///${type}/${id}`)).then(d => vscode.window.showTextDocument(d, { preview: true }));
}
async function pickNb(): Promise<api.Notebook | null> {
    const nbs = await api.listNotebooks();
    if (!nbs.length) { vscode.window.showWarningMessage(t('import.noNb')); return null; }
    const p = await vscode.window.showQuickPick(nbs.map(n => ({ label: n.name, nb: n })), { title: t('import.selectNb') });
    return p?.nb || null;
}

export function deactivate() { }
