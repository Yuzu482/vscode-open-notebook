import * as vscode from 'vscode';
import * as cp from 'child_process';

export function getConfig() {
    const c = vscode.workspace.getConfiguration('openNotebook');
    return {
        apiUrl: c.get<string>('apiUrl', 'http://localhost:5055'),
        webUrl: c.get<string>('webUrl', 'http://localhost:8502'),
        language: c.get<string>('language', 'zh-cn'),
        autoStartDocker: c.get<boolean>('autoStartDocker', false),
        dockerComposePath: c.get<string>('dockerComposePath', ''),
    };
}

export async function checkDocker(): Promise<boolean> {
    return new Promise(resolve => {
        cp.exec('docker info', { timeout: 5000 }, (err) => {
            resolve(!err);
        });
    });
}

export async function checkAPI(apiUrl: string): Promise<boolean> {
    try {
        const c = new AbortController();
        const t = setTimeout(() => c.abort(), 3000);
        const res = await fetch(`${apiUrl}/health`, { signal: c.signal });
        clearTimeout(t);
        return res.ok;
    } catch { return false; }
}

export async function startDocker(composePath: string): Promise<boolean> {
    return new Promise(resolve => {
        const dir = composePath || process.cwd();
        cp.exec(`docker compose -f "${dir}/docker-compose.yml" up -d`, { timeout: 120000 }, (err) => {
            resolve(!err);
        });
    });
}

export function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
