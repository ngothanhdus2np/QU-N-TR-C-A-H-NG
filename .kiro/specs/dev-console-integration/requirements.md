# Requirements: Dev Console - Multi-Agent Integration

## 📋 TỔNG QUAN

Tích hợp hệ thống Multi-Agent vào trong app CFO Brain 4.0 dưới dạng một **Dev Console** chỉ xuất hiện ở chế độ development, cho phép developer tương tác trực tiếp với các AI agents.

---

## 🎯 MỤC TIÊU

### Primary Goals:
1. **Tương tác real-time** với agents ngay trong app
2. **Monitor** tiến độ công việc của agents
3. **Debug** code và fix bugs mà không cần rời app
4. **Rapid development** - Ask AI anything về codebase
5. **Visual feedback** - Xem agents đang làm gì

### User Stories:

**Story 1**: Developer nhìn thấy bug khi test
```
Dev click vào bug → Console hiện lên → 
Type: "Fix bug này" → 
AI agents tự động analyze → fix → test → commit
```

**Story 2**: Developer cần hiểu một function phức tạp
```
Dev highlight function → Right click "Ask AI" →
Claude Code explain chi tiết với examples
```

**Story 3**: Developer muốn add feature mới
```
Dev: "Thêm chức năng export PDF"
→ Kiro tạo spec
→ Claude design architecture  
→ Codex implement
→ Dev review trong console
```

---

## ⚙️ FUNCTIONAL REQUIREMENTS


### REQ-1: Dev Console UI Component

**Description**: Một floating panel xuất hiện khi bật dev mode

**Acceptance Criteria**:
1. Panel có thể drag, resize, minimize
2. Hotkey: `Cmd+Shift+D` để toggle console
3. Có 3 tabs:
   - **Chat**: Nói chuyện với Kiro/agents
   - **Tasks**: Xem danh sách tasks đang chạy
   - **Logs**: Real-time logs từ agents
4. Panel persist position qua sessions (localStorage)
5. Theme: Dark mode để không chói mắt

---

### REQ-2: Chat Interface với Kiro

**Description**: Chat trực tiếp với Kiro Orchestrator

**Acceptance Criteria**:
1. Input box với auto-complete
2. Hỗ trợ markdown rendering cho responses
3. Code blocks có syntax highlighting
4. Có thể attach files/screenshots
5. History messages được lưu (IndexedDB)
6. Suggested prompts:
   - "Fix bug trong file đang mở"
   - "Explain function này"
   - "Run full audit"
   - "Optimize performance"
7. Typing indicator khi agent đang suy nghĩ
8. Token usage indicator (số token đã dùng)

**Example UI**:
```
┌─────────────────────────────────────────────┐
│  💬 Chat with Kiro                    [_][□][×]│
├─────────────────────────────────────────────┤
│                                             │
│  You: Fix bug trong posOrderService        │
│  10:30 AM                                   │
│                                             │
│  🤖 Kiro: Đang phân tích...                │
│  ⏱️ Token: 1.2k / 200k                     │
│                                             │
│  ✅ Đã tìm thấy 3 issues:                   │
│  1. Race condition (Line 145) - Critical   │
│  2. Missing validation (Line 89) - High    │
│  3. Performance issue (Line 201) - Medium  │
│                                             │
│  Bạn muốn fix cái nào trước?               │
│  10:31 AM                                   │
│                                             │
├─────────────────────────────────────────────┤
│ Type a message...               📎 Send    │
└─────────────────────────────────────────────┘
```

---

### REQ-3: Task Monitor

**Description**: Theo dõi real-time progress của các tasks

**Acceptance Criteria**:
1. List tất cả active tasks
2. Mỗi task hiển thị:
   - Task ID
   - Title
   - Agent đang xử lý
   - Progress % (với progress bar)
   - Estimated time remaining
   - Status (queued, in_progress, completed, failed)
3. Click vào task → Xem chi tiết logs
4. Có thể pause/cancel task
5. Completed tasks có expand/collapse
6. Real-time updates (WebSocket hoặc polling)

**Example UI**:
```
┌─────────────────────────────────────────────┐
│  📋 Active Tasks                      [_][□][×]│
├─────────────────────────────────────────────┤
│ 🔧 In Progress (2)                          │
│                                             │
│ ┌─────────────────────────────────────────┐│
│ │ TASK-001: Fix race condition            ││
│ │ Agent: Codex                            ││
│ │ [████████░░░░] 65%                      ││
│ │ ETA: 5 minutes                          ││
│ │ [Pause] [Cancel] [Details]             ││
│ └─────────────────────────────────────────┘│
│                                             │
│ ┌─────────────────────────────────────────┐│
│ │ TASK-002: Security scan                 ││
│ │ Agent: Security Scanner                 ││
│ │ [██░░░░░░░░░░] 15%                      ││
│ │ ETA: 12 minutes                         ││
│ └─────────────────────────────────────────┘│
│                                             │
│ ⏸️  Queued (3)                              │
│ • TASK-003: Performance optimization       │
│ • TASK-004: Write tests                    │
│ • TASK-005: Update docs                    │
│                                             │
│ ✅ Completed (5) [Show]                     │
└─────────────────────────────────────────────┘
```

---

### REQ-4: Real-time Logs Viewer

**Description**: Xem logs của agents real-time

**Acceptance Criteria**:
1. Stream logs từ tất cả agents
2. Filter logs by:
   - Agent name
   - Log level (debug, info, warn, error)
   - Time range
3. Search trong logs
4. Color-coded log levels
5. Auto-scroll to bottom (có thể disable)
6. Export logs to file
7. Clear logs button

**Example UI**:
```
┌─────────────────────────────────────────────┐
│  📄 Logs                              [_][□][×]│
├─────────────────────────────────────────────┤
│ Filter: [All Agents ▾] [All Levels ▾] 🔍   │
├─────────────────────────────────────────────┤
│ 10:30:15 [Kiro] INFO Task TASK-001 started │
│ 10:30:16 [Claude] INFO Analyzing file...   │
│ 10:30:18 [Claude] WARN Found race condition│
│ 10:30:20 [Codex] INFO Writing fix...       │
│ 10:30:25 [Codex] DEBUG Token usage: 2.5k   │
│ 10:30:30 [TestEng] INFO Running tests...   │
│ 10:30:32 [TestEng] ✅ All tests passed     │
│                                             │
│ ↓ Auto-scroll: ON                           │
├─────────────────────────────────────────────┤
│                        [Clear] [Export]     │
└─────────────────────────────────────────────┘
```

---

### REQ-5: Quick Actions

**Description**: Shortcuts cho các actions thường dùng

**Acceptance Criteria**:
1. Floating action button với menu:
   ```
   💬 Chat with Kiro
   🐛 Report Bug
   🔍 Run Audit
   ⚡ Quick Fix
   📊 Performance Analysis
   🔒 Security Scan
   📝 Generate Docs
   ```
2. Mỗi action mở dialog tương ứng
3. Context-aware actions:
   - Nếu đang mở file → "Analyze this file"
   - Nếu đang select code → "Explain this code"
   - Nếu có error → "Fix this error"

---

### REQ-6: Agent Status Indicator

**Description**: Hiển thị status của các agents

**Acceptance Criteria**:
1. Badge nhỏ góc màn hình hiển thị:
   ```
   🤖 3 agents working
   📊 5 tasks in queue
   ```
2. Click vào badge → Mở console
3. Color coding:
   - 🟢 Green: Idle
   - 🟡 Yellow: Working
   - 🔴 Red: Error/blocked
4. Animation khi agents đang work

---

### REQ-7: Code Context Integration

**Description**: Tích hợp với code editor

**Acceptance Criteria**:
1. Right-click menu trong code:
   ```
   → Ask AI about this
   → Fix this function
   → Add tests for this
   → Optimize this
   ```
2. Inline suggestions (như Copilot)
3. Hover over function → Show AI explanation
4. Error squiggles từ AI analysis

---

### REQ-8: File Watcher Integration

**Description**: Agents monitor file changes

**Acceptance Criteria**:
1. Khi save file → Auto trigger analysis
2. Notification nếu phát hiện issues:
   ```
   ⚠️ Detected potential bug in posOrderService.ts
   [View Details] [Ignore] [Fix Now]
   ```
3. Setting để enable/disable auto-analysis
4. Rate limiting để không spam

---

### REQ-9: Visual Diff Viewer

**Description**: Xem changes từ agents

**Acceptance Criteria**:
1. Side-by-side diff viewer
2. Syntax highlighting
3. Accept/reject changes per hunk
4. Accept all / Reject all buttons
5. Comment on changes
6. View git diff style

**Example UI**:
```
┌─────────────────────────────────────────────┐
│  📝 Changes from Codex            [_][□][×]│
├─────────────────────────────────────────────┤
│ File: services/posOrderService.ts           │
│                                             │
│ Line 145-150                                │
│ - const result = await processOrder();     │
│ + const result = await withLock(           │
│ +   'order_lock',                           │
│ +   async () => await processOrder()       │
│ + );                                        │
│                                             │
│ [✓ Accept] [✗ Reject] [💬 Comment]         │
├─────────────────────────────────────────────┤
│ 3 changes in 2 files                        │
│               [Accept All] [Reject All]     │
└─────────────────────────────────────────────┘
```

---

### REQ-10: Performance Metrics

**Description**: Monitor agent performance

**Acceptance Criteria**:
1. Dashboard hiển thị:
   - Token usage per agent
   - Average task completion time
   - Success rate
   - Number of handoffs
2. Charts cho trends
3. Export metrics to CSV

---

## 🔧 TECHNICAL REQUIREMENTS

### TECH-1: Backend API

**Endpoints needed**:
```typescript
// Agent communication
POST   /api/dev/agent/chat
POST   /api/dev/agent/task/create
GET    /api/dev/agent/task/:id
DELETE /api/dev/agent/task/:id
GET    /api/dev/agent/tasks/active
GET    /api/dev/agent/logs

// File operations
POST   /api/dev/file/analyze
POST   /api/dev/file/fix
GET    /api/dev/file/diff/:taskId

// Metrics
GET    /api/dev/metrics/agents
GET    /api/dev/metrics/tokens
```

### TECH-2: WebSocket for Real-time Updates

**Events**:
```typescript
// Client → Server
'agent.chat'          // Send message to agent
'task.subscribe'      // Subscribe to task updates
'task.cancel'         // Cancel task

// Server → Client  
'agent.response'      // Agent replied
'task.progress'       // Task progress update
'task.completed'      // Task finished
'log.new'             // New log entry
'file.changed'        // File was modified by agent
```

### TECH-3: Security

**Requirements**:
1. Console chỉ available khi `NODE_ENV=development`
2. API endpoints require dev token
3. Rate limiting: 100 requests/minute per user
4. Validate all inputs từ console
5. Sanitize code snippets

### TECH-4: Storage

**IndexedDB Schema**:
```typescript
interface DevConsoleDB {
  chatHistory: {
    id: string;
    timestamp: Date;
    user: string;
    agent: string;
    message: string;
    metadata?: any;
  }[];
  
  tasks: {
    id: string;
    title: string;
    status: 'queued' | 'in_progress' | 'completed' | 'failed';
    agent: string;
    progress: number;
    createdAt: Date;
    completedAt?: Date;
  }[];
  
  settings: {
    consolePosition: { x: number; y: number };
    consoleSize: { width: number; height: number };
    autoAnalysis: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  };
}
```

---

## 🎨 UI/UX REQUIREMENTS

### UX-1: Performance

**Requirements**:
1. Console load time < 500ms
2. Chat response time < 2s (or show "thinking")
3. Smooth animations (60 FPS)
4. No blocking main thread
5. Lazy load tabs

### UX-2: Accessibility

**Requirements**:
1. Keyboard navigation support
2. Screen reader compatible
3. High contrast mode
4. Focus indicators
5. ARIA labels

### UX-3: Mobile Responsive

**Requirements**:
1. Responsive layout cho different screen sizes
2. Touch-friendly buttons (min 44px)
3. Swipe gestures
4. Collapsible sections

---

## 📱 INTEGRATION POINTS

### INT-1: Với Vite Dev Server

**Requirements**:
1. Hot reload khi code thay đổi
2. Console persist qua HMR
3. Error overlay integration

### INT-2: Với TypeScript

**Requirements**:
1. Type checking real-time
2. Show TypeScript errors trong console
3. Auto-fix TypeScript issues

### INT-3: Với Git

**Requirements**:
1. Show current branch
2. Auto-commit khi agent fix xong
3. Create branches cho big changes
4. Show git diff trong console

### INT-4: Với Testing Framework

**Requirements**:
1. Run tests from console
2. Show test results real-time
3. Debug failing tests
4. Coverage reports

---

## 🚫 NON-FUNCTIONAL REQUIREMENTS

### NFR-1: Performance

- Console không làm chậm app
- Max memory usage: 100MB
- Agent responses: < 5s for simple queries

### NFR-2: Reliability

- Console crash không làm crash app
- Auto-reconnect WebSocket khi disconnect
- Graceful degradation khi API down

### NFR-3: Scalability

- Support multiple agents chạy parallel
- Handle 1000+ log entries
- Support 100+ tasks trong history

---

## 📦 DELIVERABLES

1. **Dev Console Component** (`src/dev/DevConsole.tsx`)
2. **Backend API** (`server/routes/dev.ts`)
3. **WebSocket Server** (`server/dev-socket.ts`)
4. **Agent SDK** (để agents communicate với console)
5. **Documentation** (Cách dùng dev console)
6. **Demo Video** (Screen recording)

---

## 🎯 SUCCESS METRICS

1. **Adoption**: >= 80% developers sử dụng console
2. **Time Saved**: Giảm 50% thời gian debug/fix bugs
3. **Satisfaction**: >= 4/5 stars rating
4. **Bugs Fixed**: Agents fix >= 70% bugs correctly
5. **Performance**: No performance degradation in dev mode

---

## 📅 TIMELINE

**Week 1**: Backend API + WebSocket
**Week 2**: Console UI (Chat + Tasks)
**Week 3**: Logs + Quick Actions
**Week 4**: Code Integration + Diff Viewer  
**Week 5**: Testing + Polish
**Week 6**: Documentation + Demo

---

## 🔮 FUTURE ENHANCEMENTS

- Voice commands: "Hey Kiro, fix this bug"
- AI pair programming mode
- Multi-user collaboration (team mode)
- Cloud sync của chat history
- Mobile app cho monitor agents
- Integration với Slack/Discord
- Auto-deployment after fixes

---

**Version**: 1.0.0  
**Status**: Draft  
**Owner**: Development Team
