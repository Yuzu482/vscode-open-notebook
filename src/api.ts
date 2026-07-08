import * as vscode from 'vscode';

const BASE_URL = 'http://localhost:5055/api';

// ---- Types ----

export interface Notebook {
    id: string;
    name: string;
    description?: string;
    archived?: boolean;
    created?: string;
    updated?: string;
}

export interface Source {
    id: string;
    title?: string;
    type?: string;
    notebook_id: string;
    content_type?: string;
    created?: string;
    status?: string;
}

export interface Note {
    id: string;
    title?: string;
    content?: string;
    notebook_id: string;
    created?: string;
    updated?: string;
}

export interface ChatSession {
    id: string;
    notebook_id: string;
    name?: string;
}

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

// ---- API Client ----

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${BASE_URL}${path}`;
    const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json', ...options.headers as Record<string, string> },
        ...options,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || `HTTP ${res.status}`);
    }
    return res.json();
}

// Notebooks
export async function listNotebooks(archived = false): Promise<Notebook[]> {
    return request(`/notebooks?archived=${archived}&order_by=updated+desc`);
}

export async function createNotebook(name: string, desc: string): Promise<Notebook> {
    return request('/notebooks', { method: 'POST', body: JSON.stringify({ name, description: desc }) });
}

export async function deleteNotebook(id: string): Promise<void> {
    await request(`/notebooks/${id}`, { method: 'DELETE' });
}

// Sources
export async function listSources(notebookId: string): Promise<Source[]> {
    return request(`/sources?notebook_id=${notebookId}`);
}

export async function getSource(id: string): Promise<Source & { content?: string }> {
    return request(`/sources/${id}`);
}

// Notes
export async function listNotes(notebookId: string): Promise<Note[]> {
    return request(`/notes?notebook_id=${notebookId}`);
}

export async function getNote(id: string): Promise<Note> {
    return request(`/notes/${id}`);
}

export async function createNote(notebookId: string, title: string, content: string): Promise<Note> {
    return request('/notes', {
        method: 'POST',
        body: JSON.stringify({ notebook_id: notebookId, title, content }),
    });
}

// Chat
export async function createChatSession(notebookId: string): Promise<ChatSession> {
    return request('/chat/sessions', {
        method: 'POST',
        body: JSON.stringify({ notebook_id: notebookId }),
    });
}

export async function chatExecute(sessionId: string, message: string): Promise<{ response: string }> {
    return request('/chat/execute', {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId, message }),
    });
}

// Search
export async function search(query: string): Promise<{ results: any[] }> {
    return request('/search', { method: 'POST', body: JSON.stringify({ query, search_type: 'text' }) });
}

// Health
export async function healthCheck(): Promise<boolean> {
    try {
        const res = await fetch(`${BASE_URL.replace('/api', '')}/health`);
        return res.ok;
    } catch {
        return false;
    }
}
