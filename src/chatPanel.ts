import * as vscode from 'vscode';

export class ChatPanel {
    public static current: ChatPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private _sessionId = '';
    private _notebookId = '';
    private _notebookName = '';

    private constructor(panel: vscode.WebviewPanel, nbId: string, nbName: string) {
        this._panel = panel;
        this._notebookId = nbId;
        this._notebookName = nbName;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.onDidReceiveMessage(
            msg => this._handleMessage(msg), null, this._disposables
        );
    }

    static async createOrShow(nbId: string, nbName: string) {
        if (ChatPanel.current) {
            ChatPanel.current._panel.reveal(vscode.ViewColumn.Two);
            return ChatPanel.current;
        }
        const panel = vscode.window.createWebviewPanel(
            'onChat', `💬 ${nbName}`, { viewColumn: vscode.ViewColumn.Two, preserveFocus: true },
            { enableScripts: true, retainContextWhenHidden: true }
        );
        ChatPanel.current = new ChatPanel(panel, nbId, nbName);
        panel.webview.html = ChatPanel._html();
        // Create chat session
        try {
            const res = await fetch('http://localhost:5055/api/chat/sessions', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notebook_id: nbId }),
            });
            const data: any = await res.json();
            ChatPanel.current._sessionId = data.id || '';
        } catch { /* continue without session */ }
        return ChatPanel.current;
    }

    static async createGlobal() {
        if (ChatPanel.current) {
            ChatPanel.current._panel.reveal(vscode.ViewColumn.Two);
            return ChatPanel.current;
        }
        const panel = vscode.window.createWebviewPanel(
            'onChat', `🤖 全局分析`, { viewColumn: vscode.ViewColumn.Two, preserveFocus: true },
            { enableScripts: true, retainContextWhenHidden: true }
        );
        ChatPanel.current = new ChatPanel(panel, '', '全局分析');
        panel.webview.html = ChatPanel._html();
        return ChatPanel.current;
    }

    dispose() {
        ChatPanel.current = undefined;
        this._panel.dispose();
        while (this._disposables.length) { this._disposables.pop()!.dispose(); }
    }

    private async _handleMessage(msg: any) {
        if (msg.type === 'send') {
            this._panel.webview.postMessage({ type: 'msg', role: 'user', text: msg.text });

            if (msg.mode === 'global') {
                try {
                    const res = await fetch('http://localhost:5055/api/ask', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ question: msg.text }),
                    });
                    if (!res.ok) {
                        const err: any = await res.json().catch(() => ({}));
                        const detail = typeof err.detail === 'string' ? err.detail : JSON.stringify(err);
                        this._panel.webview.postMessage({ type: 'msg', role: 'ai', text: `❌ ${detail}\n\n请在浏览器打开 http://localhost:8502 → Models 配置 AI 模型，或点击侧边栏 🔑 配置 AI。` });
                        this._panel.webview.postMessage({ type: 'done' });
                        return;
                    }
                    const text = await res.text();
                    let answer = '';
                    for (const line of text.split('\n')) {
                        if (line.startsWith('data: ')) {
                            try { const e = JSON.parse(line.slice(6)); if (e.type === 'final_answer') { answer = e.content || e.answer || ''; } } catch { }
                        }
                    }
                    this._panel.webview.postMessage({ type: 'msg', role: 'ai', text: answer || 'No response.' });
                } catch (e: any) {
                    this._panel.webview.postMessage({ type: 'msg', role: 'ai', text: `Error: ${e.message}` });
                }
            } else {
                try {
                    const res = await fetch('http://localhost:5055/api/chat/execute', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            session_id: this._sessionId,
                            message: msg.text,
                            context: { notebook_id: this._notebookId },
                        }),
                    });
                    const data: any = await res.json();
                    if (data.detail) {
                        const detail = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
                        this._panel.webview.postMessage({ type: 'msg', role: 'ai', text: `❌ ${detail}\n\n请在浏览器打开 http://localhost:8502 → Models 配置 AI 模型，或点击侧边栏 🔑 配置 AI。` });
                    } else {
                        this._panel.webview.postMessage({ type: 'msg', role: 'ai', text: data.response || data.answer || JSON.stringify(data) });
                    }
                } catch (e: any) {
                    this._panel.webview.postMessage({ type: 'msg', role: 'ai', text: `Error: ${e.message}` });
                }
            }
            this._panel.webview.postMessage({ type: 'done' });
        }
    }

    private static _html(): string {
        return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{display:flex;flex-direction:column;height:100vh;font-family:var(--vscode-font-family);background:var(--vscode-editor-background);color:var(--vscode-foreground)}
#header{padding:12px 16px;font-size:13px;font-weight:600;border-bottom:1px solid var(--vscode-panel-border);background:var(--vscode-editor-inactiveSelectionBackground);display:flex;align-items:center;gap:8px}
#header .dot{width:8px;height:8px;border-radius:50%;background:#4CAF50}
#messages{flex:1;overflow-y:auto;padding:16px}
.msg{max-width:85%;margin-bottom:14px;display:flex;flex-direction:column}
.msg.user{align-items:flex-end;margin-left:auto}
.msg.ai{align-items:flex-start}
.msg .role{font-size:10px;text-transform:uppercase;color:var(--vscode-descriptionForeground);margin-bottom:3px}
.msg .bubble{padding:10px 14px;border-radius:14px;line-height:1.55;font-size:13px;white-space:pre-wrap;word-break:break-word}
.msg.user .bubble{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border-bottom-right-radius:4px}
.msg.ai .bubble{background:var(--vscode-input-background);border:1px solid var(--vscode-input-border);border-bottom-left-radius:4px}
#input-area{display:flex;gap:8px;padding:12px 16px;border-top:1px solid var(--vscode-panel-border);background:var(--vscode-editor-inactiveSelectionBackground)}
#input-area textarea{flex:1;padding:10px 14px;border:1px solid var(--vscode-input-border);border-radius:20px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);font-family:inherit;font-size:13px;resize:none;min-height:40px;max-height:120px;outline:none;line-height:1.4}
#input-area textarea:focus{border-color:var(--vscode-focusBorder)}
#input-area button{padding:8px 18px;background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:none;border-radius:20px;cursor:pointer;font-size:13px;font-weight:500;white-space:nowrap}
#input-area button:hover{background:var(--vscode-button-hoverBackground)}
#input-area button:disabled{opacity:.5;cursor:default}
.typing{display:flex;gap:6px;padding:10px 14px;align-items:center}
.typing span{width:6px;height:6px;border-radius:50%;background:var(--vscode-descriptionForeground);animation:dot 1.4s infinite}
.typing span:nth-child(2){animation-delay:.2s}
.typing span:nth-child(3){animation-delay:.4s}
@keyframes dot{0%,80%,100%{opacity:.2}40%{opacity:1}}
.empty{text-align:center;color:var(--vscode-descriptionForeground);font-size:14px;padding:60px 20px}
.empty .icon{font-size:40px;margin-bottom:12px}
code{background:var(--vscode-textCodeBlock-background);padding:2px 6px;border-radius:4px;font-size:12px}
pre{background:var(--vscode-textCodeBlock-background);padding:12px;border-radius:8px;overflow-x:auto;margin:6px 0}
pre code{padding:0;background:none}
</style></head><body>
<div id="header"><span class="dot"></span> Chat</div>
<div id="messages">
  <div class="empty">
    <div class="icon">💬</div>
    <div>Ask questions about your research.<br>AI will search through your sources and notes.</div>
  </div>
</div>
<div id="input-area">
  <textarea id="input" rows="1" placeholder="Type your message... (Enter to send, Shift+Enter for new line)"></textarea>
  <button id="sendBtn">Send</button>
</div>
<script>
(function() {
const vscode = acquireVsCodeApi();
const messages = document.getElementById('messages');
const input = document.getElementById('input');
const sendBtn = document.getElementById('sendBtn');
let firstMsg = true;
let sending = false;

function addMessage(role, text) {
    if (firstMsg) { messages.innerHTML = ''; firstMsg = false; }
    const div = document.createElement('div');
    div.className = 'msg ' + role;
    div.innerHTML = '<div class="role">' + (role==='user'?'You':'AI') + '</div><div class="bubble">' + escapeHtml(text) + '</div>';
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
}

function escapeHtml(s) { return (''+s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\\n/g,'<br>'); }

function doSend() {
    if (sending) return;
    const text = input.value.trim();
    if (!text) return;
    sending = true;
    addMessage('user', text);
    input.value = '';
    input.style.height = 'auto';
    sendBtn.disabled = true;
    const mode = document.title.includes('全局') ? 'global' : 'local';
    vscode.postMessage({ type: 'send', text, mode });
}

// Use a single listener with stopImmediatePropagation
let listenerAdded = false;
if (!listenerAdded) {
    listenerAdded = true;
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            doSend();
            return false;
        }
    }, true);
}

input.addEventListener('input', function() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
});
sendBtn.addEventListener('click', function(e) { e.preventDefault(); doSend(); });

window.addEventListener('message', function(e) {
    if (e.data.type === 'msg') {
        addMessage(e.data.role, e.data.text);
    }
    if (e.data.type === 'done') {
        sending = false;
        sendBtn.disabled = false;
        input.focus();
    }
});

input.focus();
})();
</script></body></html>`;
    }
}
