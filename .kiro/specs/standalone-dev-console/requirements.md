# Requirements: Standalone Dev Console

## 1. PROJECT MANAGEMENT

### REQ-PM-001: Multi-Project Support
**Priority**: P0 (Critical)

**Description**: Hệ thống phải quản lý được nhiều projects đồng thời

**Acceptance Criteria**:
1. Hiển thị danh sách projects
2. Switch giữa projects
3. Mỗi project có config riêng
4. Auto-detect project type
5. Project status monitoring

**Data Model**:
```typescript
interface Project {
  id: string;
  name: string;
  path: string;
  type: 'react' | 'node' | 'python' | 'mixed';
  active: boolean;
  lastAccessed: Date;
  config: {
    packageManager: 'npm' | 'yarn' | 'pnpm';
    buildCommand?: string;
    testCommand?: string;
    gitBranch?: string;
  };
  health: {
    status: 'healthy' | 'warning' | 'error';
    issues: string[];
  };
}
```

---

### REQ-PM-002: Project Auto-Detection
**Priority**: P1 (High)

**Description**: Tự động detect project type và config

**Detection Logic**:
- `package.json` → Node/React project
- `requirements.txt` → Python project
- `Cargo.toml` → Rust project
- `pom.xml` → Java project

**Auto-extract**:
- Dependencies
- Scripts
- Build tools
- Test frameworks

---

## 2. AI PROVIDER ROTATION

### REQ-AI-001: Multi-Provider Support
**Priority**: P0 (Critical)

**Description**: Hỗ trợ nhiều AI providers và nhiều keys

**Supported Providers**:
1. Anthropic Claude (Sonnet, Opus, Haiku)
2. OpenAI (GPT-4, GPT-3.5)
3. Google Gemini
4. Local models (Ollama)

**Data Model**:
```typescript
interface AIProvider {
  id: string;
  name: string;
  type: 'anthropic' | 'openai' | 'google' | 'local';
  model: string;
  apiKey: string;
  endpoint?: string; // For custom endpoints
  
  // Rate limiting
  rateLimit: {
    tokensPerMinute: number;
    requestsPerMinute: number;
    tokensPerDay?: number;
  };
  
  // Current usage
  usage: {
    tokensUsed: number;
    requestsUsed: number;
    lastReset: Date;
  };
  
  // Status
  status: 'active' | 'rate_limited' | 'error' | 'disabled';
  priority: number; // Lower = higher priority
  
  // Cost tracking
  cost: {
    inputTokenCost: number;  // USD per 1M tokens
    outputTokenCost: number;
    totalSpent: number;
  };
}
```

---

### REQ-AI-002: Intelligent Rotation
**Priority**: P0 (Critical)

**Description**: Tự động xoay tua providers based on availability, cost, và task type

**Rotation Strategies**:

1. **Round Robin** (Default)
   - Xoay vòng tròn qua tất cả providers
   - Skip providers đã rate limited

2. **Priority-Based**
   - Ưu tiên providers có priority thấp hơn
   - Fallback sang priority cao hơn nếu cần

3. **Cost-Optimized**
   - Chọn provider rẻ nhất available
   - Dùng expensive providers cho critical tasks only

4. **Task-Specific**
   - Simple tasks → GPT-3.5 (fast, cheap)
   - Code analysis → Claude (accurate)
   - Code generation → GPT-4 (creative)
   - Large context → Claude Opus

**Algorithm**:
```typescript
async function selectProvider(task: Task): Promise<AIProvider> {
  const candidates = providers
    .filter(p => p.status === 'active')
    .filter(p => isWithinRateLimit(p))
    .filter(p => supportsTaskType(p, task.type));
  
  if (candidates.length === 0) {
    throw new Error('No available providers');
  }
  
  // Sort by strategy
  switch (config.rotationStrategy) {
    case 'round_robin':
      return candidates[currentIndex++ % candidates.length];
    
    case 'priority':
      return candidates.sort((a, b) => a.priority - b.priority)[0];
    
    case 'cost':
      return candidates.sort((a, b) => 
        calculateCost(a, task) - calculateCost(b, task)
      )[0];
    
    case 'task_specific':
      return selectByTaskType(candidates, task);
  }
}
```

---

### REQ-AI-003: Rate Limit Management
**Priority**: P0 (Critical)

**Description**: Track và respect rate limits của từng provider

**Features**:
1. **Automatic tracking**
   - Count tokens per request
   - Track requests per minute
   - Reset counters sau mỗi phút

2. **Proactive avoidance**
   - Không gọi provider gần hit limit
   - Pre-emptive switch to other providers

3. **Backoff strategy**
   - Exponential backoff khi hit 429
   - Retry với provider khác

4. **Dashboard**
   - Real-time usage display
   - Warnings khi gần limit
   - Historical usage charts

---

### REQ-AI-004: Cost Tracking
**Priority**: P1 (High)

**Description**: Track chi phí sử dụng từng provider

**Metrics**:
- Total tokens used
- Total requests made
- Total cost (USD)
- Cost per task type
- Cost per project
- Cost per agent

**Budget Alerts**:
- Warning khi đạt 80% budget
- Block requests khi đạt 100% budget

---

## 3. AGENT SYSTEM

### REQ-AG-001: Agent Coordination
**Priority**: P0 (Critical)

**Description**: Kiro orchestrator điều phối các agents

**Agent Types**:
1. **Kiro** (Orchestrator)
   - Receive user requests
   - Break down into tasks
   - Assign tasks to agents
   - Aggregate results

2. **Claude Code** (Analyzer)
   - Code analysis
   - Architecture review
   - Bug detection
   - Performance profiling

3. **Codex** (Developer)
   - Code generation
   - Bug fixes
   - Refactoring
   - Test writing

4. **Bug Hunter**
   - Static analysis
   - Pattern matching
   - Automated scanning

5. **Security Scanner**
   - Vulnerability detection
   - Dependency audit
   - Security best practices

6. **Performance Analyzer**
   - Performance profiling
   - Optimization suggestions
   - Benchmark comparisons

**Communication Protocol**:
```typescript
interface AgentMessage {
  id: string;
  from: string; // Agent name
  to: string;   // Agent name or 'user'
  type: 'request' | 'response' | 'update';
  content: any;
  metadata: {
    taskId?: string;
    priority?: number;
    timestamp: Date;
  };
}
```

---

### REQ-AG-002: Task Queue Management
**Priority**: P0 (Critical)

**Description**: Queue system cho tasks

**Features**:
1. **Priority queue**
   - P0 (Critical) → Execute immediately
   - P1 (High) → Within 5 minutes
   - P2 (Medium) → Within 1 hour
   - P3 (Low) → Best effort

2. **Parallel execution**
   - Run multiple tasks concurrently
   - Respect dependencies
   - Resource allocation

3. **Task lifecycle**
   ```
   queued → assigned → in_progress → 
   completed/failed/cancelled
   ```

4. **Retry logic**
   - Auto-retry failed tasks (max 3 times)
   - Exponential backoff
   - Different provider on retry

---

## 4. FILE SYSTEM ACCESS

### REQ-FS-001: Direct File Access
**Priority**: P0 (Critical)

**Description**: Đọc/ghi files trực tiếp trong project

**Operations**:
- Read file
- Write file
- Delete file
- Move/rename file
- Create directory
- Search files (by name, content)

**Security**:
- Chỉ access files trong configured project paths
- Không access system files
- Confirm trước khi delete/overwrite

---

### REQ-FS-002: File Watching
**Priority**: P1 (High)

**Description**: Watch file changes real-time

**Features**:
- Detect file created/modified/deleted
- Trigger auto-analysis on change
- Notification cho user
- Debounce để avoid spam

---

## 5. GIT INTEGRATION

### REQ-GIT-001: Git Operations
**Priority**: P1 (High)

**Description**: Execute git commands

**Supported Operations**:
- `git status`
- `git diff`
- `git log`
- `git branch`
- `git checkout <branch>`
- `git commit -m "message"`
- `git push`
- `git pull`

**Auto-commit**:
- Agent fixes → Auto-commit với meaningful message
- Format: `fix: <description> (by <agent>)`

---

## 6. UI/UX REQUIREMENTS

### REQ-UI-001: Responsive Layout
**Priority**: P1 (High)

**Layout**:
```
┌────────────────────────────────────────────────┐
│  Header: Logo | Project Selector | Settings   │
├──────┬─────────────────────────────────────────┤
│      │  💬 Chat                                │
│ Side │  ┌─────────────────────────────────────┐│
│ bar  │  │ You: Fix bug in posOrder            ││
│      │  │                                     ││
│      │  │ 🤖 Kiro: Analyzing...               ││
│      │  │ Using Claude 2 (15k tokens)         ││
│ • Ch │  │                                     ││
│ • Ta │  │ Found 3 issues:                     ││
│ • Lo │  │ 1. Race condition (Critical)        ││
│ • Fi │  │ 2. Missing validation (High)        ││
│ • Gi │  │ 3. Performance (Medium)             ││
│ • Pr │  │                                     ││
│      │  │ Fix which one first?                ││
│      │  └─────────────────────────────────────┘│
│      │  [Type message...] [Send]              │
├──────┴─────────────────────────────────────────┤
│  Footer: Provider Status | Token Usage         │
└────────────────────────────────────────────────┘
```

---

### REQ-UI-002: Real-time Updates
**Priority**: P0 (Critical)

**Features**:
- Live task progress
- Live logs streaming
- Live provider status
- Live token usage

**Tech**: WebSocket

---

## 7. NON-FUNCTIONAL REQUIREMENTS

### NFR-001: Performance
- API response time < 200ms
- WebSocket latency < 50ms
- File operations < 100ms
- UI smooth 60 FPS

### NFR-002: Scalability
- Support 10+ projects
- Support 20+ AI providers
- Handle 1000+ tasks in queue
- Handle 100+ parallel agents

### NFR-003: Security
- Encrypt API keys at rest
- HTTPS only
- No API keys in logs
- Rate limiting on API endpoints

### NFR-004: Reliability
- 99.9% uptime
- Auto-reconnect WebSocket
- Graceful degradation
- Data persistence (IndexedDB/SQLite)

---

## 8. SUCCESS METRICS

1. **Adoption**: >= 5 active users
2. **Time Saved**: 50% reduction in debug time
3. **Token Efficiency**: 30% cost reduction via rotation
4. **Satisfaction**: >= 4.5/5 stars
5. **Bugs Fixed**: >= 80% success rate

---

**Version**: 1.0.0  
**Last Updated**: 2026-06-23  
**Status**: Draft
