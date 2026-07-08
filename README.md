# Open Notebook VS Code Extension

[![VS Code](https://img.shields.io/badge/VS%20Code-1.85%2B-blue)](https://code.visualstudio.com/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Open Notebook](https://img.shields.io/badge/powered%20by-Open%20Notebook-orange)](https://github.com/lfnovo/open-notebook)

> 🔌 A companion VS Code extension for [Open Notebook](https://github.com/lfnovo/open-notebook) — the open-source Notebook LM alternative by [lfnovo](https://github.com/lfnovo). This extension is **not** a fork; it is an independent client that communicates with Open Notebook via its REST API.

> 🌐 [中文](#中文) | [English](#english)

A native VS Code extension that integrates [Open Notebook](https://github.com/lfnovo/open-notebook) — the open-source Notebook LM alternative — directly into your editor sidebar. No browser needed.

---

## English

### Features

- 📓 **Sidebar TreeView** — Browse notebooks, sources, and notes natively
- 📄 **Virtual Documents** — View sources and notes in VS Code's built-in editor
- 💬 **AI Chat** — Chat with your research using QuickPick + Output panel
- 🔍 **Full-Text Search** — Search across all notebooks
- 🔑 **Built-in AI Config** — Configure OpenAI, Anthropic, DeepSeek, Ollama, etc. without leaving VS Code
- ☁️ **One-Click Import** — Right-click any file → Import to notebook
- 🌐 **Bilingual** — Chinese / English switchable
- 🔧 **Auto-Setup** — Detects Docker, auto-starts Open Notebook on new devices
- ⚙️ **Configurable** — Custom API URL, compose path, auto-start options

### Quick Start

#### Prerequisites
- VS Code 1.85+
- Docker Desktop
- [Open Notebook](https://github.com/lfnovo/open-notebook) (auto-detected or configurable)

#### Install

```bash
# Download the .vsix from Releases, then:
code --install-extension on-sidebar-2.0.0.vsix --force
```

#### Or Build from Source

```bash
git clone https://github.com/Yuzu482/vscode-open-notebook.git
cd vscode-open-notebook
npm install
npx tsc -p ./
npx vsce package --allow-missing-repository --skip-license
code --install-extension on-sidebar-2.0.0.vsix --force
```

#### Setup

1. Press `Ctrl+,` → search `openNotebook`
2. Set `dockerComposePath` to your Open Notebook project folder (e.g., `E:\OpenNotebook`)
3. Click 🔧 **Environment Check** in the sidebar toolbar
4. The extension will auto-detect Docker, start services, and verify API connectivity

#### Usage

| Action | How |
|--------|-----|
| Create Notebook | Click `+` in sidebar toolbar |
| Add Source | Right-click notebook → Add Source (URL or text) |
| Import File | Right-click any file in Explorer → Import to Notebook |
| AI Chat | Right-click notebook → AI Chat |
| Search | Click 🔍 in toolbar |
| Configure AI | Click 🔑 in toolbar → select provider → enter API key |

### Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `openNotebook.apiUrl` | `http://localhost:5055` | REST API address |
| `openNotebook.language` | `zh-cn` | UI language (`zh-cn` / `en`) |
| `openNotebook.autoStartDocker` | `false` | Auto-start Docker on VS Code launch |
| `openNotebook.dockerComposePath` | `""` | Path to docker-compose.yml directory |

### Architecture

```
src/
├── extension.ts    # Main entry, command registration
├── api.ts          # REST API client for Open Notebook
├── treeView.ts     # Sidebar tree + virtual document provider
├── i18n.ts         # Chinese/English language system
└── setup.ts        # Environment checker + Docker auto-start
```

The extension calls Open Notebook's REST API (`localhost:5055`) directly — no webviews, no iframes. All UI is native VS Code (TreeView, QuickPick, InputBox, Virtual Documents).

---

## 中文

### 功能

- 📓 **侧边栏树视图** — 原生浏览笔记本、资料、笔记
- 📄 **虚拟文档** — 在 VS Code 内置编辑器中查看资料和笔记
- 💬 **AI 对话** — 通过 QuickPick + 输出面板与 AI 对话
- 🔍 **全文搜索** — 跨所有笔记本搜索
- 🔑 **内置 AI 配置** — 不离开 VS Code 即可配置 OpenAI、DeepSeek、Ollama 等
- ☁️ **一键导入** — 右键任意文件 → 导入到笔记本
- 🌐 **中英双语** — 一键切换中文/英文界面
- 🔧 **自动构建** — 检测 Docker 环境，新设备上自动启动 Open Notebook
- ⚙️ **可配置** — 自定义 API 地址、compose 路径、自动启动选项

### 快速开始

#### 前置条件
- VS Code 1.85+
- Docker Desktop
- [Open Notebook](https://github.com/lfnovo/open-notebook)（自动检测或手动配置路径）

#### 安装

```bash
# 从 Releases 下载 .vsix，然后：
code --install-extension on-sidebar-2.0.0.vsix --force
```

#### 或从源码构建

```bash
git clone https://github.com/Yuzu482/vscode-open-notebook.git
cd vscode-open-notebook
npm install
npx tsc -p ./
npx vsce package --allow-missing-repository --skip-license
code --install-extension on-sidebar-2.0.0.vsix --force
```

#### 初始化

1. 按 `Ctrl+,` → 搜索 `openNotebook`
2. 设置 `dockerComposePath` 为 Open Notebook 项目目录（如 `E:\OpenNotebook`）
3. 点击侧边栏工具栏的 🔧 **环境检测 & 自动构建**
4. 扩展会自动检测 Docker、启动服务并验证 API 连通性

#### 使用

| 操作 | 方式 |
|------|------|
| 创建笔记本 | 点击侧边栏 `+` |
| 添加资料 | 右键笔记本 → 添加资料（URL 或文本） |
| 导入文件 | 在资源管理器右键文件 → 导入到笔记本 |
| AI 对话 | 右键笔记本 → AI 对话 |
| 搜索 | 点击 🔍 |
| 配置 AI | 点击 🔑 → 选择提供商 → 输入 API Key |

### 配置项

| 设置 | 默认值 | 说明 |
|------|------|------|
| `openNotebook.apiUrl` | `http://localhost:5055` | REST API 地址 |
| `openNotebook.language` | `zh-cn` | 界面语言 |
| `openNotebook.autoStartDocker` | `false` | 启动 VS Code 时自动拉起 Docker |
| `openNotebook.dockerComposePath` | `""` | docker-compose.yml 所在目录 |

### 架构

```
src/
├── extension.ts    # 主入口，命令注册
├── api.ts          # Open Notebook REST API 客户端
├── treeView.ts     # 侧边栏树视图 + 虚拟文档提供器
├── i18n.ts         # 中英文语言系统
└── setup.ts        # 环境检测 + Docker 自动启动
```

扩展直接调用 Open Notebook 的 REST API（`localhost:5055`），不使用 webview 或 iframe。所有 UI 均为 VS Code 原生组件（TreeView、QuickPick、InputBox、虚拟文档）。

---

## Attribution / 归属声明

This project is a **companion extension** for [Open Notebook](https://github.com/lfnovo/open-notebook) by [lfnovo](https://github.com/lfnovo) and [contributors](https://github.com/lfnovo/open-notebook/graphs/contributors). Open Notebook is MIT licensed. This extension is an independent work that interacts with Open Notebook solely through its public REST API. No code from Open Notebook is included or modified.

本项目是 [Open Notebook](https://github.com/lfnovo/open-notebook) 的**配套扩展**，由 [lfnovo](https://github.com/lfnovo) 及[贡献者](https://github.com/lfnovo/open-notebook/graphs/contributors)开发。Open Notebook 使用 MIT 协议。本扩展为独立作品，仅通过 Open Notebook 的公开 REST API 进行交互，未包含或修改任何 Open Notebook 代码。

## License / 协议

MIT — see [Open Notebook](https://github.com/lfnovo/open-notebook) for the backend project.
