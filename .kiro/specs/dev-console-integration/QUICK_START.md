# 🚀 Quick Start: Dev Console Implementation

## 📋 TÓM TẮT

Tài liệu này hướng dẫn cách tích hợp **Dev Console** (Multi-Agent System UI) vào app CFO Brain 4.0 trong chế độ development.

---

## ✅ BƯỚC 1: CÀI ĐẶT DEPENDENCIES

```bash
# UI libraries
npm install framer-motion react-markdown react-syntax-highlighter
npm install socket.io-client

# Backend
npm install socket.io

# Dev dependencies
npm install -D @types/react-syntax-highlighter @types/socket.io
```

---

## ✅ BƯỚC 2: SETUP BACKEND API

### 2.1: Tạo Dev API Routes

Tạo file `server/routes/dev.ts`:

```typescript
import { Router } from 'express';
import { anthropic } from '../config/anthropic'; // Sử dụng Claude API có sẵn

const router = Router();

// Middleware: Chỉ cho phép trong dev mode
router.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ error: 'Dev API only in development' });
  }
  next();
});

// Chat với Kiro (sử dụng Claude API)
router.post('/agent/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    // Call Claude API với system prompt cho Kiro
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: `You are Kiro, an AI orchestrator for CFO Brain 4.0 development.
               You help developers by analyzing code, finding bugs, and coordinating fixes.
               You have access to the codebase and can delegate tasks to specialized agents.`,
      messages: [{ role: 'user', content: message }],
    });
    
    res.json({
      content: response.content[0].text,
      tokenUsage: {
        used: response.usage.input_tokens + response.usage.output_tokens,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

### 2.2: Mount routes trong `server.ts`

```typescript
// server.ts
import devRoutes from './routes/dev';

// ... existing code ...

// Dev API (chỉ trong development)
if (process.env.NODE_ENV === 'development') {
  app.use('/api/dev', devRoutes);
  console.log('🛠️  Dev Console API enabled');
}
```

---

## ✅ BƯỚC 3: SETUP WEBSOCKET

### 3.1: Tạo WebSocket Server

Tạo file `server/websocket/devSocket.ts`:

```typescript
import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';

export function setupDevSocket(httpServer: HTTPServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: 'http://localhost:5173', // Vite dev server
      methods: ['GET', 'POST'],
    },
  });
  
  const devNamespace = io.of('/dev');
  
  devNamespace.on('connection', (socket) => {
    console.log('[DevSocket] Client connected:', socket.id);
    
    socket.on('agent.chat', async (data) => {
      const { message } = data;
      
      // Gọi Claude API
      try {
        const response = await fetch('http://localhost:3000/api/dev/agent/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message }),
        });
        
        const result = await response.json();
        socket.emit('agent.response', result);
      } catch (error) {
        socket.emit('agent.error', { error: error.message });
      }
    });
    
    socket.on('disconnect', () => {
      console.log('[DevSocket] Client disconnected:', socket.id);
    });
  });
  
  return io;
}
```

### 3.2: Integrate vào `server.ts`

```typescript
// server.ts
import http from 'http';
import { setupDevSocket } from './websocket/devSocket';

// ... existing Express setup ...

const httpServer = http.createServer(app);

// Setup WebSocket cho dev console
if (process.env.NODE_ENV === 'development') {
  setupDevSocket(httpServer);
}

// Thay đổi từ app.listen sang httpServer.listen
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

---

## ✅ BƯỚC 4: TẠO DEV CONSOLE COMPONENT

### 4.1: Tạo structure

```bash
mkdir -p src/dev/{components,hooks,api,types}
```

### 4.2: Types (`src/dev/types/dev.types.ts`)

```typescript
export interface Message {
  id: string;
  sender: 'user' | 'kiro';
  content: string;
  timestamp: Date;
}

export interface TokenUsage {
  used: number;
  total: number;
}
```

### 4.3: Socket Client (`src/dev/api/devSocket.ts`)

```typescript
import { io, Socket } from 'socket.io-client';

class DevSocketClient {
  private socket: Socket | null = null;
  private listeners = new Map<string, Set<Function>>();
  
  connect() {
    if (this.socket?.connected) return;
    
    this.socket = io('http://localhost:3000/dev', {
      transports: ['websocket'],
    });
    
    this.socket.on('connect', () => {
      console.log('[DevSocket] Connected');
      this.emit('connected', true);
    });
    
    this.socket.on('agent.response', (response) => {
      this.emit('agent.response', response);
    });
  }
  
  sendMessage(message: string) {
    this.socket?.emit('agent.chat', { message });
  }
  
  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }
  
  private emit(event: string, data: any) {
    this.listeners.get(event)?.forEach(cb => cb(data));
  }
  
  disconnect() {
    this.socket?.disconnect();
  }
}

export const devSocket = new DevSocketClient();
```

### 4.4: Hook (`src/dev/hooks/useDevAgent.ts`)

```typescript
import { useState, useEffect } from 'react';
import { devSocket } from '../api/devSocket';
import { Message, TokenUsage } from '../types/dev.types';

export function useDevAgent() {
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [tokenUsage, setTokenUsage] = useState<TokenUsage>({
    used: 0,
    total: 200000,
  });
  
  useEffect(() => {
    devSocket.connect();
    
    devSocket.on('connected', (status: boolean) => {
      setIsConnected(status);
    });
    
    devSocket.on('agent.response', (response: any) => {
      setIsTyping(false);
      if (response.tokenUsage) {
        setTokenUsage(prev => ({
          ...prev,
          used: prev.used + response.tokenUsage.used,
        }));
      }
    });
    
    return () => {
      devSocket.disconnect();
    };
  }, []);
  
  const sendMessage = async (message: string): Promise<Message> => {
    setIsTyping(true);
    
    return new Promise((resolve) => {
      devSocket.sendMessage(message);
      
      const handler = (response: any) => {
        devSocket.on('agent.response', () => {});
        resolve({
          id: Date.now().toString(),
          sender: 'kiro',
          content: response.content,
          timestamp: new Date(),
        });
      };
      
      devSocket.on('agent.response', handler);
    });
  };
  
  return {
    isConnected,
    isTyping,
    tokenUsage,
    sendMessage,
  };
}
```

### 4.5: Main Component (`src/dev/DevConsole.tsx`)

```typescript
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDevAgent } from './hooks/useDevAgent';
import { Message } from './types/dev.types';
import ReactMarkdown from 'react-markdown';
import './DevConsole.css';

export function DevConsole() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  
  const { isConnected, isTyping, tokenUsage, sendMessage } = useDevAgent();
  
  // Hotkey: Cmd+Shift+D
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey && e.shiftKey && e.key === 'd') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  
  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      content: input,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    
    const response = await sendMessage(input);
    setMessages(prev => [...prev, response]);
  };
  
  if (!isOpen) {
    return (
      <button 
        className="dev-console-toggle"
        onClick={() => setIsOpen(true)}
        title="Open Dev Console (Cmd+Shift+D)"
      >
        🤖
      </button>
    );
  }
  
  return (
    <AnimatePresence>
      <motion.div
        className="dev-console"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
      >
        <div className="console-header">
          <div className="title">
            💬 Kiro AI Assistant
            <span className={`status ${isConnected ? 'connected' : 'disconnected'}`}>
              {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
            </span>
          </div>
          <button onClick={() => setIsOpen(false)}>✕</button>
        </div>
        
        <div className="messages">
          {messages.map(msg => (
            <div key={msg.id} className={`message ${msg.sender}`}>
              <div className="avatar">{msg.sender === 'user' ? '👤' : '🤖'}</div>
              <div className="content">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
                <div className="timestamp">
                  {msg.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
          
          {isTyping && (
            <div className="typing-indicator">
              <span></span><span></span><span></span>
              Kiro đang suy nghĩ...
            </div>
          )}
        </div>
        
        <div className="token-usage">
          Token: {tokenUsage.used.toLocaleString()} / {tokenUsage.total.toLocaleString()}
          <progress value={tokenUsage.used} max={tokenUsage.total} />
        </div>
        
        <div className="input-area">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.metaKey) handleSend();
            }}
            placeholder="Ask Kiro anything... (Cmd+Enter to send)"
          />
          <button onClick={handleSend} disabled={!input.trim()}>
            Send
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
```

### 4.6: Styles (`src/dev/DevConsole.css`)

```css
.dev-console-toggle {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: #007ACC;
  color: white;
  font-size: 24px;
  border: none;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 9998;
  transition: transform 0.2s;
}

.dev-console-toggle:hover {
  transform: scale(1.1);
}

.dev-console {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 400px;
  height: 600px;
  background: #1E1E1E;
  border: 1px solid #3E3E42;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  z-index: 9999;
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
  color: #CCCCCC;
}

.console-header {
  background: #252526;
  padding: 12px;
  border-bottom: 1px solid #3E3E42;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.console-header .title {
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.status {
  font-size: 12px;
  font-weight: normal;
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.message {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.message.user {
  flex-direction: row-reverse;
}

.message .avatar {
  font-size: 24px;
}

.message .content {
  background: #252526;
  padding: 12px;
  border-radius: 8px;
  max-width: 80%;
}

.message.user .content {
  background: #007ACC;
}

.timestamp {
  font-size: 10px;
  color: #858585;
  margin-top: 4px;
}

.typing-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px;
  color: #858585;
}

.typing-indicator span:not(.text) {
  width: 6px;
  height: 6px;
  background: #858585;
  border-radius: 50%;
  animation: typing 1.4s infinite;
}

.typing-indicator span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-indicator span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-8px); }
}

.token-usage {
  padding: 8px 12px;
  background: #252526;
  border-top: 1px solid #3E3E42;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.token-usage progress {
  flex: 1;
  height: 4px;
}

.input-area {
  padding: 12px;
  background: #252526;
  border-top: 1px solid #3E3E42;
  display: flex;
  gap: 8px;
}

.input-area input {
  flex: 1;
  background: #1E1E1E;
  border: 1px solid #3E3E42;
  border-radius: 4px;
  padding: 8px;
  color: #CCCCCC;
  font-family: inherit;
}

.input-area button {
  background: #007ACC;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 8px 16px;
  cursor: pointer;
}

.input-area button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

---

## ✅ BƯỚC 5: TÍCH HỢP VÀO APP

### 5.1: Thêm vào `App.tsx`

```typescript
// App.tsx
import { DevConsole } from './dev/DevConsole';

function App() {
  return (
    <>
      {/* Existing app code */}
      <Router>
        <Routes>
          {/* ... routes ... */}
        </Routes>
      </Router>
      
      {/* Dev Console - chỉ trong development */}
      {import.meta.env.DEV && <DevConsole />}
    </>
  );
}

export default App;
```

---

## ✅ BƯỚC 6: CHẠY THỬ

### 6.1: Start backend

```bash
npm run dev
```

### 6.2: Start frontend (terminal khác)

```bash
npm run dev
```

### 6.3: Test

1. Mở app: `http://localhost:5173`
2. Nhấn `Cmd+Shift+D` để mở Dev Console
3. Type: "Hello Kiro, analyze posOrderService.ts"
4. Xem response từ AI

---

## 🎯 NEXT STEPS

Sau khi có basic console hoạt động, bạn có thể:

1. **Thêm TasksTab**: Monitor tasks running
2. **Thêm LogsTab**: Real-time logs
3. **Code context**: Right-click menu trong code
4. **File watcher**: Auto-analyze khi save file
5. **Diff viewer**: Review changes từ agents

---

## 🐛 TROUBLESHOOTING

### Issue: WebSocket không kết nối

**Solution**: Check CORS settings trong `devSocket.ts`:
```typescript
cors: {
  origin: 'http://localhost:5173', // Phải match với Vite port
  methods: ['GET', 'POST'],
}
```

### Issue: Claude API không hoạt động

**Solution**: Verify `ANTHROPIC_API_KEY` trong `.env.local`

### Issue: Console không hiện

**Solution**: Check `import.meta.env.DEV` = true

---

## 📚 TÀI LIỆU THAM KHẢO

- [Requirements](./requirements.md)
- [Design](./design.md)
- [Multi-Agent System](../../steering/multi-agent-system.md)

---

**Ước tính thời gian implement**: 2-3 ngày cho MVP version
**Complexity**: Medium
