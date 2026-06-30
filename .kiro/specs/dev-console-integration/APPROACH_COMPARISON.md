# So sánh 2 Approaches: Tích hợp vs Standalone

## 📊 TỔNG QUAN

### Approach 1: Tích hợp vào App (Embedded)
Dev Console là một component overlay trong chính app CFO Brain

### Approach 2: Standalone App riêng (Separate)
Dev Console là một web app hoàn toàn độc lập, trỏ vào folder code của app

---

## ⚖️ SO SÁNH CHI TIẾT

| Tiêu chí | Approach 1: Embedded | Approach 2: Standalone | 🏆 Winner |
|----------|---------------------|------------------------|-----------|
| **Setup** | Đơn giản, chỉ thêm 1 component | Phải tạo project mới riêng | Embedded |
| **Context Awareness** | ✅ Biết user đang làm gì trong app | ❌ Không biết user context | Embedded |
| **Performance** | ⚠️ Dùng chung resources với app | ✅ Độc lập, không ảnh hưởng app | Standalone |
| **Multi-project** | ❌ Chỉ cho 1 app | ✅ Có thể quản lý nhiều projects | Standalone |
| **Production Safety** | ⚠️ Phải ensure không leak vào prod | ✅ Hoàn toàn tách biệt | Standalone |
| **File Access** | ⚠️ Giới hạn, cần API | ✅ Truy cập trực tiếp file system | Standalone |
| **Cross-IDE** | ❌ Chỉ trong app | ✅ Dùng được với VS Code, WebStorm... | Standalone |
| **Deployment** | Đơn giản, cùng app | Cần deploy riêng | Embedded |
| **Git Integration** | ⚠️ Phức tạp | ✅ Dễ dàng exec git commands | Standalone |
| **Maintenance** | Đơn giản, 1 codebase | Phức tạp, 2 codebases | Embedded |

---

## 🎯 KHUYẾN NGHỊ: **STANDALONE APP**

### Lý do:

1. **Tách biệt rõ ràng**: Dev tool ≠ Business app
2. **Đa năng hơn**: Có thể dùng cho nhiều projects
3. **File access tốt hơn**: Truy cập trực tiếp source code
4. **Không ảnh hưởng production**: 100% safe
5. **Mở rộng dễ hơn**: Có thể thêm features mạnh mẽ
6. **Tích hợp Git tốt hơn**: Execute git commands dễ dàng

---

## 🏗️ KIẾN TRÚC STANDALONE APP

```
┌───────────────────────────────────────────────────────┐
│         DEV CONSOLE (Standalone Web App)              │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │  Project Selector                               │ │
│  │  📁 CFO Brain 4.0                              │ │
│  │  📁 Shopee Automation (inactive)               │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │  💬 Chat | 📋 Tasks | 📄 Logs | 📂 Files       │ │
│  ├─────────────────────────────────────────────────┤ │
│  │                                                 │ │
│  │  Kiro: Đã scan 120 files trong                │ │
│  │  /Users/apple/phucsang app/QU-N-TR-C-A-H-NG  │ │
│  │                                                 │ │
│  │  Found 15 bugs:                                │ │
│  │  • BUG-001: Race condition (Critical)         │ │
│  │  • BUG-002: Security issue (High)             │ │
│  │  ...                                           │ │
│  │                                                 │ │
│  └─────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────┘
                    ↕ File System Access
┌───────────────────────────────────────────────────────┐
│  /Users/apple/phucsang app/QU-N-TR-C-A-H-NG/         │
│  ├── src/                                             │
│  ├── server/                                          │
│  ├── .kiro/                                           │
│  └── ...                                              │
└───────────────────────────────────────────────────────┘
```

---

## 📁 STRUCTURE CỦA STANDALONE APP

```
dev-console/                    # Project mới hoàn toàn
├── package.json
├── .env.local
│   # AI_PROVIDERS=claude1,claude2,codex1,codex2
│   # CLAUDE_KEY_1=sk-ant-xxx
│   # CLAUDE_KEY_2=sk-ant-yyy
│   # OPENAI_KEY_1=sk-xxx
│   # OPENAI_KEY_2=sk-yyy
│
├── frontend/                   # React app
│   ├── src/
│   │   ├── components/
│   │   │   ├── ProjectSelector.tsx
│   │   │   ├── ChatPanel.tsx
│   │   │   ├── TaskMonitor.tsx
│   │   │   ├── FileExplorer.tsx
│   │   │   └── CodeEditor.tsx
│   │   └── App.tsx
│   └── vite.config.ts
│
├── backend/                    # Node.js server
│   ├── src/
│   │   ├── agents/
│   │   │   ├── orchestrator.ts     # Kiro
│   │   │   ├── bugHunter.ts
│   │   │   ├── codeAnalyzer.ts
│   │   │   └── codeFixer.ts
│   │   ├── services/
│   │   │   ├── fileSystem.ts       # Đọc/ghi files
│   │   │   ├── gitService.ts       # Git operations
│   │   │   ├── aiProvider.ts       # QUAN TRỌNG: Xoay tua API keys
│   │   │   └── projectManager.ts   # Quản lý nhiều projects
│   │   ├── routes/
│   │   │   └── api.ts
│   │   └── server.ts
│   └── package.json
│
└── .kiro-config.json           # Config cho dev console
    {
      "projects": [
        {
          "name": "CFO Brain 4.0",
          "path": "/Users/apple/phucsang app/QU-N-TR-C-A-H-NG",
          "type": "react-typescript",
          "active": true
        },
        {
          "name": "Shopee Automation",
          "path": "/Users/apple/shopee-auto",
          "type": "playwright",
          "active": false
        }
      ],
      "aiProviders": {
        "rotation": true,                    # ← BẬT XOAY TUA
        "providers": [
          {
            "name": "Claude Account 1",
            "type": "anthropic",
            "key": "${CLAUDE_KEY_1}",
            "rateLimit": {
              "tokensPerMinute": 40000,
              "requestsPerMinute": 50
            },
            "priority": 1
          },
          {
            "name": "Claude Account 2", 
            "type": "anthropic",
            "key": "${CLAUDE_KEY_2}",
            "priority": 2
          },
          {
            "name": "Codex Account 1",
            "type": "openai",
            "model": "gpt-4",
            "key": "${OPENAI_KEY_1}",
            "priority": 3
          }
        ]
      }
    }
```

---

## 🔄 GIẢI PHÁP: XOAY TUA NHIỀU API KEYS

### Cách hoạt động:

```typescript
// backend/src/services/aiProvider.ts

interface AIProvider {
  name: string;
  type: 'anthropic' | 'openai';
  key: string;
  tokensUsed: number;
  tokensLimit: number;
  requestsUsed: number;
  requestsLimit: number;
  lastReset: Date;
  status: 'active' | 'rate_limited' | 'error';
  priority: number;
}

class AIProviderRotation {
  private providers: AIProvider[] = [];
  private currentIndex = 0;
  
  constructor(config: any) {
    this.loadProviders(config);
  }
  
  /**
   * Lấy provider khả dụng tiếp theo
   * Tự động skip providers đã hết quota
   */
  async getNextAvailableProvider(): Promise<AIProvider> {
    // Thử tất cả providers theo vòng tròn
    for (let i = 0; i < this.providers.length; i++) {
      const provider = this.providers[this.currentIndex];
      
      // Check rate limit
      if (this.isProviderAvailable(provider)) {
        console.log(`✅ Using ${provider.name}`);
        return provider;
      }
      
      console.log(`⏭️  Skipping ${provider.name} (rate limited)`);
      this.currentIndex = (this.currentIndex + 1) % this.providers.length;
    }
    
    throw new Error('❌ All AI providers are rate limited! Wait or add more keys.');
  }
  
  /**
   * Kiểm tra provider còn quota không
   */
  private isProviderAvailable(provider: AIProvider): boolean {
    // Reset counters nếu đã qua 1 phút
    const now = new Date();
    const elapsed = now.getTime() - provider.lastReset.getTime();
    if (elapsed > 60000) { // 1 minute
      provider.tokensUsed = 0;
      provider.requestsUsed = 0;
      provider.lastReset = now;
      provider.status = 'active';
    }
    
    // Check limits
    if (provider.tokensUsed >= provider.tokensLimit) {
      provider.status = 'rate_limited';
      return false;
    }
    
    if (provider.requestsUsed >= provider.requestsLimit) {
      provider.status = 'rate_limited';
      return false;
    }
    
    return provider.status === 'active';
  }
  
  /**
   * Gọi AI với auto-rotation
   */
  async callAI(prompt: string, options?: any): Promise<any> {
    const provider = await this.getNextAvailableProvider();
    
    try {
      let response;
      
      if (provider.type === 'anthropic') {
        response = await this.callClaude(provider, prompt, options);
      } else if (provider.type === 'openai') {
        response = await this.callOpenAI(provider, prompt, options);
      }
      
      // Update usage
      provider.tokensUsed += response.usage.total_tokens;
      provider.requestsUsed += 1;
      
      // Rotate to next provider for next request
      this.currentIndex = (this.currentIndex + 1) % this.providers.length;
      
      return response;
      
    } catch (error) {
      if (error.message.includes('rate_limit')) {
        console.warn(`⚠️  ${provider.name} hit rate limit, rotating...`);
        provider.status = 'rate_limited';
        
        // Retry với provider khác
        return this.callAI(prompt, options);
      }
      
      throw error;
    }
  }
  
  /**
   * Gọi Claude API
   */
  private async callClaude(provider: AIProvider, prompt: string, options: any) {
    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey: provider.key });
    
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: options?.maxTokens || 4096,
      messages: [{ role: 'user', content: prompt }],
    });
    
    return {
      content: response.content[0].text,
      usage: {
        total_tokens: response.usage.input_tokens + response.usage.output_tokens,
      },
    };
  }
  
  /**
   * Gọi OpenAI API
   */
  private async callOpenAI(provider: AIProvider, prompt: string, options: any) {
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: provider.key });
    
    const response = await openai.chat.completions.create({
      model: options?.model || 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
    });
    
    return {
      content: response.choices[0].message.content,
      usage: {
        total_tokens: response.usage.total_tokens,
      },
    };
  }
  
  /**
   * Lấy thống kê providers
   */
  getProviderStats() {
    return this.providers.map(p => ({
      name: p.name,
      status: p.status,
      usage: `${p.tokensUsed}/${p.tokensLimit} tokens`,
      requests: `${p.requestsUsed}/${p.requestsLimit} requests`,
    }));
  }
}

// Singleton instance
export const aiProvider = new AIProviderRotation(config);
```

### Cách dùng:

```typescript
// Trong agent code
import { aiProvider } from './services/aiProvider';

async function analyzeCode(code: string) {
  // Tự động xoay tua, không cần quan tâm dùng key nào
  const response = await aiProvider.callAI(
    `Analyze this code for bugs:\n\n${code}`
  );
  
  return response.content;
}

// Check trạng thái providers
const stats = aiProvider.getProviderStats();
console.log(stats);
// [
//   { name: 'Claude 1', status: 'active', usage: '12k/40k tokens', ... },
//   { name: 'Claude 2', status: 'rate_limited', usage: '40k/40k tokens', ... },
//   { name: 'Codex 1', status: 'active', usage: '5k/90k tokens', ... }
// ]
```

---

## 💡 LỢI ÍCH CỦA STANDALONE + ROTATION

### 1. **Unlimited Scaling**
- 10 tài khoản Claude = 400k tokens/phút thay vì 40k
- Có thể chạy 10 agents parallel

### 2. **Cost Optimization**
- Dùng Claude cho analysis (accurate)
- Dùng GPT-4 cho code generation (faster)
- Dùng GPT-3.5 cho simple tasks (cheaper)

### 3. **Fault Tolerance**
- 1 key bị rate limit → Auto switch sang key khác
- 1 provider down → Fallback sang provider khác

### 4. **Multi-Project Support**
- Quản lý nhiều projects từ 1 console
- Share providers giữa các projects

### 5. **Better File Access**
- Đọc/ghi files trực tiếp
- Execute git commands
- Run tests
- Build project

---

## 🎯 QUYẾT ĐỊNH CUỐI CÙNG

### KHUYẾN NGHỊ: **Standalone App với AI Rotation**

**Lý do**:
1. ✅ Linh hoạt hơn nhiều
2. ✅ Có thể xoay tua API keys (giải quyết vấn đề token)
3. ✅ Dùng được cho nhiều projects
4. ✅ Không ảnh hưởng app chính
5. ✅ Mở rộng dễ hơn

**Trade-off chấp nhận được**:
- Setup phức tạp hơn 1 chút (nhưng làm 1 lần)
- Phải maintain 2 codebases (nhưng tách biệt rõ ràng)

---

## 📋 NEXT STEPS

Nếu đồng ý approach này, mình sẽ:

1. **Tạo spec cho Standalone Dev Console**
2. **Design AI Provider Rotation system** chi tiết
3. **Quick start guide** để setup nhanh
4. **Demo code** cho rotation mechanism

Bạn muốn mình làm step nào trước? 🚀
