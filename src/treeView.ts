import * as vscode from 'vscode';
import * as api from './api';
import { t } from './i18n';

export class ONContentProvider implements vscode.TextDocumentContentProvider {
    private _e = new vscode.EventEmitter<vscode.Uri>();
    readonly onDidChange = this._e.event;
    async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
        const [, type, id] = uri.path.split('/');
        try {
            if (type === 'source') { const s = await api.getSource(id); return `# ${s.title || 'Source'}\n\n${s.content || ''}`; }
            if (type === 'note') { const n = await api.getNote(id); return n.content || ''; }
        } catch (e: any) { return `Error: ${e.message}`; }
        return '';
    }
    refresh(u?: vscode.Uri) { this._e.fire(u || vscode.Uri.parse('opennotebook:///')); }
}

type TN = NBN | SF | SN | NF | NN;

class NBN extends vscode.TreeItem {
    constructor(public nb: api.Notebook) {
        super(nb.name, vscode.TreeItemCollapsibleState.Collapsed);
        this.id = nb.id; this.contextValue = 'notebook';
        this.iconPath = new vscode.ThemeIcon('notebook');
    }
}
class SF extends vscode.TreeItem {
    constructor(nbId: string, n: number) {
        super(t('tree.sources', n), vscode.TreeItemCollapsibleState.Collapsed);
        this.id = nbId + '::s'; this.iconPath = new vscode.ThemeIcon('folder-library');
    }
}
class SN extends vscode.TreeItem {
    constructor(public src: api.Source) {
        super(src.title || src.id, vscode.TreeItemCollapsibleState.None);
        this.id = src.id; this.contextValue = 'source';
        this.iconPath = new vscode.ThemeIcon('file');
        this.description = src.content_type || '';
        this.command = { command: 'on.openSource', title: '', arguments: [src] };
    }
}
class NF extends vscode.TreeItem {
    constructor(nbId: string, n: number) {
        super(t('tree.notes', n), vscode.TreeItemCollapsibleState.Collapsed);
        this.id = nbId + '::n'; this.iconPath = new vscode.ThemeIcon('edit');
    }
}
class NN extends vscode.TreeItem {
    constructor(public note: api.Note) {
        super(note.title || 'Untitled', vscode.TreeItemCollapsibleState.None);
        this.id = note.id; this.contextValue = 'note';
        this.iconPath = new vscode.ThemeIcon('note');
        this.command = { command: 'on.openNote', title: '', arguments: [note] };
    }
}

export class NotebookTreeProvider implements vscode.TreeDataProvider<TN> {
    private _e = new vscode.EventEmitter<TN | undefined>();
    readonly onDidChangeTreeData = this._e.event;
    private sc = new Map<string, api.Source[]>();
    private nc = new Map<string, api.Note[]>();

    refresh() { this.sc.clear(); this.nc.clear(); this._e.fire(undefined); }
    getTreeItem(e: TN) { return e; }

    async getChildren(e?: TN): Promise<TN[]> {
        if (!e) { return (await api.listNotebooks()).map(n => new NBN(n)); }
        if (e instanceof NBN) {
            const [ss, ns] = await Promise.all([api.listSources(e.nb.id), api.listNotes(e.nb.id)]);
            this.sc.set(e.nb.id, ss); this.nc.set(e.nb.id, ns);
            return [new SF(e.nb.id, ss.length), new NF(e.nb.id, ns.length)];
        }
        if (e instanceof SF) { return (this.sc.get(e.id!.split('::')[0]) || []).map(s => new SN(s)); }
        if (e instanceof NF) { return (this.nc.get(e.id!.split('::')[0]) || []).map(n => new NN(n)); }
        return [];
    }
}
