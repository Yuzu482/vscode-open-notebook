import * as vscode from 'vscode';

export class ChatPanel {
    public static current: ChatPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _sessionId = '';
    private _notebookId = '';
    private _notebookName = '';
    private _mode: 'local' | 'global';

    private constructor(panel: vscode.WebviewPanel, nbId: string, nbName: string, mode: 'local' | 'global') {
        this._panel = panel;
        this._notebookId = nbId;
        this._notebookName = nbName;
        this._mode = mode;
        panel.onDidDispose(() => this.dispose(), null);
        panel.webview.onDidReceiveMessage(m => this._handle(m), null);
    }

    static async createOrShow(nbId: string, nbName: string) {
        if (ChatPanel.current) { ChatPanel.current._panel.reveal(vscode.ViewColumn.Two); return ChatPanel.current; }
        const panel = vscode.window.createWebviewPanel('onChat', `💬 ${nbName}`,
            { viewColumn: vscode.ViewColumn.Two, preserveFocus: true },
            { enableScripts: true, retainContextWhenHidden: true });
        ChatPanel.current = new ChatPanel(panel, nbId, nbName, 'local');
        panel.webview.html = ChatPanel._html();
        try {
            const res = await fetch('http://localhost:5055/api/chat/sessions', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notebook_id: nbId }),
            });
            const data: any = await res.json();
            ChatPanel.current._sessionId = data.id || '';
        } catch { }
        return ChatPanel.current;
    }

    static async createGlobal() {
        if (ChatPanel.current) { ChatPanel.current._panel.reveal(vscode.ViewColumn.Two); return ChatPanel.current; }
        const panel = vscode.window.createWebviewPanel('onChat', '🤖 全局分析',
            { viewColumn: vscode.ViewColumn.Two, preserveFocus: true },
            { enableScripts: true, retainContextWhenHidden: true });
        ChatPanel.current = new ChatPanel(panel, '', '全局分析', 'global');
        panel.webview.html = ChatPanel._html();
        return ChatPanel.current;
    }

    dispose() { ChatPanel.current = undefined; this._panel.dispose(); }

    private async _handle(msg: any) {
        if (msg.type !== 'send') return;
        this._panel.webview.postMessage({ type: 'msg', role: 'user', text: msg.text });

        try {
            if (this._mode === 'global') {
                const res = await fetch('http://localhost:5055/api/search/ask/simple', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ question: msg.text, strategy_model: '', answer_model: '', final_answer_model: '' }),
                });
                const data = await res.text();
                let answer = '';
                for (const line of data.split('\n')) {
                    if (line.startsWith('data: ')) {
                        try { const e = JSON.parse(line.slice(6)); if (e.type === 'final_answer') answer = e.content || e.answer || ''; } catch { }
                    }
                }
                this._panel.webview.postMessage({ type: 'msg', role: 'ai', text: answer || data.slice(0, 500) || 'No response' });
            } else {
                const res = await fetch('http://localhost:5055/api/chat/execute', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ session_id: this._sessionId, message: msg.text, context: { notebook_id: this._notebookId } }),
                });
                const data: any = await res.json();
                if (data.detail) {
                    this._panel.webview.postMessage({ type: 'msg', role: 'ai', text: `❌ ${typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail)}\n\n请点击侧边栏 🔑 配置 AI` });
                } else {
                    this._panel.webview.postMessage({ type: 'msg', role: 'ai', text: data.response || data.answer || JSON.stringify(data) });
                }
            }
        } catch (e: any) {
            this._panel.webview.postMessage({ type: 'msg', role: 'ai', text: `Error: ${e.message}` });
        }
        this._panel.webview.postMessage({ type: 'done' });
    }

    private static _html(): string {
        return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{display:flex;flex-direction:column;height:100vh;font-family:var(--vscode-font-family);background:var(--vscode-editor-background);color:var(--vscode-foreground)}
#messages{flex:1;overflow-y:auto;padding:16px}
.msg{max-width:85%;margin-bottom:14px;display:flex;flex-direction:column}
.msg.user{align-items:flex-end;margin-left:auto}
.msg.ai{align-items:flex-start}
.msg .role{font-size:10px;text-transform:uppercase;color:var(--vscode-descriptionForeground);margin-bottom:3px}
.msg .bubble{padding:10px 14px;border-radius:14px;line-height:1.55;font-size:13px;white-space:pre-wrap;word-break:break-word}
.msg.user .bubble{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border-bottom-right-radius:4px}
.msg.ai .bubble{background:var(--vscode-input-background);border:1px solid var(--vscode-input-border);border-bottom-left-radius:4px}
#bar{display:flex;gap:8px;padding:12px 16px;border-top:1px solid var(--vscode-panel-border);background:var(--vscode-editor-inactiveSelectionBackground)}
#bar textarea{flex:1;padding:10px 14px;border:1px solid var(--vscode-input-border);border-radius:20px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);font-family:inherit;font-size:13px;resize:none;min-height:40px;max-height:120px;outline:none;line-height:1.4}
#bar textarea:focus{border-color:var(--vscode-focusBorder)}
#bar button{padding:8px 18px;background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:none;border-radius:20px;cursor:pointer;font-size:13px;font-weight:500}
#bar button:hover{background:var(--vscode-button-hoverBackground)}
.empty{text-align:center;color:var(--vscode-descriptionForeground);font-size:14px;padding:60px 20px}
.empty .icon{font-size:40px;margin-bottom:12px}
</style></head><body>
<div id="messages"><div class="empty"><div class="icon">💬</div><div>向 AI 提问，它会搜索你的资料和笔记。</div></div></div>
<div id="bar"><textarea id="inp" rows="1" placeholder="输入消息... (Enter 发送)"></textarea><button id="btn">发送</button></div>
<script>
(function(){
const vscode=acquireVsCodeApi();
const msgs=document.getElementById('messages');
const inp=document.getElementById('inp');
const btn=document.getElementById('btn');
let first=true,sending=false;

function add(r,t){
    if(first){msgs.innerHTML='';first=false}
    const d=document.createElement('div');
    d.className='msg '+r;
    d.innerHTML='<div class="role">'+(r==='user'?'You':'AI')+'</div><div class="bubble">'+t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\\n/g,'<br>')+'</div>';
    msgs.appendChild(d);
    msgs.scrollTop=msgs.scrollHeight;
}

function send(){
    if(sending)return;
    const t=inp.value.trim();
    if(!t)return;
    sending=true;
    add('user',t);
    inp.value='';inp.style.height='auto';
    btn.disabled=true;
    vscode.postMessage({type:'send',text:t});
}

inp.onkeydown=function(e){
    if(e.keyCode===13&&!e.shiftKey){e.preventDefault();send()}
};
inp.oninput=function(){inp.style.height='auto';inp.style.height=Math.min(inp.scrollHeight,120)+'px'};
btn.onclick=function(){send()};

window.addEventListener('message',function(e){
    if(e.data.type==='msg')add(e.data.role,e.data.text);
    if(e.data.type==='done'){sending=false;btn.disabled=false;inp.focus()}
});
inp.focus();
})();
</script></body></html>`;
    }
}
