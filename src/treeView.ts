import * as vscode from 'vscode';
import * as api from './api';
import { t } from './i18n';

export class ONContentProvider implements vscode.TextDocumentContentProvider {
    private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
    readonly onDidChange = this._onDidChange.event;

    async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
        const [_, type, id] = uri.path.split('/');
        try {
            if (type === 'source') {
                const s = await api.getSource(id);
                return `# ${s.title || 'Untitled Source'}\n\nType: ${s.content_type || 'unknown'} | Status: ${s.status || 'ready'}\n\n---\n\n${s.content || '(No content)'}`;
            }
            if (type === 'note') {
                const n = await api.getNote(id);
                return n.content || '(Empty note)';
            }
        } catch (e: any) { return `Error: ${e.message}`; }
        return 'Unknown';
    }
    refresh(uri?: vscode.Uri) { this._onDidChange.fire(uri || vscode.Uri.parse('opennotebook:///')); }
}

type TreeNode = NBNote | SrcFolder | SrcNode | NoteFolder | NoteNode;

class NBNote extends vscode.TreeItem {
    constructor(public nb: api.Notebook) {
        super(nb.name, vscode.TreeItemCollapsibleState.Collapsed);
        this.id = nb.id; this.contextValue = 'notebook';
        this.iconPath = new vscode.ThemeIcon('notebook');
        this.description = nb.archived ? '(archived)' : '';
    }
}
class SrcFolder extends vscode.TreeItem {
    constructor(nbId: string, n: number) {
        super(t('tree.sources', n), vscode.TreeItemCollapsibleState.Collapsed);
        this.id = nbId + '::src'; this.iconPath = new vscode.ThemeIcon('folder-library');
    }
}
class SrcNode extends vscode.TreeItem {
    constructor(public src: api.Source) {
        super(src.title || src.id, vscode.TreeItemCollapsibleState.None);
        this.id = src.id; this.contextValue = 'source';
        this.iconPath = new vscode.ThemeIcon('file');
        this.description = src.content_type || '';
        this.command = { command: 'on.openSource', title: '', arguments: [src] };
    }
}
class NoteFolder extends vscode.TreeItem {
    constructor(nbId: string, n: number) {
        super(t('tree.notes', n), vscode.TreeItemCollapsibleState.Collapsed);
        this.id = nbId + '::notes'; this.iconPath = new vscode.ThemeIcon('edit');
    }
}
class NoteNode extends vscode.TreeItem {
    constructor(public note: api.Note) {
        super(note.title || 'Untitled', vscode.TreeItemCollapsibleState.None);
        this.id = note.id; this.contextValue = 'note';
        this.iconPath = new vscode.ThemeIcon('note');
        this.command = { command: 'on.openNote', title: '', arguments: [note] };
    }
}

class ChatButtonNode extends vscode.TreeItem {
    constructor() {
        super('💬 与 AI 对话', vscode.TreeItemCollapsibleState.None);
        this.iconPath = new vscode.ThemeIcon('comment-discussion');
        this.command = { command: 'on.askAI', title: '' };
        this.tooltip = 'AI 将搜索所有笔记本的资料和笔记来回答你的问题';
    }
}

class SeparatorNode extends vscode.TreeItem {
    constructor() {
        super('', vscode.TreeItemCollapsibleState.None);
        this.description = '───  ───  ───';
    }
}

export class NotebookTreeProvider implements vscode.TreeDataProvider<TreeNode> {
    private _onDidChange = new vscode.EventEmitter<TreeNode | undefined>();
    readonly onDidChangeTreeData = this._onDidChange.event;
    private sc = new Map<string, api.Source[]>();
    private nc = new Map<string, api.Note[]>();

    refresh() { this.sc.clear(); this.nc.clear(); this._onDidChange.fire(undefined); }
    getTreeItem(e: TreeNode) { return e; }

    async getChildren(e?: TreeNode): Promise<TreeNode[]> {
        if (!e) {
            const nbs = await api.listNotebooks();
            const items: TreeNode[] = nbs.map(n => new NBNote(n));
            if (nbs.length) { items.push(new SeparatorNode()); }
            items.push(new ChatButtonNode());
            return items;
        }
        if (e instanceof NBNote) {
            const [ss, ns] = await Promise.all([api.listSources(e.nb.id), api.listNotes(e.nb.id)]);
            this.sc.set(e.nb.id, ss); this.nc.set(e.nb.id, ns);
            return [new SrcFolder(e.nb.id, ss.length), new NoteFolder(e.nb.id, ns.length)];
        }
        if (e instanceof SrcFolder) { return (this.sc.get(e.id!.split('::')[0]) || []).map(s => new SrcNode(s)); }
        if (e instanceof NoteFolder) { return (this.nc.get(e.id!.split('::')[0]) || []).map(n => new NoteNode(n)); }
        return [];
    }
}
