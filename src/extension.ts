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
    vscode.workspace.onDidChangeConfiguration(e => { if (e.affectsConfiguration('openNotebook.language')) setLanguage(getConfig().language); });

    const apiUrl = () => { const u = getConfig().apiUrl; return u.endsWith('/api') ? u : `${u}/api`; };
    const baseUrl = () => getConfig().apiUrl.replace(/\/api$/, '');

    const contentProvider = new ONContentProvider();
    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider('opennotebook', contentProvider));
    const tree = new NotebookTreeProvider();
    context.subscriptions.push(vscode.window.createTreeView('onNotebooks', { treeDataProvider: tree }));
    const out = vscode.window.createOutputChannel('Open Notebook', { log: true });
    context.subscriptions.push(out);

    const sbConn = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    sbConn.command = 'on.refresh'; context.subscriptions.push(sbConn);
    const sbChat = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
    sbChat.text = '$(comment-discussion) \u{1F4AC} AI \u5BF9\u8BDD';
    sbChat.tooltip = '\u70B9\u51FB\u5F00\u59CB AI \u5BF9\u8BDD';
    sbChat.command = 'on.askAI';
    sbChat.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    sbChat.show(); context.subscriptions.push(sbChat);

    async function updateConn() { const ok = await checkAPI(baseUrl()); sbConn.text = ok ? '$(notebook) ON' : '$(warning) OFF'; sbConn.tooltip = ok ? 'Connected' : 'Cannot reach API'; sbConn.show(); }
    (async () => { for (let i = 0; i < 10; i++) { if (await checkAPI(baseUrl())) break; await sleep(3000); } updateConn(); })();
    const si = setInterval(updateConn, 30000); context.subscriptions.push({ dispose: () => clearInterval(si) });

    // Commands
    context.subscriptions.push(vscode.commands.registerCommand('on.refresh', () => tree.refresh()));
    context.subscriptions.push(vscode.commands.registerCommand('on.checkEnv', async () => {
        out.clear(); out.show(true); out.appendLine('\u{1F50D} Environment Check');
        const dOk = await checkDocker(); out.appendLine(dOk ? '\u2705 Docker running' : '\u274C Docker not found');
        const aOk = await checkAPI(baseUrl()); out.appendLine(aOk ? '\u2705 API connected' : '\u26A0\uFE0F API unreachable');
        if (!aOk && dOk && config.dockerComposePath) { out.appendLine('\u{1F504} Starting...'); if (await startDocker(config.dockerComposePath)) { await sleep(5000); out.appendLine(await checkAPI(baseUrl()) ? '\u2705 Started' : '\u274C Timeout'); } }
        updateConn();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('on.switchLang', async () => {
        const p = await vscode.window.showQuickPick(SUPPORTED_LANGS, { title: 'Language', placeHolder: getLanguage() === 'zh-cn' ? '\u4E2D\u6587' : 'English' });
        if (p) { await vscode.workspace.getConfiguration('openNotebook').update('language', p.value, true); setLanguage(p.value); tree.refresh(); updateConn(); }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('on.createNotebook', async () => {
        const n = await vscode.window.showInputBox({ title: t('notebook.create.title'), placeHolder: t('notebook.create.placeholder'), validateInput: v => v ? undefined : 'Required' });
        if (!n) return; const d = await vscode.window.showInputBox({ title: t('notebook.create.title'), placeHolder: t('notebook.create.descPlaceholder') });
        try { await api.createNotebook(n, d || ''); tree.refresh(); vscode.window.showInformationMessage(`\u2705 ${n}`); } catch (e: any) { vscode.window.showErrorMessage(e.message); }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('on.deleteNotebook', async (n: any) => {
        if (!n?.nb) return; if ('Delete' !== await vscode.window.showWarningMessage(`Delete "${n.nb.name}"?`, { modal: true }, 'Delete')) return;
        try { await api.deleteNotebook(n.nb.id); tree.refresh(); } catch (e: any) { vscode.window.showErrorMessage(e.message); }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('on.openNotebook', async (n: any) => {
        if (!n?.nb) return; const nb = n.nb;
        const acts = [t('notebook.open.viewSources'), t('notebook.open.viewNotes'), t('notebook.open.chat'), t('notebook.open.addSource'), t('notebook.open.addNote')];
        const a = await vscode.window.showQuickPick(acts, { title: nb.name }); if (!a) return;
        if (a === acts[0]) { const ss = await api.listSources(nb.id); if (!ss.length) { vscode.window.showInformationMessage(t('source.none')); return; } const p = await vscode.window.showQuickPick(ss.map((s: any) => ({ label: s.title || s.id, detail: s.content_type, source: s })), { title: t('source.listTitle') }); if (p) openDoc('source', p.source.id); }
        if (a === acts[1]) { const ns = await api.listNotes(nb.id); if (!ns.length) { vscode.window.showInformationMessage(t('note.none')); return; } const p = await vscode.window.showQuickPick(ns.map((n2: any) => ({ label: n2.title || 'Untitled', detail: (n2.content || '').slice(0, 80), note: n2 })), { title: t('note.listTitle') }); if (p) openDoc('note', p.note.id); }
        if (a === acts[2]) vscode.commands.executeCommand('on.openChat', n);
        if (a === acts[3]) vscode.commands.executeCommand('on.createSource', n);
        if (a === acts[4]) vscode.commands.executeCommand('on.createNote', n);
    }));
    context.subscriptions.push(
        vscode.commands.registerCommand('on.openSource', (s: any) => openDoc('source', s.id)),
        vscode.commands.registerCommand('on.openNote', (n: any) => openDoc('note', n.id))
    );
    context.subscriptions.push(vscode.commands.registerCommand('on.createSource', async (n: any) => {
        if (!n?.nb) return; const type = await vscode.window.showQuickPick([t('source.add.url'), t('source.add.text')], { title: t('source.add.title', n.nb.name) }); if (!type) return;
        if (type === t('source.add.url')) {
            const url = await vscode.window.showInputBox({ title: t('source.add.urlTitle'), placeHolder: t('source.add.urlPlaceholder'), validateInput: v => v ? undefined : 'Required' }); if (!url) return;
            const title = await vscode.window.showInputBox({ title: t('source.add.titleLabel') });
            try { await fetch(`${apiUrl()}/sources`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notebook_id: n.nb.id, type: 'url', url, title }) }); tree.refresh(); vscode.window.showInformationMessage('\u2705 Added'); } catch (e: any) { vscode.window.showErrorMessage(e.message); }
        } else {
            const title = await vscode.window.showInputBox({ title: t('source.add.textTitle'), validateInput: v => v ? undefined : 'Required' }); if (!title) return;
            const content = await vscode.window.showInputBox({ title: t('source.add.textContent'), validateInput: v => v ? undefined : 'Required' }); if (!content) return;
            try { await fetch(`${apiUrl()}/sources`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notebook_id: n.nb.id, type: 'text', title, content }) }); tree.refresh(); vscode.window.showInformationMessage('\u2705 Added'); } catch (e: any) { vscode.window.showErrorMessage(e.message); }
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('on.createNote', async (n: any) => {
        if (!n?.nb) return; const title = await vscode.window.showInputBox({ title: t('note.create.title', n.nb.name), validateInput: v => v ? undefined : 'Required' }); if (!title) return;
        const content = await vscode.window.showInputBox({ title: t('note.create.content') }); if (!content) return;
        try { await api.createNote(n.nb.id, title, content); tree.refresh(); vscode.window.showInformationMessage('\u2705 Created'); } catch (e: any) { vscode.window.showErrorMessage(e.message); }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('on.openChat', async (n: any) => { if (n?.nb) await ChatPanel.createOrShow(n.nb.id, n.nb.name); }));
    context.subscriptions.push(vscode.commands.registerCommand('on.askAI', async () => { await ChatPanel.createGlobal(); }));
    context.subscriptions.push(vscode.commands.registerCommand('on.search', async () => {
        const q = await vscode.window.showInputBox({ title: t('search.title'), placeHolder: t('search.placeholder') }); if (!q) return;
        const busy = vscode.window.createQuickPick(); busy.busy = true; busy.placeholder = t('search.searching'); busy.show();
        try { const r = await fetch(`${apiUrl()}/search`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q, search_type: 'text' }) }); const d: any = await r.json(); busy.hide(); const results = d.results || []; if (!results.length) { vscode.window.showInformationMessage(t('search.noResults')); return; } const p = await vscode.window.showQuickPick((results as any[]).map((r2: any) => ({ label: r2.title || r2.name || '(untitled)', detail: (r2.content || '').slice(0, 120) })), { title: q, placeHolder: `${results.length} results` }); if (p) { out.clear(); out.show(true); out.appendLine(`\u{1F50D} ${q}\n\u{1F4CC} ${p.label}\n\u2500\u2500\n${p.detail || ''}`); } } catch (e: any) { busy.hide(); vscode.window.showErrorMessage(e.message); }
    }));

    // ---- Configure AI (CRITICAL FIX: model_type="language" not "chat") ----
    context.subscriptions.push(vscode.commands.registerCommand('on.configureAI', async () => {
        const prov = await vscode.window.showQuickPick(PROVIDERS.map(p => ({ label: p.label, detail: p.detail, provider: p.provider })), { title: t('ai.config.title') }); if (!prov) return;
        if (prov.provider === 'ollama') {
            const u = await vscode.window.showInputBox({ title: 'Ollama URL', value: 'http://localhost:11434' }); if (!u) return;
            try {
                const cr: any = await (await fetch(`${apiUrl()}/credentials`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: 'ollama', name: 'Ollama', api_base: u, api_key: 'ollama' }) })).json();
                if (cr.id) {
                    const dr: any = await (await fetch(`${apiUrl()}/credentials/${cr.id}/discover`, { method: 'POST' })).json();
                    const disc = dr?.discovered || [];
                    if (disc.length) {
                        const models = disc.map((m: any) => ({ name: m.name, provider: 'ollama', model_type: 'language' }));
                        await fetch(`${apiUrl()}/credentials/${cr.id}/register-models`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ models }) });
                    }
                    vscode.window.showInformationMessage('\u2705 Ollama configured');
                }
            } catch (e: any) { vscode.window.showErrorMessage(e.message); }
            return;
        }
        const key = await vscode.window.showInputBox({ title: prov.label + ' API Key', password: true, validateInput: v => v ? undefined : 'Required' }); if (!key) return;
        try {
            const cr: any = await (await fetch(`${apiUrl()}/credentials`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: prov.provider, name: prov.label, api_key: key }) })).json();
            if (cr.id) {
                const dr: any = await (await fetch(`${apiUrl()}/credentials/${cr.id}/discover`, { method: 'POST' })).json();
                const disc: any[] = dr?.discovered || [];
                if (disc.length) {
                    const models = disc.map((m: any) => ({ name: m.name, provider: m.provider || prov.provider, model_type: 'language' }));
                    await fetch(`${apiUrl()}/credentials/${cr.id}/register-models`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ models }) });
                    const allM: any = await (await fetch(`${apiUrl()}/models`)).json();
                    const langM = (allM.value || allM || []).filter((m: any) => m.type === 'language');
                    if (langM.length) {
                        await fetch(`${apiUrl()}/models/defaults`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ default_chat_model: langM[0].id }) });
                    }
                }
                vscode.window.showInformationMessage(`\u2705 ${prov.label} configured (${disc.length} models)`);
            }
        } catch (e: any) { vscode.window.showErrorMessage(e.message); }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('on.setDefaultModel', async () => {
        try {
            const mData: any = await (await fetch(`${apiUrl()}/models`)).json();
            const models: any[] = mData.value || mData || [];
            for (const type of ['chat', 'embedding']) {
                const typed = models.filter((m: any) => m.type === 'language' || m.type === type);
                if (!typed.length) continue;
                const pick = await vscode.window.showQuickPick(typed.map((m: any) => ({ label: m.name, detail: m.id, id: m.id })), { title: `Default model for ${type}`, placeHolder: 'Skip' });
                if (pick) { await fetch(`${apiUrl()}/models/defaults`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [`default_${type}_model`]: pick.id }) }); }
            }
            vscode.window.showInformationMessage('\u2705 Defaults set');
        } catch (e: any) { vscode.window.showErrorMessage(e.message); }
    }));

    // Import
    context.subscriptions.push(
        vscode.commands.registerCommand('on.importCurrentFile', async () => {
            const e = vscode.window.activeTextEditor; if (!e) { vscode.window.showWarningMessage(t('import.noFile')); return; }
            const nb = await pickNb(); if (!nb) return;
            try { await fetch(`${apiUrl()}/sources`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notebook_id: nb.id, type: 'text', title: path.basename(e.document.fileName), content: e.document.getText().slice(0, 50000) }) }); tree.refresh(); vscode.window.showInformationMessage('\u2705 Imported'); } catch (e2: any) { vscode.window.showErrorMessage(e2.message); }
        }),
        vscode.commands.registerCommand('on.importFile', async (uri: vscode.Uri, uris?: vscode.Uri[]) => {
            const files = uris?.length ? uris : [uri]; if (!files?.length) return; const nb = await pickNb(); if (!nb) return; let n = 0;
            for (const f of files) { try { const c = fs.readFileSync(f.fsPath, 'utf-8').slice(0, 50000); await fetch(`${apiUrl()}/sources`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notebook_id: nb.id, type: 'text', title: path.basename(f.fsPath), content: c }) }); n++; } catch { } }
            tree.refresh(); vscode.window.showInformationMessage(`\u2705 ${n}/${files.length} imported`);
        }),
        vscode.commands.registerCommand('on.importFileFromEditor', async (uri: vscode.Uri) => { vscode.commands.executeCommand('on.importFile', uri, [uri]); })
    );
}

function openDoc(type: string, id: string) { vscode.workspace.openTextDocument(vscode.Uri.parse(`opennotebook:///${type}/${id}`)).then(d => vscode.window.showTextDocument(d, { preview: true })); }
async function pickNb(): Promise<api.Notebook | null> { const nbs = await api.listNotebooks(); if (!nbs.length) { vscode.window.showWarningMessage(t('import.noNb')); return null; } const p = await vscode.window.showQuickPick(nbs.map(n => ({ label: n.name, nb: n })), { title: t('import.selectNb') }); return p?.nb || null; }
export function deactivate() { }
