# 🎯 MASTER PROMPT - Standalone Dev Console

## 📋 TỔNG QUAN DỰ ÁN

Bạn là senior full-stack developer được yêu cầu implement một **Standalone Dev Console** - một web application để quản lý development với AI Multi-Agent System và khả năng xoay tua nhiều AI API keys.

### Mục đích:
1. Quản lý nhiều projects từ 1 console
2. Xoay tua tự động giữa nhiều AI API keys (Claude, GPT-4, GPT-3.5)
3. Chat với AI agents real-time
4. Monitor tasks, logs, và provider usage
5. Direct file system access
6. Git integration

### Core Value Proposition:
- **10x throughput**: 10 API keys = 400k tokens/phút thay vì 40k
- **Cost optimization**: Dùng model phù hợp cho từng task
- **High availability**: Auto-failover khi 1 provider down
- **Multi-project**: Quản lý nhiều projects từ 1 interface

---

## 🏗️ TECH STACK & ARCHITECTURE

### Tech Stack:
```
Backend:
- Node.js 18+
- TypeScript (strict mode)
- Express.js
- Socket.IO (WebSocket)
- @anthropic-ai/sdk
- openai SDK
- chokidar (file watching)
- simple-git (Git operations)

Frontend:
- React 19
- TypeScript
- Vite
- Framer Motion (animations)
- React Markdown
- React Syntax Highlighter
- Socket.IO Client
- Monaco Editor (code editor)

Config & Storage:
- dotenv (.env.local for secrets)
- JSON config (.kiro-config.json)
- IndexedDB (client storage)
```

### Architecture:
```
┌─────────────────────────────────────────────────────┐
│        Standalone Dev Console (Web App)             │
├─────────────────────────────────────────────────────┤
│  Frontend (React) - Port 5173                       │
│  • Project Selector                                 │
│  • Chat Interface                                   │
│  • Task Monitor                                     │
│  • Provider Dashboard                               │
│  • Logs Viewer                                      │
└─────────────────────────────────────────────────────┘
              ↕ WebSocket + REST API
┌─────────────────────────────────────────────────────┐
│  Backend (Node.js) - Port 3000                      │
│  ┌───────────────────────────────────────────────┐ │
│  │  AI Provider Rotation Manager (CORE)          │ │
│  │  • Auto-rotate giữa nhiều API keys            │ │
│  │  • Rate limit tracking                        │ │
│  │  • Cost tracking                              │ │
│  │  • Auto-fallback                              │ │
│  └───────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────┐ │
│  │  Multi-Agent System                           │ │
│  │  • Kiro (Orchestrator)                        │ │
│  │  • Claude Code (Analyzer)                     │ │
│  │  • Codex (Developer)                          │ │
│  │  • Bug Hunter, Security, Performance...       │ │
│  └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
              ↕ Direct File System Access
┌─────────────────────────────────────────────────────┐
│  Projects (Multiple)                                │
│  • /Users/apple/phucsang app/QU-N-TR-C-A-H-NG/     │
│  • /Users/apple/other-project/                      │
└─────────────────────────────────────────────────────┘
```

---

## 📁 PROJECT STRUCTURE (CHI TIẾT)

```
standalone-dev-console/
├── package.json (root - scripts: install:all, dev, build)
├── .gitignore
├── .env.example
├── .env.local (không commit, chứa API keys)
├── .kiro-config.json (project & provider config)
├── README.md
│
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── server.ts (main entry)
│   │   ├── config/
│   │   │   └── index.ts (load .env + .kiro-config)
│   │   ├── services/
│   │   │   ├── AIProvider.ts ⭐ CORE - AI Rotation
│   │   │   ├── FileSystem.ts
│   │   │   ├── GitService.ts
│   │   │   ├── ProjectManager.ts
│   │   │   ├── TaskQueue.ts
│   │   │   └── LogManager.ts
│   │   ├── agents/
│   │   │   ├── base/Agent.ts
│   │   │   ├── Kiro.ts
│   │   │   ├── ClaudeCode.ts
│   │   │   ├── Codex.ts
│   │   │   ├── BugHunter.ts
│   │   │   └── SecurityScanner.ts
│   │   ├── routes/
│   │   │   ├── projects.ts
│   │   │   ├── agents.ts
│   │   │   ├── tasks.ts
│   │   │   ├── files.ts
│   │   │   └── providers.ts
│   │   ├── websocket/
│   │   │   └── index.ts
│   │   └── types/
│   │       └── index.ts
│   └── dist/ (build output)
│
└── frontend/
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── index.html
    ├── src/
    │   ├── main.tsx
    │   ├── App.tsx
    │   ├── components/
    │   │   ├── Sidebar.tsx
    │   │   ├── ProjectSelector.tsx
    │   │   ├── ChatPanel.tsx
    │   │   ├── TaskMonitor.tsx
    │   │   ├── LogsViewer.tsx
    │   │   ├── FileExplorer.tsx
    │   │   └── ProviderDashboard.tsx
    │   ├── hooks/
    │   │   ├── useProject.ts
    │   │   ├── useChat.ts
    │   │   ├── useTasks.ts
    │   │   ├── useLogs.ts
    │   │   └── useProviders.ts
    │   ├── api/
    │   │   ├── client.ts
    │   │   └── socket.ts
    │   ├── types/
    │   │   └── index.ts
    │   └── styles/
    │       └── global.css
    └── dist/ (build output)
```

---

## 🎯 IMPLEMENTATION PRIORITIES

