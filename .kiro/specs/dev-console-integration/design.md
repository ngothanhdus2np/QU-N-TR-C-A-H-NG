# Design: Dev Console - Multi-Agent Integration

## 🎨 TỔNG QUAN THIẾT KẾ

Dev Console là một **floating panel** tích hợp trong app CFO Brain, chỉ xuất hiện ở development mode, cho phép developers tương tác real-time với hệ thống Multi-Agent.

---

## 🏗️ KIẾN TRÚC TỔNG THỂ

```
┌─────────────────────────────────────────────────────────┐
│                  CFO Brain App (Dev Mode)               │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌────────────────────────────────────┐                │
│  │    Main App (Normal UI)            │                │
│  │                                    │                │
│  │  [Dashboard] [Orders] [Products]  │                │
│  │                                    │                │
│  └────────────────────────────────────┘                │
│                                                         │
│  ┌────────────────────────────────────┐  ← Floating   │
│  │    Dev Console (Overlay)           │     Panel     │
│  │  ┌──────────────────────────────┐  │                │
│  │  │ 💬 Chat | 📋 Tasks | 📄 Logs │  │                │
│  │  ├──────────────────────────────┤  │                │
│  │  │                              │  │                │
│  │  │  [Content Area]              │  │                │
│  │  │                              │  │                │
│  │  └──────────────────────────────┘  │                │
│  └────────────────────────────────────┘                │
│                                                         │
└─────────────────────────────────────────────────────────┘
          ↕ WebSocket ↕
┌─────────────────────────────────────────────────────────┐
│                  Backend API Server                     │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  Dev API     │  │  WebSocket   │  │  Agent       │ │
│  │  Routes      │  │  Server      │  │  Coordinator │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
          ↕
┌─────────────────────────────────────────────────────────┐
│               Multi-Agent System                        │
├─────────────────────────────────────────────────────────┤
│  Kiro │ Claude Code │ Codex │ Bug Hunter │ ... │       │
└─────────────────────────────────────────────────────────┘
```

---

## 📁 FILE STRUCTURE


```
src/
├── dev/                          # Dev Console code
│   ├── DevConsole.tsx           # Main console component
│   ├── DevConsoleProvider.tsx   # Context provider
│   ├── hooks/
│   │   ├── useDevAgent.ts       # Hook to interact with agents
│   │   ├── useDevTasks.ts       # Hook for task management
│   │   └── useDevLogs.ts        # Hook for logs
│   ├── components/
│   │   ├── ChatTab.tsx          # Chat interface
│   │   ├── TasksTab.tsx         # Tasks monitor
│   │   ├── LogsTab.tsx          # Logs viewer
│   │   ├── DiffViewer.tsx       # Code diff viewer
│   │   └── QuickActions.tsx     # Quick action menu
│   ├── api/
│   │   ├── devApi.ts            # API client
│   │   └── devSocket.ts         # WebSocket client
│   └── types/
│       └── dev.types.ts         # TypeScript types

server/
├── routes/
│   └── dev.ts                   # Dev API endpoints
├── services/
│   └── agentCoordinator.ts      # Coordinate agents
└── websocket/
    └── devSocket.ts             # WebSocket server

.kiro/
├── agent-workspace/             # Runtime data
│   ├── active-tasks.json
│   ├── chat-history.json
│   └── logs/
└── agent-sdk/                   # SDK for agents
    └── devConsoleClient.ts
```

---

## 🎨 COMPONENT DESIGN

### 1. DevConsole.tsx (Main Container)

```tsx
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChatTab } from './components/ChatTab';
import { TasksTab } from './components/TasksTab';
import { LogsTab } from './components/LogsTab';
import { useDevAgent } from './hooks/useDevAgent';

export function DevConsole() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'tasks' | 'logs'>('chat');
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [size, setSize] = useState({ width: 400, height: 600 });
  
  const { isConnected, agentStatus } = useDevAgent();

  // Keyboard shortcut: Cmd+Shift+D
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.shiftKey && e.key === 'd') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!isOpen) {
    return (
      <StatusBadge 
        onClick={() => setIsOpen(true)}
        status={agentStatus}
      />
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        className="dev-console"
        style={{
          position: 'fixed',
          left: position.x,
          top: position.y,
          width: size.width,
          height: size.height,
          zIndex: 9999,
        }}
      >
        <ConsoleHeader 
          onClose={() => setIsOpen(false)}
          onMinimize={() => setIsOpen(false)}
          onDrag={setPosition}
          isConnected={isConnected}
        />
        
        <Tabs activeTab={activeTab} onTabChange={setActiveTab} />
        
        <TabContent>
          {activeTab === 'chat' && <ChatTab />}
          {activeTab === 'tasks' && <TasksTab />}
          {activeTab === 'logs' && <LogsTab />}
        </TabContent>
      </motion.div>
    </AnimatePresence>
  );
}
```

---

### 2. ChatTab.tsx (Chat Interface)

```tsx
import { useState, useRef, useEffect } from 'react';
import { useDevAgent } from '../hooks/useDevAgent';
import { Message } from '../types/dev.types';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';

export function ChatTab() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { sendMessage, isTyping, tokenUsage } = useDevAgent();

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      content: input,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    
    // Send to agent
    const response = await sendMessage(input);
    
    const agentMessage: Message = {
      id: (Date.now() + 1).toString(),
      sender: 'kiro',
      content: response.content,
      timestamp: new Date(),
      metadata: response.metadata,
    };
    
    setMessages(prev => [...prev, agentMessage]);
  };

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="chat-tab">
      {/* Suggested Prompts */}
      <div className="suggested-prompts">
        <SuggestedPrompt 
          text="🐛 Fix bug trong file đang mở"
          onClick={() => setInput("Fix bug trong file đang mở")}
        />
        <SuggestedPrompt 
          text="🔍 Run full audit"
          onClick={() => setInput("Run full audit")}
        />
        <SuggestedPrompt 
          text="⚡ Optimize performance"
          onClick={() => setInput("Optimize performance")}
        />
      </div>

      {/* Messages */}
      <div className="messages">
        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        
        {isTyping && (
          <div className="typing-indicator">
            <span></span><span></span><span></span>
            <span className="text">Kiro đang suy nghĩ...</span>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Token Usage */}
      <div className="token-usage">
        ⏱️ Token: {tokenUsage.used.toLocaleString()} / {tokenUsage.total.toLocaleString()}
        <progress value={tokenUsage.used} max={tokenUsage.total} />
      </div>

      {/* Input */}
      <div className="input-area">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.metaKey) {
              handleSend();
            }
          }}
          placeholder="Type a message... (Cmd+Enter to send)"
          rows={3}
        />
        <button onClick={handleSend} disabled={!input.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  return (
    <div className={`message ${message.sender}`}>
      <div className="avatar">
        {message.sender === 'user' ? '👤' : '🤖'}
      </div>
      <div className="content">
        <ReactMarkdown
          components={{
            code({ node, inline, className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || '');
              return !inline && match ? (
                <SyntaxHighlighter
                  language={match[1]}
                  PreTag="div"
                  {...props}
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              ) : (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            },
          }}
        >
          {message.content}
        </ReactMarkdown>
        <div className="timestamp">
          {message.timestamp.toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}
```

---

### 3. TasksTab.tsx (Task Monitor)

```tsx
import { useDevTasks } from '../hooks/useDevTasks';
import { Task } from '../types/dev.types';
import { motion } from 'framer-motion';

export function TasksTab() {
  const { tasks, cancelTask, viewTaskDetails } = useDevTasks();
  
  const activeTasks = tasks.filter(t => t.status === 'in_progress');
  const queuedTasks = tasks.filter(t => t.status === 'queued');
  const completedTasks = tasks.filter(t => t.status === 'completed');
  
  return (
    <div className="tasks-tab">
      {/* Active Tasks */}
      <Section title="🔧 In Progress" count={activeTasks.length}>
        {activeTasks.map(task => (
          <TaskCard 
            key={task.id} 
            task={task}
            onCancel={() => cancelTask(task.id)}
            onViewDetails={() => viewTaskDetails(task.id)}
          />
        ))}
      </Section>

      {/* Queued Tasks */}
      <Section title="⏸️ Queued" count={queuedTasks.length}>
        {queuedTasks.map(task => (
          <TaskCard 
            key={task.id} 
            task={task}
            onCancel={() => cancelTask(task.id)}
          />
        ))}
      </Section>

      {/* Completed Tasks */}
      <Section 
        title="✅ Completed" 
        count={completedTasks.length}
        collapsible
      >
        {completedTasks.map(task => (
          <TaskCard 
            key={task.id} 
            task={task}
            onViewDetails={() => viewTaskDetails(task.id)}
          />
        ))}
      </Section>
    </div>
  );
}

function TaskCard({ task, onCancel, onViewDetails }: {
  task: Task;
  onCancel?: () => void;
  onViewDetails?: () => void;
}) {
  return (
    <motion.div 
      className="task-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="task-header">
        <h4>{task.title}</h4>
        <span className="task-id">{task.id}</span>
      </div>
      
      <div className="task-meta">
        <span className="agent">🤖 {task.agent}</span>
        {task.status === 'in_progress' && (
          <span className="eta">⏱️ {task.estimatedTime}</span>
        )}
      </div>
      
      {task.status === 'in_progress' && (
        <div className="progress">
          <progress value={task.progress} max={100} />
          <span>{task.progress}%</span>
        </div>
      )}
      
      <div className="task-actions">
        {onViewDetails && (
          <button onClick={onViewDetails}>Details</button>
        )}
        {onCancel && task.status !== 'completed' && (
          <button onClick={onCancel} className="danger">
            Cancel
          </button>
        )}
      </div>
    </motion.div>
  );
}
```

---

### 4. LogsTab.tsx (Logs Viewer)

```tsx
import { useState, useEffect, useRef } from 'react';
import { useDevLogs } from '../hooks/useDevLogs';
import { LogEntry, LogLevel } from '../types/dev.types';

export function LogsTab() {
  const [filterAgent, setFilterAgent] = useState<string>('all');
  const [filterLevel, setFilterLevel] = useState<LogLevel | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  
  const logsEndRef = useRef<HTMLDivElement>(null);
  
  const { logs, agents, clearLogs, exportLogs } = useDevLogs();
  
  // Auto-scroll
  useEffect(() => {
    if (autoScroll) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);
  
  // Filter logs
  const filteredLogs = logs.filter(log => {
    if (filterAgent !== 'all' && log.agent !== filterAgent) return false;
    if (filterLevel !== 'all' && log.level !== filterLevel) return false;
    if (searchTerm && !log.message.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    return true;
  });
  
  return (
    <div className="logs-tab">
      {/* Filters */}
      <div className="filters">
        <select 
          value={filterAgent} 
          onChange={(e) => setFilterAgent(e.target.value)}
        >
          <option value="all">All Agents</option>
          {agents.map(agent => (
            <option key={agent} value={agent}>{agent}</option>
          ))}
        </select>
        
        <select 
          value={filterLevel} 
          onChange={(e) => setFilterLevel(e.target.value as LogLevel)}
        >
          <option value="all">All Levels</option>
          <option value="debug">Debug</option>
          <option value="info">Info</option>
          <option value="warn">Warn</option>
          <option value="error">Error</option>
        </select>
        
        <input
          type="search"
          placeholder="Search logs..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      
      {/* Logs */}
      <div className="logs-container">
        {filteredLogs.map(log => (
          <LogLine key={log.id} log={log} />
        ))}
        <div ref={logsEndRef} />
      </div>
      
      {/* Controls */}
      <div className="logs-controls">
        <label>
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
          />
          Auto-scroll
        </label>
        <button onClick={clearLogs}>Clear</button>
        <button onClick={exportLogs}>Export</button>
      </div>
    </div>
  );
}

function LogLine({ log }: { log: LogEntry }) {
  const levelColors = {
    debug: '#6B7280',
    info: '#3B82F6',
    warn: '#F59E0B',
    error: '#EF4444',
  };
  
  return (
    <div className="log-line" style={{ borderLeftColor: levelColors[log.level] }}>
      <span className="time">{log.timestamp.toLocaleTimeString()}</span>
      <span className="agent">[{log.agent}]</span>
      <span className="level" style={{ color: levelColors[log.level] }}>
        {log.level.toUpperCase()}
      </span>
      <span className="message">{log.message}</span>
    </div>
  );
}
```

---

## 🔌 API DESIGN

### Backend Routes (`server/routes/dev.ts`)

```typescript
import { Router } from 'express';
import { agentCoordinator } from '../services/agentCoordinator';

const router = Router();

// Middleware: Only in development
router.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ error: 'Dev API only available in development' });
  }
  next();
});

// Chat with agent
router.post('/agent/chat', async (req, res) => {
  const { message, agent = 'kiro', context } = req.body;
  
  const response = await agentCoordinator.sendMessage({
    agent,
    message,
    context,
  });
  
  res.json(response);
});

// Create task
router.post('/task/create', async (req, res) => {
  const { type, title, spec } = req.body;
  
  const task = await agentCoordinator.createTask({
    type,
    title,
    spec,
  });
  
  res.json(task);
});

// Get task status
router.get('/task/:id', async (req, res) => {
  const task = await agentCoordinator.getTask(req.params.id);
  res.json(task);
});

// Cancel task
router.delete('/task/:id', async (req, res) => {
  await agentCoordinator.cancelTask(req.params.id);
  res.json({ success: true });
});

// Get active tasks
router.get('/tasks/active', async (req, res) => {
  const tasks = await agentCoordinator.getActiveTasks();
  res.json(tasks);
});

// Get logs
router.get('/logs', async (req, res) => {
  const { agent, level, since } = req.query;
  
  const logs = await agentCoordinator.getLogs({
    agent: agent as string,
    level: level as string,
    since: since ? new Date(since as string) : undefined,
  });
  
  res.json(logs);
});

// Analyze file
router.post('/file/analyze', async (req, res) => {
  const { filepath } = req.body;
  
  const analysis = await agentCoordinator.analyzeFile(filepath);
  
  res.json(analysis);
});

// Get metrics
router.get('/metrics/agents', async (req, res) => {
  const metrics = await agentCoordinator.getAgentMetrics();
  res.json(metrics);
});

export default router;
```

---

## 🔌 WebSocket Design

### Server (`server/websocket/devSocket.ts`)

```typescript
import { Server as SocketIOServer } from 'socket.io';
import { agentCoordinator } from '../services/agentCoordinator';

export function setupDevSocket(io: SocketIOServer) {
  const devNamespace = io.of('/dev');
  
  devNamespace.use((socket, next) => {
    // Auth check
    if (process.env.NODE_ENV !== 'development') {
      return next(new Error('Dev socket only in development'));
    }
    next();
  });
  
  devNamespace.on('connection', (socket) => {
    console.log('[DevSocket] Client connected:', socket.id);
    
    // Agent chat
    socket.on('agent.chat', async (data) => {
      const { message, agent, context } = data;
      
      try {
        const response = await agentCoordinator.sendMessage({
          agent,
          message,
          context,
        });
        
        socket.emit('agent.response', response);
      } catch (error) {
        socket.emit('agent.error', { error: error.message });
      }
    });
    
    // Subscribe to task updates
    socket.on('task.subscribe', (taskId) => {
      agentCoordinator.onTaskUpdate(taskId, (update) => {
        socket.emit('task.progress', update);
      });
    });
    
    // Cancel task
    socket.on('task.cancel', async (taskId) => {
      await agentCoordinator.cancelTask(taskId);
      socket.emit('task.cancelled', { taskId });
    });
    
    // Stream logs
    agentCoordinator.onLog((log) => {
      socket.emit('log.new', log);
    });
    
    socket.on('disconnect', () => {
      console.log('[DevSocket] Client disconnected:', socket.id);
    });
  });
}
```

### Client (`src/dev/api/devSocket.ts`)

```typescript
import { io, Socket } from 'socket.io-client';
import { Message, Task, LogEntry } from '../types/dev.types';

class DevSocketClient {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<Function>> = new Map();
  
  connect() {
    if (this.socket?.connected) return;
    
    this.socket = io('/dev', {
      transports: ['websocket'],
    });
    
    this.socket.on('connect', () => {
      console.log('[DevSocket] Connected');
      this.emit('connected', true);
    });
    
    this.socket.on('disconnect', () => {
      console.log('[DevSocket] Disconnected');
      this.emit('connected', false);
    });
    
    this.socket.on('agent.response', (response: Message) => {
      this.emit('agent.response', response);
    });
    
    this.socket.on('task.progress', (update: Task) => {
      this.emit('task.progress', update);
    });
    
    this.socket.on('log.new', (log: LogEntry) => {
      this.emit('log.new', log);
    });
  }
  
  sendMessage(message: string, agent: string = 'kiro', context?: any) {
    this.socket?.emit('agent.chat', { message, agent, context });
  }
  
  subscribeToTask(taskId: string) {
    this.socket?.emit('task.subscribe', taskId);
  }
  
  cancelTask(taskId: string) {
    this.socket?.emit('task.cancel', taskId);
  }
  
  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }
  
  off(event: string, callback: Function) {
    this.listeners.get(event)?.delete(callback);
  }
  
  private emit(event: string, data: any) {
    this.listeners.get(event)?.forEach(callback => callback(data));
  }
  
  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }
}

export const devSocket = new DevSocketClient();
```

---

## 💾 DATA MODELS

### TypeScript Types (`src/dev/types/dev.types.ts`)

```typescript
export interface Message {
  id: string;
  sender: 'user' | 'kiro' | 'claude' | 'codex' | string;
  content: string;
  timestamp: Date;
  metadata?: {
    tokenUsage?: number;
    taskId?: string;
    files?: string[];
  };
}

export interface Task {
  id: string;
  title: string;
  type: 'bug_fix' | 'feature' | 'refactor' | 'analysis' | 'audit';
  status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  agent: string;
  progress: number; // 0-100
  estimatedTime?: string; // "5 minutes"
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  spec?: any;
  result?: any;
  error?: string;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  id: string;
  timestamp: Date;
  agent: string;
  level: LogLevel;
  message: string;
  metadata?: any;
}

export interface AgentStatus {
  name: string;
  status: 'idle' | 'busy' | 'error';
  currentTask?: string;
  tokenUsage: {
    used: number;
    total: number;
  };
}

export interface TokenUsage {
  used: number;
  total: number;
  percentage: number;
}
```

---

## 🎨 STYLING

### CSS Variables (Theme)

```css
:root {
  /* Dev Console Colors */
  --dev-bg: #1E1E1E;
  --dev-surface: #252526;
  --dev-border: #3E3E42;
  --dev-text: #CCCCCC;
  --dev-text-secondary: #858585;
  --dev-accent: #007ACC;
  --dev-success: #4EC9B0;
  --dev-warning: #CE9178;
  --dev-error: #F48771;
  
  /* Shadows */
  --dev-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  
  /* Transitions */
  --dev-transition: all 0.2s ease;
}
```

### Dev Console Styles

```css
.dev-console {
  background: var(--dev-bg);
  border: 1px solid var(--dev-border);
  border-radius: 8px;
  box-shadow: var(--dev-shadow);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
  color: var(--dev-text);
}

.console-header {
  background: var(--dev-surface);
  border-bottom: 1px solid var(--dev-border);
  padding: 8px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: move;
}

.tabs {
  display: flex;
  border-bottom: 1px solid var(--dev-border);
  background: var(--dev-surface);
}

.tab {
  padding: 8px 16px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: var(--dev-transition);
}

.tab.active {
  border-bottom-color: var(--dev-accent);
  color: var(--dev-accent);
}

.tab:hover {
  background: rgba(255, 255, 255, 0.05);
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

.message .content {
  background: var(--dev-surface);
  padding: 12px;
  border-radius: 8px;
  max-width: 80%;
}

.message.user .content {
  background: var(--dev-accent);
}

.typing-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px;
}

.typing-indicator span {
  width: 6px;
  height: 6px;
  background: var(--dev-text-secondary);
  border-radius: 50%;
  animation: typing 1.4s infinite;
}

@keyframes typing {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-10px); }
}

.task-card {
  background: var(--dev-surface);
  border: 1px solid var(--dev-border);
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 8px;
}

.progress {
  margin: 8px 0;
}

progress {
  width: 100%;
  height: 6px;
  border-radius: 3px;
}

progress::-webkit-progress-bar {
  background: var(--dev-border);
  border-radius: 3px;
}

progress::-webkit-progress-value {
  background: var(--dev-accent);
  border-radius: 3px;
}

.log-line {
  font-size: 12px;
  padding: 4px 8px;
  border-left: 3px solid transparent;
  display: flex;
  gap: 8px;
  font-family: 'Menlo', monospace;
}

.log-line:hover {
  background: rgba(255, 255, 255, 0.03);
}
```

---

## 🚀 IMPLEMENTATION PLAN

### Phase 1: Foundation (Week 1)
- [ ] Setup project structure
- [ ] Backend API routes
- [ ] WebSocket server
- [ ] Basic DevConsole component
- [ ] DevConsoleProvider context

### Phase 2: Chat Interface (Week 2)
- [ ] ChatTab component
- [ ] Message rendering with markdown
- [ ] Code syntax highlighting
- [ ] Suggested prompts
- [ ] Token usage indicator
- [ ] Chat history persistence

### Phase 3: Task Monitor (Week 3)
- [ ] TasksTab component
- [ ] Real-time task updates
- [ ] Task filtering/sorting
- [ ] Task details view
- [ ] Cancel task functionality

### Phase 4: Logs & Integration (Week 4)
- [ ] LogsTab component
- [ ] Log filtering & search
- [ ] Export logs
- [ ] File watcher integration
- [ ] Context menu integration

### Phase 5: Advanced Features (Week 5)
- [ ] Diff viewer
- [ ] Quick actions menu
- [ ] Performance metrics
- [ ] Code context aware
- [ ] Inline suggestions

### Phase 6: Polish & Testing (Week 6)
- [ ] UI/UX refinements
- [ ] Performance optimization
- [ ] Error handling
- [ ] Documentation
- [ ] Demo video

---

**Version**: 1.0.0  
**Status**: Design Document  
**Last Updated**: 2026-06-23
