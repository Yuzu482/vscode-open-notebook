import * as vscode from 'vscode';

const zhCN: Record<string, string> = {
    'status.connected': 'Open Notebook',
    'status.offline': 'Open Notebook (离线)',
    'status.tooltip.on': '已连接',
    'status.tooltip.off': '无法连接 API',

    'notebook.create.title': '新建笔记本',
    'notebook.create.prompt': '名称',
    'notebook.create.placeholder': '我的研究',
    'notebook.create.desc': '描述（可选）',
    'notebook.create.descPlaceholder': '简要描述研究内容...',
    'notebook.create.success': '已创建「{0}」',
    'notebook.create.error': '创建失败: {0}',
    'notebook.create.validate': '名称不能为空',

    'notebook.delete.confirm': '确定删除「{0}」吗？此操作不可撤销。',
    'notebook.delete.btn': '确认删除',
    'notebook.delete.success': '已删除',
    'notebook.delete.error': '删除失败: {0}',

    'notebook.open.title': '选择操作...',
    'notebook.open.viewSources': '查看资料',
    'notebook.open.viewNotes': '查看笔记',
    'notebook.open.chat': '对话',
    'notebook.open.addSource': '添加资料',
    'notebook.open.addNote': '添加笔记',

    'source.select': '选择要查看的资料...',
    'source.none': '暂无资料，请先添加',
    'source.listTitle': '资料列表',

    'note.select': '选择要查看的笔记...',
    'note.none': '暂无笔记',
    'note.listTitle': '笔记列表',

    'note.create.title': '新建笔记 - {0}',
    'note.create.prompt': '笔记标题',
    'note.create.placeholder': '我的笔记',
    'note.create.content': '笔记内容',
    'note.create.contentPrompt': '输入笔记正文...',
    'note.create.validate': '标题不能为空',
    'note.create.success': '笔记已创建',
    'note.create.error': '创建失败: {0}',

    'source.add.title': '添加资料到 {0}',
    'source.add.type': '选择资料类型...',
    'source.add.url': 'URL 链接',
    'source.add.text': '文本内容',
    'source.add.urlTitle': '添加 URL',
    'source.add.urlPrompt': '输入网址',
    'source.add.urlPlaceholder': 'https://example.com',
    'source.add.urlValidate': '请输入 URL',
    'source.add.titleLabel': '标题（可选）',
    'source.add.titlePlaceholder': '文章标题',
    'source.add.textTitle': '添加文本资料',
    'source.add.textPlaceholder': '资料标题',
    'source.add.textContent': '文本内容',
    'source.add.textContentPrompt': '粘贴或输入文本内容...',
    'source.add.textContentValidate': '内容不能为空',
    'source.add.success': '资料已添加',
    'source.add.error': '添加失败: {0}',

    'chat.title': '对话: {0}',
    'chat.prompt': '输入消息（Esc 退出）',
    'chat.placeholder': '向 AI 提问...',
    'chat.thinking': '思考中...',
    'chat.you': '你',
    'chat.ai': 'AI',
    'chat.error': '错误: {0}',

    'search.title': '搜索笔记本',
    'search.prompt': '输入搜索关键词',
    'search.placeholder': '跨所有笔记本搜索...',
    'search.searching': '搜索中...',
    'search.noResults': '未找到结果',
    'search.results': '共 {0} 条结果',
    'search.failed': '搜索失败: {0}',

    'ai.config.title': '配置 AI 提供商',
    'ai.config.placeholder': '选择你的 AI 提供商...',
    'ai.config.ollamaTitle': 'Ollama 地址',
    'ai.config.ollamaPrompt': 'Ollama API 地址',
    'ai.config.apiKeyTitle': ' API Key',
    'ai.config.apiKeyPrompt': '粘贴你的 API Key',
    'ai.config.apiKeyPlaceholder': 'sk-...',
    'ai.config.apiKeyValidate': 'API Key 不能为空',
    'ai.config.discovering': '正在发现 {0} 的模型...',
    'ai.config.success': '{0} 已配置，注册了 {1} 个模型',
    'ai.config.ollamaSuccess': 'Ollama 已配置',
    'ai.config.failed': '配置失败: {0}',

    'import.selectNb': '导入到哪个笔记本？',
    'import.currentSuccess': '「{0}」已导入「{1}」',
    'import.batchTitle': '导入 {0} 个文件到哪个笔记本？',
    'import.batchSuccess': '已导入 {0}/{1} 个文件到「{2}」',
    'import.noFile': '没有打开的文件',
    'import.noNb': '请先创建一个笔记本',
    'import.error': '导入失败: {0}',

    'setup.welcome': '欢迎使用 Open Notebook！',
    'setup.dockerCheck': '检测到 Docker 未安装或未运行',
    'setup.dockerOk': 'Docker 运行正常',
    'setup.apiCheck': 'API 连接正常',
    'setup.apiFail': '无法连接 Open Notebook API，正在尝试启动...',
    'setup.starting': '正在启动 Open Notebook 服务...',
    'setup.started': '服务已启动',
    'setup.complete': '所有依赖已就绪',
    'setup.composeNotFound': '未找到 docker-compose.yml，请先配置路径',

    'tree.sources': '资料 ({0})',
    'tree.notes': '笔记 ({0})',

    'provider.openai': 'OpenAI',
    'provider.anthropic': 'Anthropic',
    'provider.deepseek': 'DeepSeek',
    'provider.google': 'Google Gemini',
    'provider.groq': 'Groq (免费额度)',
    'provider.ollama': 'Ollama (本地免费)',
    'provider.mistral': 'Mistral',
    'provider.xai': 'xAI (Grok)',
    'provider.openrouter': 'OpenRouter',
};

const en: Record<string, string> = {
    'status.connected': 'Open Notebook',
    'status.offline': 'Open Notebook (offline)',
    'status.tooltip.on': 'Connected',
    'status.tooltip.off': 'Cannot reach API',

    'notebook.create.title': 'New Notebook',
    'notebook.create.prompt': 'Name',
    'notebook.create.placeholder': 'My Research',
    'notebook.create.desc': 'Description (optional)',
    'notebook.create.descPlaceholder': 'Brief description...',
    'notebook.create.success': 'Created "{0}"',
    'notebook.create.error': 'Create failed: {0}',
    'notebook.create.validate': 'Name is required',

    'notebook.delete.confirm': 'Delete "{0}"? This cannot be undone.',
    'notebook.delete.btn': 'Delete',
    'notebook.delete.success': 'Deleted',
    'notebook.delete.error': 'Delete failed: {0}',

    'notebook.open.title': 'Choose action...',
    'notebook.open.viewSources': 'View Sources',
    'notebook.open.viewNotes': 'View Notes',
    'notebook.open.chat': 'Chat',
    'notebook.open.addSource': 'Add Source',
    'notebook.open.addNote': 'Add Note',

    'source.select': 'Select a source...',
    'source.none': 'No sources yet.',
    'source.listTitle': 'Sources',

    'note.select': 'Select a note...',
    'note.none': 'No notes yet.',
    'note.listTitle': 'Notes',

    'note.create.title': 'New Note — {0}',
    'note.create.prompt': 'Note title',
    'note.create.placeholder': 'My Note',
    'note.create.content': 'Content',
    'note.create.contentPrompt': 'Enter note content...',
    'note.create.validate': 'Title is required',
    'note.create.success': 'Note created',
    'note.create.error': 'Create failed: {0}',

    'source.add.title': 'Add Source to {0}',
    'source.add.type': 'Select source type...',
    'source.add.url': 'URL Link',
    'source.add.text': 'Text Content',
    'source.add.urlTitle': 'Add URL',
    'source.add.urlPrompt': 'Enter URL',
    'source.add.urlPlaceholder': 'https://example.com',
    'source.add.urlValidate': 'URL is required',
    'source.add.titleLabel': 'Title (optional)',
    'source.add.titlePlaceholder': 'Article title',
    'source.add.textTitle': 'Add Text Source',
    'source.add.textPlaceholder': 'Source title',
    'source.add.textContent': 'Content',
    'source.add.textContentPrompt': 'Paste or type text content...',
    'source.add.textContentValidate': 'Content is required',
    'source.add.success': 'Source added',
    'source.add.error': 'Add failed: {0}',

    'chat.title': 'Chat: {0}',
    'chat.prompt': 'Type message (Esc to exit)',
    'chat.placeholder': 'Ask the AI...',
    'chat.thinking': 'Thinking...',
    'chat.you': 'You',
    'chat.ai': 'AI',
    'chat.error': 'Error: {0}',

    'search.title': 'Search Notebooks',
    'search.prompt': 'Enter search query',
    'search.placeholder': 'Search across all notebooks...',
    'search.searching': 'Searching...',
    'search.noResults': 'No results found',
    'search.results': '{0} results',
    'search.failed': 'Search failed: {0}',

    'ai.config.title': 'Configure AI Provider',
    'ai.config.placeholder': 'Select your AI provider...',
    'ai.config.ollamaTitle': 'Ollama URL',
    'ai.config.ollamaPrompt': 'Ollama API URL',
    'ai.config.apiKeyTitle': ' API Key',
    'ai.config.apiKeyPrompt': 'Paste your API Key',
    'ai.config.apiKeyPlaceholder': 'sk-...',
    'ai.config.apiKeyValidate': 'API Key is required',
    'ai.config.discovering': 'Discovering {0} models...',
    'ai.config.success': '{0} configured, {1} models registered',
    'ai.config.ollamaSuccess': 'Ollama configured',
    'ai.config.failed': 'Configuration failed: {0}',

    'import.selectNb': 'Import to which notebook?',
    'import.currentSuccess': '"{0}" imported to "{1}"',
    'import.batchTitle': 'Import {0} files to which notebook?',
    'import.batchSuccess': 'Imported {0}/{1} files to "{2}"',
    'import.noFile': 'No file is open',
    'import.noNb': 'Please create a notebook first',
    'import.error': 'Import failed: {0}',

    'setup.welcome': 'Welcome to Open Notebook!',
    'setup.dockerCheck': 'Docker not detected or not running',
    'setup.dockerOk': 'Docker is running',
    'setup.apiCheck': 'API connected',
    'setup.apiFail': 'Cannot reach Open Notebook API, attempting to start...',
    'setup.starting': 'Starting Open Notebook services...',
    'setup.started': 'Services started',
    'setup.complete': 'All dependencies ready',
    'setup.composeNotFound': 'docker-compose.yml not found, please configure path',

    'tree.sources': 'Sources ({0})',
    'tree.notes': 'Notes ({0})',

    'provider.openai': 'OpenAI',
    'provider.anthropic': 'Anthropic',
    'provider.deepseek': 'DeepSeek',
    'provider.google': 'Google Gemini',
    'provider.groq': 'Groq (free tier)',
    'provider.ollama': 'Ollama (local, free)',
    'provider.mistral': 'Mistral',
    'provider.xai': 'xAI (Grok)',
    'provider.openrouter': 'OpenRouter',
};

let currentLang: 'zh-cn' | 'en' = 'zh-cn';

export function setLanguage(lang: string) {
    if (lang === 'en') { currentLang = 'en'; } else { currentLang = 'zh-cn'; }
}

export function getLanguage(): string { return currentLang; }

export function t(key: string, ...args: (string | number)[]): string {
    const dict = currentLang === 'en' ? en : zhCN;
    let msg = dict[key] || en[key] || key;
    args.forEach((a, i) => { msg = msg.replace(`{${i}}`, String(a)); });
    return msg;
}

export const SUPPORTED_LANGS = [
    { label: '中文', value: 'zh-cn' },
    { label: 'English', value: 'en' },
];

export const PROVIDERS = [
    { label: 'OpenAI', detail: 'api.openai.com', provider: 'openai' },
    { label: 'Anthropic', detail: 'api.anthropic.com', provider: 'anthropic' },
    { label: 'DeepSeek', detail: 'api.deepseek.com', provider: 'deepseek' },
    { label: 'Google Gemini', detail: 'generativelanguage.googleapis.com', provider: 'google' },
    { label: 'Groq', detail: 'api.groq.com', provider: 'groq' },
    { label: 'Ollama', detail: 'localhost:11434', provider: 'ollama' },
    { label: 'Mistral', detail: 'api.mistral.ai', provider: 'mistral' },
    { label: 'xAI (Grok)', detail: 'api.x.ai', provider: 'xai' },
    { label: 'OpenRouter', detail: 'openrouter.ai', provider: 'openrouter' },
];
