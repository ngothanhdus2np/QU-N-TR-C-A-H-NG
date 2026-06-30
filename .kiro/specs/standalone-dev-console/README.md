# 🚀 Standalone Dev Console with Multi-Agent System

## 📋 TỔNG QUAN

**Standalone Dev Console** là một web application độc lập để quản lý và tương tác với hệ thống Multi-Agent AI, hỗ trợ:

- ✅ Quản lý nhiều projects
- ✅ Xoay tua nhiều AI API keys (Claude, GPT, Codex...)
- ✅ Chat với AI agents real-time
- ✅ Monitor tasks và logs
- ✅ Direct file system access
- ✅ Git integration
- ✅ Code editing & diffing

---

## 🎯 FEATURES CHÍNH

### 1. Project Management
- Quản lý nhiều projects từ 1 console
- Auto-detect project type (React, Node, Python...)
- Project health monitoring

### 2. AI Provider Rotation
- Auto-rotate giữa nhiều API keys
- Rate limit tracking
- Cost optimization
- Fallback when rate limited

### 3. Multi-Agent System
- Kiro (Orchestrator)
- Claude Code (Analyzer)
- Codex (Developer)
- Bug Hunter
- Security Scanner
- Performance Analyzer

### 4. Real-time Collaboration
- WebSocket cho updates instant
- Live logs streaming
- Task progress tracking

### 5. Code Management
- File explorer với syntax highlighting
- Inline code editor
- Diff viewer
- Git operations

---

## 📁 PROJECT STRUCTURE

```
standalone-dev-console/
├── README.md
├── package.json
├── .env.example
├── .gitignore
│
├── frontend/                   # React + TypeScript + Vite
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── ProjectSelector.tsx
│   │   │   ├── ChatPanel.tsx
│   │   │   ├── TaskMonitor.tsx
│   │   │   ├── LogsViewer.tsx
│   │   │   ├── FileExplorer.tsx
│   │   │   ├── CodeEditor.tsx
│   │   │   ├── DiffViewer.tsx
│   │   │   └── ProviderStatus.tsx
│   │   ├── hooks/
│   │   │   ├── useProject.ts
│   │   │   ├── useAgent.ts
│   │   │   ├── useTasks.ts
│   │   │   └── useLogs.ts
│   │   ├── api/
│   │   │   ├── client.ts
│   │   │   └── socket.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   └── styles/
│   │       └── global.css
│   └── public/
│
├── backend/                    # Node.js + Express + TypeScript
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── server.ts
│   │   ├── config/
│   │   │   ├── index.ts
│   │   │   └── projects.ts
│   │   ├── agents/
│   │   │   ├── base/
│   │   │   │   └── Agent.ts
│   │   │   ├── Kiro.ts              # Orchestrator
│   │   │   ├── ClaudeCode.ts        # Analyzer
│   │   │   ├── Codex.ts             # Developer
│   │   │   ├── BugHunter.ts
│   │   │   ├── SecurityScanner.ts
│   │   │   └── PerformanceAnalyzer.ts
│   │   ├── services/
│   │   │   ├── AIProvider.ts        # ⭐ AI Rotation System
│   │   │   ├── FileSystem.ts        # File operations
│   │   │   ├── GitService.ts        # Git operations
│   │   │   ├── ProjectManager.ts    # Multi-project
│   │   │   ├── TaskQueue.ts         # Task management
│   │   │   └── LogManager.ts        # Logging
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
│   └── dist/
│
├── shared/                     # Shared types & utils
│   ├── types/
│   │   ├── agent.ts
│   │   ├── project.ts
│   │   └── provider.ts
│   └── utils/
│       └── validators.ts
│
└── .kiro-config.json          # User configuration
```

---

## 📚 DOCUMENTS

### Core Specs
1. [Requirements](./requirements.md) - Functional & technical requirements
2. [Architecture](./architecture.md) - System architecture & data flow
3. [AI Provider Rotation](./ai-rotation.md) - Multi-key rotation system
4. [Multi-Agent System](./agents.md) - Agent roles & communication

### Implementation Guides
5. [Setup Guide](./setup-guide.md) - Quick start từng bước
6. [API Reference](./api-reference.md) - Backend API documentation
7. [Component Guide](./components.md) - Frontend components
8. [Deployment](./deployment.md) - Deploy lên production

### Advanced Topics
9. [Token Management](./token-management.md) - Optimize token usage
10. [Security](./security.md) - Security best practices
11. [Performance](./performance.md) - Performance optimization
12. [Testing](./testing.md) - Testing strategy

---

## ⚡ QUICK START

### Prerequisites
```bash
- Node.js >= 18
- npm hoặc yarn
- Git
- AI API keys (Claude/OpenAI)
```

### Installation
```bash
# Clone project
git clone <repo-url>
cd standalone-dev-console

# Install dependencies
npm run install:all

# Copy env file
cp .env.example .env.local

# Configure projects & API keys
nano .kiro-config.json

# Start development
npm run dev
```

### Access
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`

---

## 🎯 ROADMAP

### Phase 1: Foundation (Week 1-2)
- [x] Project structure
- [x] Basic backend API
- [x] AI Provider rotation
- [x] Frontend UI skeleton

### Phase 2: Core Features (Week 3-4)
- [ ] Chat interface
- [ ] Task management
- [ ] File explorer
- [ ] Agent coordination

### Phase 3: Advanced Features (Week 5-6)
- [ ] Code editor
- [ ] Diff viewer
- [ ] Git integration
- [ ] Multi-project support

### Phase 4: Polish (Week 7-8)
- [ ] Performance optimization
- [ ] Testing
- [ ] Documentation
- [ ] Deployment

---

## 🤝 CONTRIBUTING

Contributions are welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) first.

---

## 📄 LICENSE

MIT License - See [LICENSE](./LICENSE)

---

## 📞 SUPPORT

- Documentation: [docs/](./docs/)
- Issues: [GitHub Issues](https://github.com/...)
- Discord: [Join our server](https://discord.gg/...)

---

**Built with ❤️ for developers by developers**
