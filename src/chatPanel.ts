import * as vscode from 'vscode';

const API = 'http://localhost:5055/api';

export class ChatPanel {
    public static current: ChatPanel | undefined;
    readonly _panel: vscode.WebviewPanel;
    private _sessionId = '';
    private _notebookId = '';

    private constructor(p: vscode.WebviewPanel, nbId: string) {
        this._panel = p;
        this._notebookId = nbId;
        p.onDidDispose(() => this.dispose());
        p.webview.onDidReceiveMessage(m => this._onMsg(m));
    }

    static async createOrShow(nbId: string, nbName: string) {
        ChatPanel.current?.dispose();
        const p = vscode.window.createWebviewPanel('onChat', `Chat: ${nbName}`,
            vscode.ViewColumn.Two, { enableScripts: true, retainContextWhenHidden: true });
        ChatPanel.current = new ChatPanel(p, nbId);
        p.webview.html = html();
        try {
            const r = await fetch(`${API}/chat/sessions`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notebook_id: nbId }),
            });
            ChatPanel.current._sessionId = ((await r.json()) as any).id || '';
        } catch { }
        return ChatPanel.current;
    }

    static async createGlobal() {
        ChatPanel.current?.dispose();
        let nbId = '';
        try { nbId = ((await (await fetch(`${API}/notebooks`)).json() as any).value?.[0]?.id || ''); } catch { }
        const p = vscode.window.createWebviewPanel('onChat', 'Global Analysis',
            vscode.ViewColumn.Two, { enableScripts: true, retainContextWhenHidden: true });
        ChatPanel.current = new ChatPanel(p, nbId);
        p.webview.html = html();
        if (nbId) {
            try {
                const r = await fetch(`${API}/chat/sessions`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ notebook_id: nbId }),
                });
                ChatPanel.current._sessionId = ((await r.json()) as any).id || '';
            } catch { }
        }
        return ChatPanel.current;
    }

    dispose() { ChatPanel.current = undefined; this._panel.dispose(); }

    private async _onMsg(msg: any) {
        if (msg.command !== 'send') return;

        this._panel.webview.postMessage({ command: 'echo', role: 'user', text: msg.text });

        try {
            const r = await fetch(`${API}/chat/execute`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: this._sessionId, message: msg.text, context: { notebook_id: this._notebookId } }),
            });
            const d: any = await r.json();
            let text = '';
            if (d.detail) {
                text = `Error: ${typeof d.detail === 'string' ? d.detail : JSON.stringify(d.detail)}`;
            } else if (d.response || d.answer) {
                text = d.response || d.answer;
            } else {
                const ai = (d.messages || []).filter((m: any) => m.type === 'ai').pop();
                text = ai?.content || JSON.stringify(d).slice(0, 300);
            }
            this._panel.webview.postMessage({ command: 'echo', role: 'ai', text });
        } catch (e: any) {
            this._panel.webview.postMessage({ command: 'echo', role: 'ai', text: `Error: ${e.message}` });
        }
        this._panel.webview.postMessage({ command: 'done' });
    }
}

function html(): string {
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{display:flex;flex-direction:column;height:100vh;font-family:var(--vscode-font-family, -apple-system, sans-serif);font-size:13px;color:var(--vscode-foreground);background:var(--vscode-editor-background)}
#list{flex:1;overflow-y:auto;padding:12px 0}
.msg{padding:6px 20px;max-width:100%}
.msg .who{font-size:11px;font-weight:600;margin-bottom:2px;opacity:.8}
.msg .txt{line-height:1.55;white-space:pre-wrap;word-break:break-word}
.msg.user .who{color:var(--vscode-symbolIcon-variableForeground)}
.msg.ai .who{color:var(--vscode-symbolIcon-classForeground)}
.msg.user .txt{color:var(--vscode-foreground)}
.msg.ai .txt{color:var(--vscode-foreground)}
#foot{padding:8px 16px;border-top:1px solid var(--vscode-panel-border);display:flex;gap:8px;align-items:flex-end}
#foot textarea{flex:1;padding:6px 12px;font:inherit;font-size:13px;line-height:1.4;resize:none;min-height:32px;max-height:150px;border:1px solid var(--vscode-input-border, #555);border-radius:6px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);outline:none}
#foot textarea:focus{border-color:var(--vscode-focusBorder)}
#foot button{padding:6px 14px;border:none;border-radius:4px;background:var(--vscode-button-background);color:var(--vscode-button-foreground);font:inherit;font-size:13px;cursor:pointer}
#foot button:hover{background:var(--vscode-button-hoverBackground)}
#foot button:disabled{opacity:.4;cursor:default}
.empty{padding:50px 20px;text-align:center;color:var(--vscode-descriptionForeground)}
</style></head><body>
<div id="list"><div class="empty">Ask a question about your research</div></div>
<div id="foot">
  <textarea id="inp" rows="1" placeholder="Type a message..."></textarea>
  <button id="snd" onclick="sendMsg()">Send</button>
</div>
<script>
const v=acquireVsCodeApi();
const elList=document.getElementById('list');
const elInp=document.getElementById('inp');
const elSnd=document.getElementById('snd');
let empty=true, busy=false;

function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

function addMsg(who,text){
  if(empty){elList.innerHTML='';empty=false}
  var d=document.createElement('div');d.className='msg '+who;
  d.innerHTML='<div class="who">'+(who==='user'?'You':'AI')+'</div><div class="txt">'+esc(text)+'</div>';
  elList.appendChild(d);elList.scrollTop=elList.scrollHeight;
}

function sendMsg(){
  if(busy)return;
  var t=elInp.value.trim();if(!t)return;
  busy=true;addMsg('user',t);elInp.value='';elInp.style.height='auto';elSnd.disabled=true;
  v.postMessage({command:'send',text:t});
}

elInp.addEventListener('input',function(){elInp.style.height='auto';elInp.style.height=Math.min(elInp.scrollHeight,150)+'px'});

window.addEventListener('message',function(e){
  if(e.data.command==='echo')addMsg(e.data.role,e.data.text);
  if(e.data.command==='done'){busy=false;elSnd.disabled=false;elInp.focus()}
});

elInp.focus();
</script></body></html>`;
}
