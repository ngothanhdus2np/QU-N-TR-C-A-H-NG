# Setup Guide: Standalone Dev Console

## 🚀 QUICK START

### Prerequisites

```bash
✅ Node.js >= 18.0.0
✅ npm hoặc yarn
✅ Git
✅ AI API keys (ít nhất 2-3 keys)
✅ macOS/Linux (Windows with WSL)
```

---

## 📦 STEP 1: TẠO PROJECT STRUCTURE

```bash
# Tạo folder chính
mkdir standalone-dev-console
cd standalone-dev-console

# Tạo structure
mkdir -p frontend/src/{components,hooks,api,types,styles}
mkdir -p backend/src/{agents,services,routes,websocket,types,config}
mkdir -p shared/{types,utils}

# Init git
git init
```

---

## 📝 STEP 2: SETUP BACKEND

### 2.1: Initialize Backend

```bash
cd backend

# Init npm
npm init -y

# Install dependencies
npm install express cors dotenv
npm install @anthropic-ai/sdk openai
npm install socket.io
npm install chokidar simple-git

# Install dev dependencies
npm install -D typescript @types/node @types/express
npm install -D tsx nodemon
npm install -D @types/cors
```

### 2.2: Create `backend/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 2.3: Create `backend/package.json` scripts

```json
{
  "scripts": {
    "dev": "nodemon --exec tsx src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js"
  }
}
```

### 2.4: Create Backend Files

**`backend/src/server.ts`**:
```typescript
import express from 'express';
import cors from 'cors';
import http from 'http';
import { setupWebSocket } from './websocket';
import projectRoutes from './routes/projects';
import agentRoutes from './routes/agents';
import providerRoutes from './routes/providers';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/projects', projectRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/providers', providerRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Create HTTP server
const httpServer = http.createServer(app);

// Setup WebSocket
setupWebSocket(httpServer);

// Start server
httpServer.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`🔌 WebSocket available at ws://localhost:${PORT}`);
});
```

---

## 🎨 STEP 3: SETUP FRONTEND

### 3.1: Initialize Frontend

```bash
cd ../frontend

# Create Vite project
npm create vite@latest . -- --template react-ts

# Install additional dependencies
npm install framer-motion
npm install react-markdown react-syntax-highlighter
npm install socket.io-client
npm install @monaco-editor/react  # For code editor

# Install dev dependencies
npm install -D @types/react-syntax-highlighter
```

### 3.2: Create `frontend/vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
```

---

## ⚙️ STEP 4: CONFIGURATION FILES

### 4.1: Create `.env.example` (root)

```bash
# AI Provider Keys
CLAUDE_KEY_1=sk-ant-api03-xxx
CLAUDE_KEY_2=sk-ant-api03-yyy
OPENAI_KEY_1=sk-xxx
OPENAI_KEY_2=sk-yyy
GOOGLE_KEY_1=xxx

# Server
PORT=3000
NODE_ENV=development

# Security (generate với: openssl rand -hex 32)
JWT_SECRET=your-secret-key
```

### 4.2: Create `.kiro-config.json` (root)

```json
{
  "version": "1.0.0",
  "projects": [
    {
      "id": "cfo-brain",
      "name": "CFO Brain 4.0",
      "path": "/Users/apple/phucsang app/QU-N-TR-C-A-H-NG",
      "type": "react-typescript",
      "active": true,
      "config": {
        "packageManager": "npm",
        "buildCommand": "npm run build",
        "testCommand": "npm test",
        "gitBranch": "main"
      }
    }
  ],
  "aiProviders": {
    "rotationEnabled": true,
    "strategy": "smart",
    "providers": [
      {
        "id": "claude-1",
        "name": "Claude Account 1",
        "type": "anthropic",
        "model": "claude-sonnet-4-20250514",
        "apiKey": "${CLAUDE_KEY_1}",
        "priority": 1,
        "rateLimit": {
          "tokensPerMinute": 40000,
          "requestsPerMinute": 50
        },
        "cost": {
          "inputTokenCost": 3.0,
          "outputTokenCost": 15.0
        },
        "features": ["analysis", "code_review"],
        "enabled": true
      },
      {
        "id": "claude-2",
        "name": "Claude Account 2",
        "type": "anthropic",
        "model": "claude-sonnet-4-20250514",
        "apiKey": "${CLAUDE_KEY_2}",
        "priority": 2,
        "rateLimit": {
          "tokensPerMinute": 40000,
          "requestsPerMinute": 50
        },
        "cost": {
          "inputTokenCost": 3.0,
          "outputTokenCost": 15.0
        },
        "enabled": true
      }
    ]
  },
  "preferences": {
    "theme": "dark",
    "autoSave": true,
    "notifications": true
  }
}
```

### 4.3: Create `.gitignore` (root)

```gitignore
# Dependencies
node_modules/
frontend/node_modules/
backend/node_modules/

# Build
dist/
build/
*.tsbuildinfo

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
logs/
*.log
npm-debug.log*

# Runtime data
.kiro-runtime/
*.db
*.sqlite
```

---

## 🔧 STEP 5: IMPLEMENT CORE SERVICES

### 5.1: AI Provider Service

Tạo file `backend/src/services/AIProvider.ts` với code từ [ai-rotation.md](./ai-rotation.md)

### 5.2: Config Loader

**`backend/src/config/index.ts`**:
```typescript
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Load .kiro-config.json
const configPath = path.join(process.cwd(), '../.kiro-config.json');
const configFile = fs.readFileSync(configPath, 'utf-8');
let config = JSON.parse(configFile);

// Replace ${ENV_VAR} với actual values từ process.env
const replaceEnvVars = (obj: any): any => {
  if (typeof obj === 'string') {
    return obj.replace(/\$\{(\w+)\}/g, (_, key) => process.env[key] || '');
  }
  if (Array.isArray(obj)) {
    return obj.map(replaceEnvVars);
  }
  if (typeof obj === 'object' && obj !== null) {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = replaceEnvVars(value);
    }
    return result;
  }
  return obj;
};

config = replaceEnvVars(config);

export default config;
```

---

## 🏃 STEP 6: RUN THE APP

### 6.1: Setup root package.json

Tạo `package.json` ở root:

```json
{
  "name": "standalone-dev-console",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "install:all": "npm install && cd frontend && npm install && cd ../backend && npm install",
    "dev": "concurrently \"npm run dev:backend\" \"npm run dev:frontend\"",
    "dev:backend": "cd backend && npm run dev",
    "dev:frontend": "cd frontend && npm run dev",
    "build": "npm run build:frontend && npm run build:backend",
    "build:frontend": "cd frontend && npm run build",
    "build:backend": "cd backend && npm run build"
  },
  "devDependencies": {
    "concurrently": "^8.0.0"
  }
}
```

### 6.2: Install concurrently

```bash
npm install
```

### 6.3: Start Development

```bash
# Terminal 1: Start both frontend & backend
npm run dev

# Hoặc chạy riêng từng cái:
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend && npm run dev
```

### 6.4: Access Application

- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:3000
- **Health Check**: http://localhost:3000/health

---

## ✅ STEP 7: VERIFY SETUP

### 7.1: Test Backend Health

```bash
curl http://localhost:3000/health

# Expected response:
# {"status":"ok","timestamp":"2026-06-23T..."}
```

### 7.2: Test AI Provider

```bash
curl -X POST http://localhost:3000/api/providers/test \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello, AI!"}'

# Should return response từ một provider
```

### 7.3: Test WebSocket

Mở browser console trên http://localhost:5173:

```javascript
const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('✅ WebSocket connected');
});

socket.emit('test', { message: 'Hello' });
```

---

## 🎯 STEP 8: FIRST FEATURES

### Priority Order:

1. ✅ Basic backend setup
2. ✅ AI Provider rotation
3. ✅ WebSocket connection
4. 🔄 Chat interface (Next)
5. 🔄 Project selector
6. 🔄 Task monitor

### Implement Chat Interface:

Xem chi tiết trong [components.md](./components.md)

---

## 📊 PROJECT STATUS CHECKLIST

```
Backend:
✅ Server running
✅ AI Provider rotation working
✅ WebSocket connected
⬜ Routes implemented
⬜ Agents implemented

Frontend:
✅ App rendering
✅ WebSocket client
⬜ Chat UI
⬜ Project selector
⬜ Task monitor

Configuration:
✅ .env.local configured
✅ .kiro-config.json configured
✅ API keys working
```

---

## 🐛 TROUBLESHOOTING

### Problem: Backend won't start

**Check**:
```bash
# Verify Node version
node --version  # Should be >= 18

# Check if port 3000 is available
lsof -i :3000

# Check env variables
cat .env.local | grep KEY
```

### Problem: AI Provider errors

**Check**:
```bash
# Test API key manually
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $CLAUDE_KEY_1" \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-sonnet-4-20250514","max_tokens":10,"messages":[{"role":"user","content":"test"}]}'
```

### Problem: Frontend can't connect to backend

**Check**:
1. Backend đang chạy? `curl http://localhost:3000/health`
2. Vite proxy config đúng?
3. CORS enabled ở backend?

---

## 📚 NEXT STEPS

1. **Implement Chat**: [components.md](./components.md)
2. **Add Agents**: [agents.md](./agents.md)
3. **File Operations**: [api-reference.md](./api-reference.md)
4. **Deploy**: [deployment.md](./deployment.md)

---

## 💡 TIPS

1. **Development Mode**:
   - Backend auto-reload với nodemon
   - Frontend HMR với Vite
   - WebSocket auto-reconnect

2. **Debugging**:
   - Backend logs: Check terminal
   - Frontend: Browser DevTools
   - WebSocket: Chrome DevTools → Network → WS

3. **Performance**:
   - Use `tsx` thay vì `ts-node` (nhanh hơn)
   - Enable Vite cache
   - Use WebSocket thay vì polling

---

**Setup Time**: ~30 phút  
**Difficulty**: Medium  
**Prerequisites**: Familiar with Node.js & React
