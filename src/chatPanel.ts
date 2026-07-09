import * as vscode from 'vscode';

const API = 'http://localhost:5055/api';

// Cached model IDs fetched on chat open
let modelIds: { chat: string } = { chat: '' };

async function loadModels() {
    if (modelIds.chat) return;
    try {
        const d = await (await fetch(`${API}/models/defaults`)).json() as any;
        modelIds.chat = d.default_chat_model || '';
        if (!modelIds.chat) {
            const m = await (await fetch(`${API}/models`)).json() as any;
            const lang = (m.value || m || []).find((x: any) => x.type === 'language');
            modelIds.chat = lang?.id || '';
        }
    } catch { }
}

export class ChatPanel {
    public static current: ChatPanel | undefined;
    readonly _panel: vscode.WebviewPanel;
    private _sessionId = '';
    private _notebookId = '';

    private constructor(p: vscode.WebviewPanel, nbId: string) {
        this._panel = p; this._notebookId = nbId;
        p.onDidDispose(() => this.dispose());
        p.webview.onDidReceiveMessage(m => this._handle(m));
    }

    static async createOrShow(nbId: string, nbName: string) {
        if (ChatPanel.current) { ChatPanel.current._panel.reveal(vscode.ViewColumn.Two); return ChatPanel.current; }
        const p = vscode.window.createWebviewPanel('onChat', `\u{1F4AC} ${nbName}`,
            { viewColumn: vscode.ViewColumn.Two, preserveFocus: true },
            { enableScripts: true, retainContextWhenHidden: true });
        ChatPanel.current = new ChatPanel(p, nbId);
        p.webview.html = html();
        await loadModels();
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
        if (ChatPanel.current) { ChatPanel.current._panel.reveal(vscode.ViewColumn.Two); return ChatPanel.current; }
        let nbId = '';
        try { nbId = ((await (await fetch(`${API}/notebooks`)).json() as any).value?.[0]?.id || ''); } catch { }
        const p = vscode.window.createWebviewPanel('onChat', '\u{1F916} Global',
            { viewColumn: vscode.ViewColumn.Two, preserveFocus: true },
            { enableScripts: true, retainContextWhenHidden: true });
        ChatPanel.current = new ChatPanel(p, nbId);
        p.webview.html = html();
        await loadModels();
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

    private async _handle(msg: any) {
        if (msg.type !== 'send') return;
        this._panel.webview.postMessage({ type: 'msg', role: 'user', text: msg.text });
        await loadModels();

        try {
            const r = await fetch(`${API}/chat/execute`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: this._sessionId, message: msg.text, context: { notebook_id: this._notebookId } }),
            });
            const d: any = await r.json();
            if (d.detail) {
                const err = typeof d.detail === 'string' ? d.detail : JSON.stringify(d.detail);
                this._panel.webview.postMessage({ type: 'msg', role: 'ai', text: `\u274C ${err}\n\n\u914D\u7F6E: \u4FA7\u8FB9\u680F \uD83D\uDD11 \u914D\u7F6E AI \u2192 model_type\u5FC5\u987B\u4E3A language` });
            } else if (d.response || d.answer) {
                this._panel.webview.postMessage({ type: 'msg', role: 'ai', text: d.response || d.answer });
            } else {
                const msgs = d.messages || [];
                const ai = msgs.filter((m: any) => m.type === 'ai').pop();
                this._panel.webview.postMessage({ type: 'msg', role: 'ai', text: ai?.content || JSON.stringify(d).slice(0, 300) });
            }
        } catch (e: any) {
            this._panel.webview.postMessage({ type: 'msg', role: 'ai', text: `Error: ${e.message}` });
        }
        this._panel.webview.postMessage({ type: 'done' });
    }
}

function html(): string {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{display:flex;flex-direction:column;height:100vh;font-family:var(--vscode-font-family);background:var(--vscode-editor-background);color:var(--vscode-foreground)}
#msgs{flex:1;overflow-y:auto;padding:16px}
.m{max-width:85%;margin-bottom:14px;display:flex;flex-direction:column}
.m.u{align-items:flex-end;margin-left:auto}
.m.a{align-items:flex-start}
.m .l{font-size:10px;text-transform:uppercase;color:var(--vscode-descriptionForeground);margin-bottom:3px}
.m .b{padding:10px 14px;border-radius:14px;line-height:1.55;font-size:13px;white-space:pre-wrap;word-break:break-word}
.m.u .b{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border-bottom-right-radius:4px}
.m.a .b{background:var(--vscode-input-background);border:1px solid var(--vscode-input-border);border-bottom-left-radius:4px}
#bar{display:flex;gap:8px;padding:12px 16px;border-top:1px solid var(--vscode-panel-border);background:var(--vscode-editor-inactiveSelectionBackground)}
#bar textarea{flex:1;padding:10px 14px;border:1px solid var(--vscode-input-border);border-radius:20px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);font-family:inherit;font-size:13px;resize:none;min-height:40px;max-height:120px;outline:none;line-height:1.4}
#bar textarea:focus{border-color:var(--vscode-focusBorder)}
#bar button{padding:8px 18px;background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:none;border-radius:20px;cursor:pointer;font-size:13px;font-weight:500}
#bar button:hover{background:var(--vscode-button-hoverBackground)}
#bar button:disabled{opacity:.5}
.em{text-align:center;color:var(--vscode-descriptionForeground);font-size:14px;padding:60px 20px}
.em .ic{font-size:40px;margin-bottom:12px}
</style></head><body>
<div id="msgs"><div class="em"><div class="ic">\u{1F4AC}</div><div>\u5411 AI \u63D0\u95EE\uFF0C\u5B83\u5C06\u57FA\u4E8E\u4F60\u7684\u8D44\u6599\u548C\u7B14\u8BB0\u6765\u56DE\u7B54\u3002</div></div></div>
<div id="bar"><textarea id="tx" rows="1" placeholder="\u8F93\u5165\u6D88\u606F... (Enter \u53D1\u9001)"></textarea><button id="bt">\u53D1\u9001</button></div>
<script>
(function(){
if(window._onLoaded)return;window._onLoaded=1;
var v=acquireVsCodeApi(),ms=document.getElementById('msgs'),tx=document.getElementById('tx'),bt=document.getElementById('bt'),first=true,sending=false,last=0;
function add(r,t){
 if(first){ms.innerHTML='';first=false}
 var d=document.createElement('div');d.className='m '+(r==='user'?'u':'a');
 d.innerHTML='<div class="l">'+(r==='user'?'You':'AI')+'</div><div class="b">'+String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\\n/g,'<br>')+'</div>';
 ms.appendChild(d);ms.scrollTop=ms.scrollHeight;
}
function send(){
 var n=Date.now();if(sending||n-last<1000)return;last=n;
 var t=tx.value.trim();if(!t)return;
 sending=true;add('user',t);tx.value='';tx.style.height='auto';bt.disabled=true;
 v.postMessage({type:'send',text:t});
}
tx.onkeydown=function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();return false}};
tx.oninput=function(){tx.style.height='auto';tx.style.height=Math.min(tx.scrollHeight,120)+'px'};
bt.onclick=function(){send()};
window.addEventListener('message',function(e){
 if(e.data.type==='msg')add(e.data.role,e.data.text);
 if(e.data.type==='done'){sending=false;bt.disabled=false;tx.focus()}
});
})();
</script></body></html>`;
}
