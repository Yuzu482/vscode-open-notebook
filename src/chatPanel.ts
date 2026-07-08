import * as vscode from 'vscode';

let modelCache: { id: string; name: string; type: string; provider: string }[] = [];
let defaultsCache: any = {};

async function ensureModels() {
    if (modelCache.length) return;
    try {
        const [mRes, dRes] = await Promise.all([
            fetch('http://localhost:5055/api/models'),
            fetch('http://localhost:5055/api/models/defaults'),
        ]);
        const mData: any = await mRes.json();
        modelCache = (mData.value || mData.models || []);
        defaultsCache = await dRes.json();
    } catch { }
}

export class ChatPanel {
    public static current: ChatPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _sessionId = '';
    private _notebookId = '';
    private _mode: 'local' | 'global';

    private constructor(p: vscode.WebviewPanel, nbId: string, nbName: string, mode: 'local' | 'global') {
        this._panel = p;
        this._notebookId = nbId;
        this._mode = mode;
        p.onDidDispose(() => this.dispose());
        p.webview.onDidReceiveMessage(m => this._handle(m));
    }

    static async createOrShow(nbId: string, nbName: string) {
        if (ChatPanel.current) { ChatPanel.current._panel.reveal(vscode.ViewColumn.Two); return ChatPanel.current; }
        const p = vscode.window.createWebviewPanel('onChat', `💬 ${nbName}`,
            { viewColumn: vscode.ViewColumn.Two, preserveFocus: true },
            { enableScripts: true, retainContextWhenHidden: true });
        ChatPanel.current = new ChatPanel(p, nbId, nbName, 'local');
        p.webview.html = ChatPanel._html();
        try {
            const r = await fetch('http://localhost:5055/api/chat/sessions', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notebook_id: nbId }),
            });
            const d: any = await r.json();
            ChatPanel.current._sessionId = d.id || '';
        } catch { }
        return ChatPanel.current;
    }

    static async createGlobal() {
        if (ChatPanel.current) { ChatPanel.current._panel.reveal(vscode.ViewColumn.Two); return ChatPanel.current; }
        const p = vscode.window.createWebviewPanel('onChat', '🤖 Global Analysis',
            { viewColumn: vscode.ViewColumn.Two, preserveFocus: true },
            { enableScripts: true, retainContextWhenHidden: true });
        ChatPanel.current = new ChatPanel(p, '', 'Global', 'global');
        await ensureModels();
        p.webview.html = ChatPanel._html();
        return ChatPanel.current;
    }

    dispose() { ChatPanel.current = undefined; this._panel.dispose(); }

    private async _handle(msg: any) {
        if (msg.type !== 'send') return;
        this._panel.webview.postMessage({ type: 'msg', role: 'user', text: msg.text });

        if (this._mode === 'global') {
            await ensureModels();
            const chatModel = defaultsCache.default_chat_model || (modelCache.find(m => m.type === 'chat')?.id) || '';
            try {
                const r = await fetch('http://localhost:5055/api/search/ask/simple', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        question: msg.text,
                        strategy_model: chatModel,
                        answer_model: chatModel,
                        final_answer_model: chatModel,
                    }),
                });
                const text = await r.text();
                let answer = '';
                for (const line of text.split('\n')) {
                    if (line.startsWith('data: ')) {
                        try { const e = JSON.parse(line.slice(6)); answer = e.content || e.answer || e.final_answer || answer; } catch { }
                    }
                }
                if (!answer && text) {
                    try { const j = JSON.parse(text); answer = j.response || j.answer || text.slice(0, 500); } catch { answer = text.slice(0, 500); }
                }
                this._panel.webview.postMessage({ type: 'msg', role: 'ai', text: answer || 'No response' });
            } catch (e: any) {
                this._panel.webview.postMessage({ type: 'msg', role: 'ai', text: `Error: ${e.message}` });
            }
        } else {
            try {
                const r = await fetch('http://localhost:5055/api/chat/execute', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ session_id: this._sessionId, message: msg.text, context: { notebook_id: this._notebookId } }),
                });
                const d: any = await r.json();
                if (d.detail) {
                    this._panel.webview.postMessage({ type: 'msg', role: 'ai', text: `❌ ${typeof d.detail === 'string' ? d.detail : JSON.stringify(d.detail)}\n\n请点击底部 🟢 按钮配置 AI` });
                } else {
                    this._panel.webview.postMessage({ type: 'msg', role: 'ai', text: d.response || d.answer || JSON.stringify(d) });
                }
            } catch (e: any) {
                this._panel.webview.postMessage({ type: 'msg', role: 'ai', text: `Error: ${e.message}` });
            }
        }
        this._panel.webview.postMessage({ type: 'done' });
    }

    private static _html(): string {
        return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{display:flex;flex-direction:column;height:100vh;font-family:var(--vscode-font-family);background:var(--vscode-editor-background);color:var(--vscode-foreground)}
#msgs{flex:1;overflow-y:auto;padding:16px}
.m{max-width:85%;margin-bottom:14px;display:flex;flex-direction:column}
.m.u{align-items:flex-end;margin-left:auto}
.m.a{align-items:flex-start}
.m .r{font-size:10px;text-transform:uppercase;color:var(--vscode-descriptionForeground);margin-bottom:3px}
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
</style></head><body data-init="1">
<div id="msgs"><div class="em"><div class="ic">💬</div><div>向 AI 提问，它将搜索你的所有资料和笔记。</div></div></div>
<div id="bar"><textarea id="tx" rows="1" placeholder="输入消息... (Enter 发送)"></textarea><button id="bt">发送</button></div>
<script>
if(document.body.getAttribute('data-init')==='1'){
document.body.setAttribute('data-init','2');
(function(){
var v=acquireVsCodeApi(),ms=document.getElementById('msgs'),tx=document.getElementById('tx'),bt=document.getElementById('bt'),first=true,sending=false;
function add(r,t){
 if(first){ms.innerHTML='';first=false}
 var d=document.createElement('div');d.className='m '+(r==='user'?'u':'a');
 d.innerHTML='<div class="r">'+(r==='user'?'You':'AI')+'</div><div class="b">'+String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\\n/g,'<br>')+'</div>';
 ms.appendChild(d);ms.scrollTop=ms.scrollHeight;
}
function send(){
 if(sending)return;var t=tx.value.trim();if(!t)return;
 sending=true;add('user',t);tx.value='';tx.style.height='auto';bt.disabled=true;
 v.postMessage({type:'send',text:t});
}
tx.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();e.stopPropagation();send()}});
tx.addEventListener('input',function(){tx.style.height='auto';tx.style.height=Math.min(tx.scrollHeight,120)+'px'});
bt.addEventListener('click',function(){send()});
window.addEventListener('message',function(e){
 if(e.data.type==='msg')add(e.data.role,e.data.text);
 if(e.data.type==='done'){sending=false;bt.disabled=false;tx.focus()}
});
})();
}
</script></body></html>`;
    }
}
