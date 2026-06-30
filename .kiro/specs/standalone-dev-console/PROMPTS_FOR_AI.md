# 🤖 Prompts để ra lệnh cho AI Models

## 📋 TỔNG QUAN

File này chứa các prompts chuẩn để bạn copy-paste và yêu cầu AI models khác (Claude, GPT-4, Codex...) implement từng phần của hệ thống Standalone Dev Console.

---

## 🎯 CHIẾN LƯỢC CHIA VIỆC

### Approach: Chia nhỏ thành 10 tasks

```
Task 1: Project Setup & Structure          → Claude/GPT-4
Task 2: Backend API Foundation             → Claude/GPT-4
Task 3: AI Provider Rotation Core          → Claude (QUAN TRỌNG)
Task 4: Config Loader                      → GPT-4/Codex
Task 5: WebSocket Server                   → GPT-4/Codex
Task 6: Frontend Setup & UI Skeleton       → GPT-4/Copilot
Task 7: Chat Interface                     → GPT-4/Copilot
Task 8: Provider Dashboard                 → GPT-4/Copilot
Task 9: Testing & Integration              → Claude/GPT-4
Task 10: Documentation & Polish            → Claude/GPT-4
```

---

## 📝 TASK 1: PROJECT SETUP

### Prompt cho Claude/GPT-4:

```
Tôi cần tạo cấu trúc project cho một Standalone Dev Console với AI Multi-Agent System. 

Requirements:
1. Tạo mono-repo structure với:
   - backend/ (Node.js + TypeScript + Express)
   - frontend/ (React + TypeScript + Vite)
   - shared/ (Shared types)

2. Dependencies cần thiết:
   Backend:
   - express, cors, dotenv
   - @anthropic-ai/sdk, openai
   - socket.io
   - typescript, tsx, nodemon

   Frontend:
   - react, react-dom
   - vite, @vitejs/plugin-react
   - framer-motion, react-markdown
   - socket.io-client

3. Config files:
   - tsconfig.json cho backend & frontend
   - vite.config.ts với proxy đến backend
   - package.json cho root, backend, frontend
   - .gitignore chuẩn

4. Scripts:
   - npm run install:all - Install tất cả dependencies
   - npm run dev - Start cả backend & frontend
   - npm run build - Build production

Hãy tạo đầy đủ:
- Folder structure
- All config files
- package.json với đúng dependencies
- README.md cơ bản

Sử dụng best practices cho TypeScript + Node.js + React.
```

**Expected Output**: Complete project structure với tất cả config files

---

## 📝 TASK 2: BACKEND API FOUNDATION

### Prompt cho Claude/GPT-4:

```
Tôi cần implement backend foundation cho Dev Console.

Context:
- Backend sử dụng Express + TypeScript
- Port: 3000
- Cần CORS cho frontend (port 5173)
- Cần REST API và WebSocket

Requirements:

1. File `backend/src/server.ts`:
   - Setup Express app
   - Enable CORS
   - JSON body parser
   - Health check endpoint: GET /health
   - Create HTTP server
   - Listen on port 3000
   - Placeholder cho WebSocket setup

2. File `backend/src/types/index.ts`:
   - Define core types:
     * Project
     * AIProvider
     * Task
     * Message
     * LogEntry

3. Route structure:
   - backend/src/routes/projects.ts
   - backend/src/routes/agents.ts
   - backend/src/routes/providers.ts
   - backend/src/routes/tasks.ts

   Mỗi route file có placeholder cho:
   - GET /api/{resource}
   - GET /api/{resource}/:id
   - POST /api/{resource}
   - PUT /api/{resource}/:id
   - DELETE /api/{resource}/:id

4. Error handling middleware

Implement đầy đủ với TypeScript types, error handling, và logging.
```

**Expected Output**: Backend server có thể start và response health check

---

## 📝 TASK 3: AI PROVIDER ROTATION (CORE)

### Prompt cho Claude (QUAN TRỌNG):

```
Tôi cần implement AI Provider Rotation System - đây là CORE FEATURE quan trọng nhất.

Context:
- Hệ thống cần xoay tua giữa nhiều AI API keys (Claude, GPT-4, GPT-3.5)
- Tự động skip providers đã rate limited
- Track usage và cost
- Support 4 rotation strategies: round_robin, priority, cost, smart

Requirements:

1. File `backend/src/services/AIProvider.ts`:

Implement class `AIProviderRotation` với:

**Properties**:
- providers: Map<string, Provider>
- currentIndex: number
- strategy: 'round_robin' | 'priority' | 'cost' | 'smart'

**Methods**:
- constructor(config): Load providers từ config
- startResetTimer(): Reset usage counters mỗi 60s
- selectProvider(task?): Chọn provider theo strategy
- isProviderAvailable(provider): Check rate limits
- callAI(prompt, options): Main method, auto-rotation
- callClaude(provider, prompt, options): Call Anthropic API
- callOpenAI(provider, prompt, options): Call OpenAI API
- getProviderStats(): Return usage statistics
- setProviderStatus(id, status): Enable/disable provider

**Provider Interface**:
```typescript
interface Provider {
  id: string;
  name: string;
  type: 'anthropic' | 'openai';
  model: string;
  apiKey: string;
  priority: number;
  rateLimit: {
    tokensPerMinute: number;
    requestsPerMinute: number;
  };
  usage: {
    tokensUsed: number;
    requestsUsed: number;
    lastReset: Date;
  };
  status: 'active' | 'rate_limited' | 'error' | 'disabled';
  cost: {
    inputTokenCost: number;
    outputTokenCost: number;
    totalSpent: number;
  };
  client?: any;
}
```

**Key Features**:
1. Auto-rotation: Mỗi request dùng provider khác
2. Rate limit check: Leave 10% buffer
3. Auto-skip: Skip providers rate limited
4. Auto-retry: Nếu fail, retry với provider khác
5. Cost tracking: Calculate cost per request
6. Usage reset: Auto-reset mỗi 60s

**Strategies**:
- round_robin: Xoay vòng tròn
- priority: Ưu tiên priority thấp nhất
- cost: Chọn provider rẻ nhất
- smart: Dựa vào task type

Export singleton instance:
```typescript
export const aiProvider = new AIProviderRotation(config);
```

Implement đầy đủ với error handling, logging, và TypeScript types.
Sử dụng SDK chính thức: @anthropic-ai/sdk và openai.
```

**Expected Output**: Working AI rotation system có thể call API và auto-rotate

---

## 📝 TASK 4: CONFIG LOADER

### Prompt cho GPT-4/Codex:

```
Tôi cần implement config loader để load configuration từ files.

Context:
- Config stored trong 2 files:
  1. .env.local - API keys (secrets)
  2. .kiro-config.json - App configuration

Requirements:

1. File `backend/src/config/index.ts`:

**Features**:
- Load .env.local using dotenv
- Load .kiro-config.json
- Replace ${ENV_VAR} trong JSON với values từ process.env
- Validate required keys exist
- Export config object

**Implementation**:
```typescript
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load .env.local
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

// Load .kiro-config.json
const configPath = path.join(__dirname, '../../.kiro-config.json');
const configFile = fs.readFileSync(configPath, 'utf-8');
let config = JSON.parse(configFile);

// Replace ${VAR} with process.env.VAR
function replaceEnvVars(obj: any): any {
  // Recursive replacement logic
  // Handle strings, arrays, objects
}

config = replaceEnvVars(config);

// Validate
const requiredKeys = ['CLAUDE_KEY_1', 'OPENAI_KEY_1'];
for (const key of requiredKeys) {
  if (!process.env[key]) {
    throw new Error(`Missing: ${key}`);
  }
}

export default config;
```

2. Create example files:
   - .env.example
   - .kiro-config.json (with ${} placeholders)

Implement đầy đủ với error handling.
```

**Expected Output**: Config loader có thể load và validate configs

---

## 📝 TASK 5: WEBSOCKET SERVER

### Prompt cho GPT-4/Codex:

```
Tôi cần implement WebSocket server cho real-time communication.

Context:
- Sử dụng socket.io
- Events: agent.chat, task.progress, log.new
- Connect từ frontend (port 5173)

Requirements:

1. File `backend/src/websocket/index.ts`:

```typescript
import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

export function setupWebSocket(httpServer: HTTPServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: 'http://localhost:5173',
      methods: ['GET', 'POST'],
    },
  });
  
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    // Handle events:
    // - agent.chat: User message to agent
    // - task.subscribe: Subscribe to task updates
    // - task.cancel: Cancel task
    
    // Emit events:
    // - agent.response: Agent response
    // - task.progress: Task progress update
    // - log.new: New log entry
    
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });
  
  return io;
}
```

2. Integrate vào server.ts:
```typescript
import { setupWebSocket } from './websocket';
const io = setupWebSocket(httpServer);
```

3. Test WebSocket connection

Implement đầy đủ với event handling và error handling.
```

**Expected Output**: WebSocket server working, có thể connect từ frontend

---

## 📝 TASK 6: FRONTEND SETUP

### Prompt cho GPT-4/Copilot:

```
Tôi cần setup frontend React app với UI skeleton.

Context:
- React 19 + TypeScript + Vite
- Dark theme UI
- Responsive layout
- WebSocket integration

Requirements:

1. File `frontend/src/App.tsx`:

Layout:
```
┌─────────────────────────────────────┐
│  Header                             │
├────┬────────────────────────────────┤
│    │                                │
│ S  │  Main Content Area             │
│ i  │                                │
│ d  │                                │
│ e  │                                │
│    │                                │
├────┴────────────────────────────────┤
│  Footer                             │
└─────────────────────────────────────┘
```

Components:
- Header: Logo, Project Selector, Settings
- Sidebar: Navigation (Chat, Tasks, Logs, Files, Git, Providers)
- Main: Content area (route-based)
- Footer: Status bar

2. Routing structure:
- / → ChatPanel
- /tasks → TaskMonitor
- /logs → LogsViewer
- /files → FileExplorer
- /providers → ProviderDashboard

3. Dark theme CSS với variables:
```css
:root {
  --bg-primary: #1E1E1E;
  --bg-secondary: #252526;
  --border: #3E3E42;
  --text: #CCCCCC;
  --accent: #007ACC;
}
```

4. WebSocket client setup:
```typescript
// frontend/src/api/socket.ts
import { io } from 'socket.io-client';

export const socket = io('http://localhost:3000', {
  transports: ['websocket'],
});

socket.on('connect', () => {
  console.log('Connected to backend');
});
```

Implement với modern React patterns (hooks, context).
```

**Expected Output**: Frontend app với UI skeleton, routing, và WebSocket connection

---

## 📝 TASK 7: CHAT INTERFACE

### Prompt cho GPT-4/Copilot:

```
Tôi cần implement Chat Interface để chat với AI agents.

Context:
- Chat với Kiro orchestrator
- Real-time messaging via WebSocket
- Markdown rendering cho responses
- Code syntax highlighting

Requirements:

1. File `frontend/src/components/ChatPanel.tsx`:

Features:
- Message list với scroll
- Input box với Send button
- Typing indicator
- Markdown rendering (react-markdown)
- Code syntax highlighting (react-syntax-highlighter)
- Token usage display
- Suggested prompts

2. Custom hook `frontend/src/hooks/useChat.ts`:
```typescript
export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  
  const sendMessage = async (content: string) => {
    // Add user message
    // Emit 'agent.chat' via WebSocket
    // Listen for 'agent.response'
    // Add agent message
  };
  
  return { messages, isTyping, sendMessage };
}
```

3. Message component với:
- User vs Agent styling
- Timestamp
- Markdown rendering
- Copy button cho code blocks

4. Suggested prompts:
- "Fix bug trong file đang mở"
- "Run full audit"
- "Analyze performance"

Implement với clean UI, smooth animations (framer-motion).
```

**Expected Output**: Working chat interface có thể send/receive messages

---

## 📝 TASK 8: PROVIDER DASHBOARD

### Prompt cho GPT-4/Copilot:

```
Tôi cần implement Provider Dashboard để monitor AI providers.

Context:
- Hiển thị real-time status của tất cả AI providers
- Token usage, requests, cost
- Enable/disable providers

Requirements:

1. File `frontend/src/components/ProviderDashboard.tsx`:

Features:
- Grid layout của provider cards
- Mỗi card hiển thị:
  * Provider name
  * Status badge (active/rate_limited/error)
  * Token usage progress bar
  * Requests count
  * Cost today
  * Enable/Disable toggle

2. Custom hook `frontend/src/hooks/useProviders.ts`:
```typescript
export function useProviders() {
  const [providers, setProviders] = useState([]);
  
  useEffect(() => {
    // Fetch initial stats
    // Poll every 5s for updates
  }, []);
  
  const toggleProvider = async (id: string, enabled: boolean) => {
    // Call API to enable/disable
  };
  
  return { providers, toggleProvider };
}
```

3. UI Components:
- Provider card với color-coded status
- Progress bar cho token usage
- Toggle switch
- Total cost summary

4. Real-time updates via polling hoặc WebSocket

Implement với responsive grid layout và smooth transitions.
```

**Expected Output**: Provider dashboard với real-time stats

---

## 📝 TASK 9: TESTING & INTEGRATION

### Prompt cho Claude/GPT-4:

```
Tôi cần test và integrate tất cả components.

Context:
- Backend API đã implement
- Frontend UI đã implement
- Cần test end-to-end flow

Requirements:

1. Create test scripts:

`backend/src/scripts/testProviders.ts`:
```typescript
// Test AI provider rotation
// Send 10 requests
// Verify rotation working
// Check stats
```

`backend/src/scripts/testKeys.ts`:
```typescript
// Verify all API keys loaded
// Test each key với simple request
// Report which keys working
```

2. Integration testing:
- Start backend
- Start frontend
- Test chat flow:
  * Send message
  * Receive response
  * Verify WebSocket working
- Test provider dashboard:
  * Stats updating
  * Toggle working

3. Create test checklist:
```
Backend:
☐ Server starts
☐ Health check works
☐ API keys loaded
☐ AI rotation works
☐ WebSocket connects

Frontend:
☐ App renders
☐ Can send chat message
☐ Receives response
☐ Provider stats display
☐ UI responsive
```

4. Debug common issues và document solutions

Provide step-by-step testing instructions.
```

**Expected Output**: Tested, working end-to-end system

---

## 📝 TASK 10: DOCUMENTATION

### Prompt cho Claude/GPT-4:

```
Tôi cần viết documentation đầy đủ cho project.

Context:
- Standalone Dev Console với AI rotation
- Multi-project support
- Real-time monitoring

Requirements:

1. Update README.md với:
- Project overview
- Features list
- Screenshots/GIFs (placeholder)
- Quick start guide
- Architecture diagram
- Tech stack

2. Create SETUP.md:
- Prerequisites
- Step-by-step installation
- Configuration guide
- Troubleshooting
- Common errors & solutions

3. Create API.md:
- All REST endpoints
- Request/response examples
- WebSocket events
- Error codes

4. Create USAGE.md:
- How to use chat
- How to monitor providers
- How to add new AI keys
- How to add new projects

5. Code comments:
- Add JSDoc comments cho functions
- Explain complex logic
- Document edge cases

Write clear, concise documentation với examples.
```

**Expected Output**: Complete documentation set

---

## 🎯 WORKFLOW ĐỀ XUẤT

### Cách làm việc với AI models:

```
WEEK 1: Foundation
├─ Day 1-2: Task 1 (Setup) → Claude/GPT-4
├─ Day 3-4: Task 2 (Backend) → Claude/GPT-4
└─ Day 5: Task 3 (AI Rotation) → Claude

WEEK 2: Core Features
├─ Day 1: Task 4 (Config) → GPT-4/Codex
├─ Day 2: Task 5 (WebSocket) → GPT-4/Codex
├─ Day 3-4: Task 6 (Frontend) → GPT-4/Copilot
└─ Day 5: Review & Debug

WEEK 3: UI Features
├─ Day 1-2: Task 7 (Chat) → GPT-4/Copilot
├─ Day 3-4: Task 8 (Dashboard) → GPT-4/Copilot
└─ Day 5: Polish UI

WEEK 4: Testing & Docs
├─ Day 1-3: Task 9 (Testing) → Claude/GPT-4
├─ Day 4-5: Task 10 (Docs) → Claude
└─ Final review
```

---

## 💡 TIPS KHI RA LỆNH CHO AI

### 1. Chia nhỏ tasks
❌ Sai: "Build toàn bộ dev console"
✅ Đúng: "Implement AI Provider Rotation class với [specific requirements]"

### 2. Cung cấp context
```
Good prompt structure:
1. Context: Dự án là gì, tech stack
2. Requirements: Cần làm gì cụ thể
3. Constraints: Giới hạn, best practices
4. Expected output: Kỳ vọng kết quả gì
```

### 3. Provide examples
- Code snippets
- Type definitions
- Expected behavior

### 4. Incremental approach
- Start simple
- Test sau mỗi task
- Add complexity dần

### 5. Specify tech stack
- Libraries cụ thể
- Versions
- Patterns (hooks, classes, etc.)

---

## 📋 TEMPLATE TỔNG QUÁT

Khi yêu cầu AI làm bất kỳ task nào:

```
# Task: [Tên task]

## Context
- Project: Standalone Dev Console
- Tech stack: [Specific stack]
- Current status: [What's done]

## Requirements
1. [Requirement 1]
2. [Requirement 2]
...

## Technical Details
- File: [Exact file path]
- Dependencies: [List dependencies]
- Types: [TypeScript interfaces needed]
- Integration points: [How it connects to other parts]

## Expected Output
- [What should be delivered]
- [How to verify it works]

## Constraints
- Use TypeScript strict mode
- Follow best practices
- Include error handling
- Add logging

Implement đầy đủ với comments và types.
```

---

## 🚀 BẮT ĐẦU NGAY

Copy prompt cho Task 1 và gửi cho Claude/GPT-4 để bắt đầu!

**Estimated Time**:
- Setup & Planning: 1 day
- Implementation: 3 weeks
- Testing & Polish: 1 week
- **Total: 4 weeks** với AI assistance

**Success Rate**: 80-90% với prompts chi tiết như trên

---

**Version**: 1.0.0  
**Last Updated**: 2026-06-23  
**Ready to use**: ✅
