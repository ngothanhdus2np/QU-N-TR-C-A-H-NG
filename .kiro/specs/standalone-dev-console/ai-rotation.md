# AI Provider Rotation System

## 📋 TỔNG QUAN

Hệ thống tự động xoay tua giữa nhiều AI providers (Claude, GPT, Gemini...) để:
- ✅ Tránh rate limits
- ✅ Tối ưu chi phí
- ✅ Tăng throughput
- ✅ High availability

---

## 🎯 MỤC TIÊU

### Primary Goals:
1. **Never hit rate limit** - Tự động switch trước khi hết quota
2. **Cost optimization** - Dùng provider rẻ nhất phù hợp
3. **High throughput** - 10x tokens/phút với 10 accounts
4. **Fault tolerance** - 1 provider down không ảnh hưởng

### Use Cases:

**Scenario 1**: Nhiều requests liên tục
```
Request 1 → Claude Key 1 (40k/40k tokens remaining)
Request 2 → Claude Key 2 (40k/40k tokens remaining)
Request 3 → Claude Key 1 (35k/40k tokens remaining)
Request 4 → Claude Key 2 (36k/40k tokens remaining)
... continuous rotation
```

**Scenario 2**: Một key hết quota
```
Request 1 → Claude Key 1 (2k/40k tokens remaining)
  Uses 3k tokens → Hit limit!
  
Auto-switch:
Request 2 → Claude Key 2 (40k/40k tokens available) ✅
Request 3 → GPT Key 1 (90k/90k tokens available) ✅
Request 4 → Claude Key 1 (40k/40k - Reset after 1 min) ✅
```

---

## 🏗️ ARCHITECTURE

```
┌─────────────────────────────────────────────────────┐
│           AI Provider Rotation Manager              │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────────────────────────────────────────┐  │
│  │         Provider Pool                       │  │
│  │                                             │  │
│  │  [Claude 1] [Claude 2] [GPT 1] [Gemini]   │  │
│  │   Active    Rate Ltd    Active    Active   │  │
│  └─────────────────────────────────────────────┘  │
│                      │                             │
│                      ↓                             │
│  ┌─────────────────────────────────────────────┐  │
│  │      Selection Strategy                     │  │
│  │  • Round Robin                              │  │
│  │  • Priority-based                           │  │
│  │  • Cost-optimized                           │  │
│  │  • Task-specific                            │  │
│  └─────────────────────────────────────────────┘  │
│                      │                             │
│                      ↓                             │
│  ┌─────────────────────────────────────────────┐  │
│  │      Rate Limit Tracker                     │  │
│  │  • Token counter                            │  │
│  │  • Request counter                          │  │
│  │  • Auto-reset every 60s                     │  │
│  └─────────────────────────────────────────────┘  │
│                      │                             │
│                      ↓                             │
│  ┌─────────────────────────────────────────────┐  │
│  │         API Client                          │  │
│  │  • Anthropic SDK                            │  │
│  │  • OpenAI SDK                               │  │
│  │  • Google AI SDK                            │  │
│  └─────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

## 💻 IMPLEMENTATION

### 1. Provider Configuration

```typescript
// .kiro-config.json
{
  "aiProviders": {
    "rotationEnabled": true,
    "strategy": "smart", // round_robin | priority | cost | smart
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
          "requestsPerMinute": 50,
          "tokensPerDay": 1000000
        },
        "cost": {
          "inputTokenCost": 3.0,  // USD per 1M tokens
          "outputTokenCost": 15.0
        },
        "features": ["analysis", "code_review", "bug_detection"],
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
      },
      {
        "id": "gpt-4-1",
        "name": "GPT-4 Account 1",
        "type": "openai",
        "model": "gpt-4-turbo",
        "apiKey": "${OPENAI_KEY_1}",
        "priority": 3,
        "rateLimit": {
          "tokensPerMinute": 90000,
          "requestsPerMinute": 500
        },
        "cost": {
          "inputTokenCost": 10.0,
          "outputTokenCost": 30.0
        },
        "features": ["code_generation", "creative_tasks"],
        "enabled": true
      },
      {
        "id": "gpt-3.5-1",
        "name": "GPT-3.5 Account 1",
        "type": "openai",
        "model": "gpt-3.5-turbo",
        "apiKey": "${OPENAI_KEY_2}",
        "priority": 10, // Low priority, use only when others unavailable
        "rateLimit": {
          "tokensPerMinute": 90000,
          "requestsPerMinute": 3500
        },
        "cost": {
          "inputTokenCost": 0.5,
          "outputTokenCost": 1.5
        },
        "features": ["simple_tasks", "fast_responses"],
        "enabled": true
      }
    ]
  }
}
```

---

### 2. Core Implementation

```typescript
// backend/src/services/AIProvider.ts

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

interface Provider {
  id: string;
  name: string;
  type: 'anthropic' | 'openai' | 'google';
  model: string;
  apiKey: string;
  priority: number;
  
  rateLimit: {
    tokensPerMinute: number;
    requestsPerMinute: number;
    tokensPerDay?: number;
  };
  
  usage: {
    tokensUsed: number;
    requestsUsed: number;
    tokensUsedToday: number;
    lastReset: Date;
    dailyReset: Date;
  };
  
  status: 'active' | 'rate_limited' | 'error' | 'disabled';
  
  cost: {
    inputTokenCost: number;
    outputTokenCost: number;
    totalSpent: number;
  };
  
  features: string[];
  client?: any; // SDK instance
}

export class AIProviderRotation {
  private providers: Map<string, Provider> = new Map();
  private currentIndex = 0;
  private strategy: 'round_robin' | 'priority' | 'cost' | 'smart';
  
  constructor(config: any) {
    this.strategy = config.strategy || 'smart';
    this.initializeProviders(config.providers);
    this.startResetTimer();
  }
  
  /**
   * Initialize providers và create SDK clients
   */
  private initializeProviders(configs: any[]) {
    for (const config of configs) {
      if (!config.enabled) continue;
      
      const provider: Provider = {
        ...config,
        usage: {
          tokensUsed: 0,
          requestsUsed: 0,
          tokensUsedToday: 0,
          lastReset: new Date(),
          dailyReset: new Date(),
        },
        status: 'active',
        cost: {
          ...config.cost,
          totalSpent: 0,
        },
      };
      
      // Create SDK client
      if (config.type === 'anthropic') {
        provider.client = new Anthropic({ apiKey: config.apiKey });
      } else if (config.type === 'openai') {
        provider.client = new OpenAI({ apiKey: config.apiKey });
      }
      
      this.providers.set(config.id, provider);
    }
    
    console.log(`✅ Initialized ${this.providers.size} AI providers`);
  }
  
  /**
   * Timer để reset usage counters
   */
  private startResetTimer() {
    // Reset mỗi phút
    setInterval(() => {
      const now = new Date();
      
      for (const [id, provider] of this.providers) {
        const elapsed = now.getTime() - provider.usage.lastReset.getTime();
        
        if (elapsed >= 60000) { // 1 minute
          provider.usage.tokensUsed = 0;
          provider.usage.requestsUsed = 0;
          provider.usage.lastReset = now;
          
          // Clear rate limit status nếu đã reset
          if (provider.status === 'rate_limited') {
            provider.status = 'active';
            console.log(`🔄 ${provider.name}: Rate limit reset`);
          }
        }
      }
      
      // Daily reset
      for (const [id, provider] of this.providers) {
        const dayElapsed = now.getTime() - provider.usage.dailyReset.getTime();
        
        if (dayElapsed >= 86400000) { // 24 hours
          provider.usage.tokensUsedToday = 0;
          provider.usage.dailyReset = now;
          console.log(`📅 ${provider.name}: Daily counter reset`);
        }
      }
    }, 10000); // Check every 10 seconds
  }
  
  /**
   * Select provider based on strategy
   */
  private async selectProvider(
    task?: { type?: string; estimatedTokens?: number }
  ): Promise<Provider> {
    const available = Array.from(this.providers.values())
      .filter(p => this.isProviderAvailable(p, task));
    
    if (available.length === 0) {
      throw new Error('❌ No available AI providers! All rate limited or disabled.');
    }
    
    switch (this.strategy) {
      case 'round_robin':
        return this.selectRoundRobin(available);
      
      case 'priority':
        return this.selectByPriority(available);
      
      case 'cost':
        return this.selectByCost(available, task);
      
      case 'smart':
        return this.selectSmart(available, task);
      
      default:
        return available[0];
    }
  }
  
  /**
   * Check if provider is available
   */
  private isProviderAvailable(provider: Provider, task?: any): boolean {
    if (provider.status !== 'active') return false;
    
    // Check rate limits
    const { tokensPerMinute, requestsPerMinute, tokensPerDay } = provider.rateLimit;
    const { tokensUsed, requestsUsed, tokensUsedToday } = provider.usage;
    
    // Leave 10% buffer to avoid hitting exact limit
    const tokenBuffer = tokensPerMinute * 0.1;
    const requestBuffer = requestsPerMinute * 0.1;
    
    if (tokensUsed + tokenBuffer >= tokensPerMinute) {
      return false;
    }
    
    if (requestsUsed + requestBuffer >= requestsPerMinute) {
      return false;
    }
    
    if (tokensPerDay && tokensUsedToday >= tokensPerDay) {
      return false;
    }
    
    // Check if provider supports task features
    if (task?.type && provider.features.length > 0) {
      const hasFeature = provider.features.some(f => 
        task.type.includes(f) || f === 'all'
      );
      if (!hasFeature) return false;
    }
    
    return true;
  }
  
  /**
   * Round Robin selection
   */
  private selectRoundRobin(providers: Provider[]): Provider {
    const provider = providers[this.currentIndex % providers.length];
    this.currentIndex++;
    return provider;
  }
  
  /**
   * Priority-based selection
   */
  private selectByPriority(providers: Provider[]): Provider {
    return providers.sort((a, b) => a.priority - b.priority)[0];
  }
  
  /**
   * Cost-optimized selection
   */
  private selectByCost(providers: Provider[], task?: any): Provider {
    const estimatedTokens = task?.estimatedTokens || 1000;
    
    return providers.sort((a, b) => {
      const costA = (a.cost.inputTokenCost + a.cost.outputTokenCost) * 
                    (estimatedTokens / 1000000);
      const costB = (b.cost.inputTokenCost + b.cost.outputTokenCost) * 
                    (estimatedTokens / 1000000);
      return costA - costB;
    })[0];
  }
  
  /**
   * Smart selection (combines all strategies)
   */
  private selectSmart(providers: Provider[], task?: any): Provider {
    // For simple tasks, prefer cheap providers
    if (task?.type?.includes('simple') || 
        (task?.estimatedTokens && task.estimatedTokens < 500)) {
      return this.selectByCost(providers, task);
    }
    
    // For critical tasks, prefer high-priority (usually better models)
    if (task?.type?.includes('critical') || task?.type?.includes('analysis')) {
      return this.selectByPriority(providers);
    }
    
    // Default: Round robin
    return this.selectRoundRobin(providers);
  }
  
  /**
   * Main method: Call AI với auto-rotation
   */
  async callAI(
    prompt: string,
    options?: {
      systemPrompt?: string;
      maxTokens?: number;
      temperature?: number;
      taskType?: string;
      estimatedTokens?: number;
    }
  ): Promise<{
    content: string;
    usage: { inputTokens: number; outputTokens: number; totalTokens: number };
    provider: string;
    cost: number;
  }> {
    const task = {
      type: options?.taskType,
      estimatedTokens: options?.estimatedTokens,
    };
    
    const provider = await this.selectProvider(task);
    
    console.log(`🤖 Using ${provider.name} for request`);
    
    try {
      let response;
      
      if (provider.type === 'anthropic') {
        response = await this.callClaude(provider, prompt, options);
      } else if (provider.type === 'openai') {
        response = await this.callOpenAI(provider, prompt, options);
      } else {
        throw new Error(`Unsupported provider type: ${provider.type}`);
      }
      
      // Update usage
      provider.usage.tokensUsed += response.usage.totalTokens;
      provider.usage.requestsUsed += 1;
      provider.usage.tokensUsedToday += response.usage.totalTokens;
      
      // Calculate cost
      const cost = 
        (response.usage.inputTokens * provider.cost.inputTokenCost / 1000000) +
        (response.usage.outputTokens * provider.cost.outputTokenCost / 1000000);
      
      provider.cost.totalSpent += cost;
      
      console.log(`✅ Request complete. Tokens: ${response.usage.totalTokens}, Cost: $${cost.toFixed(4)}`);
      
      return {
        ...response,
        provider: provider.name,
        cost,
      };
      
    } catch (error: any) {
      console.error(`❌ Error with ${provider.name}:`, error.message);
      
      // Handle rate limit errors
      if (error.status === 429 || error.message.includes('rate_limit')) {
        console.warn(`⚠️  ${provider.name} hit rate limit, marking as rate_limited`);
        provider.status = 'rate_limited';
        
        // Retry với provider khác
        console.log(`🔄 Retrying with different provider...`);
        return this.callAI(prompt, options);
      }
      
      // Handle other errors
      provider.status = 'error';
      throw error;
    }
  }
  
  /**
   * Call Claude API
   */
  private async callClaude(
    provider: Provider,
    prompt: string,
    options?: any
  ) {
    const messages: any[] = [
      { role: 'user', content: prompt }
    ];
    
    const response = await provider.client.messages.create({
      model: provider.model,
      max_tokens: options?.maxTokens || 4096,
      temperature: options?.temperature || 1.0,
      system: options?.systemPrompt,
      messages,
    });
    
    return {
      content: response.content[0].text,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
    };
  }
  
  /**
   * Call OpenAI API
   */
  private async callOpenAI(
    provider: Provider,
    prompt: string,
    options?: any
  ) {
    const messages: any[] = [];
    
    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    
    messages.push({ role: 'user', content: prompt });
    
    const response = await provider.client.chat.completions.create({
      model: provider.model,
      messages,
      max_tokens: options?.maxTokens,
      temperature: options?.temperature || 1.0,
    });
    
    return {
      content: response.choices[0].message.content || '',
      usage: {
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      },
    };
  }
  
  /**
   * Get provider statistics
   */
  getProviderStats() {
    return Array.from(this.providers.values()).map(p => ({
      id: p.id,
      name: p.name,
      status: p.status,
      usage: {
        tokens: `${p.usage.tokensUsed.toLocaleString()}/${p.rateLimit.tokensPerMinute.toLocaleString()}`,
        requests: `${p.usage.requestsUsed}/${p.rateLimit.requestsPerMinute}`,
        tokensToday: p.usage.tokensUsedToday.toLocaleString(),
        percentage: Math.round((p.usage.tokensUsed / p.rateLimit.tokensPerMinute) * 100),
      },
      cost: {
        totalSpent: `$${p.cost.totalSpent.toFixed(2)}`,
      },
    }));
  }
  
  /**
   * Manually disable/enable provider
   */
  setProviderStatus(id: string, status: Provider['status']) {
    const provider = this.providers.get(id);
    if (provider) {
      provider.status = status;
      console.log(`🔧 ${provider.name} status set to: ${status}`);
    }
  }
}

// Singleton instance
export const aiProvider = new AIProviderRotation(config);
```

---

### 3. Usage Example

```typescript
// backend/src/agents/Kiro.ts

import { aiProvider } from '../services/AIProvider';

export class Kiro {
  async analyzeCode(code: string): Promise<string> {
    // Chỉ cần gọi callAI, rotation tự động
    const response = await aiProvider.callAI(
      `Analyze this code for bugs:\n\n${code}`,
      {
        systemPrompt: 'You are Kiro, an expert code analyzer.',
        maxTokens: 4096,
        taskType: 'analysis', // Smart strategy sẽ prefer high-priority providers
        estimatedTokens: 2000,
      }
    );
    
    console.log(`Analysis done by ${response.provider}, cost $${response.cost.toFixed(4)}`);
    
    return response.content;
  }
  
  async fixBug(code: string, bug: string): Promise<string> {
    const response = await aiProvider.callAI(
      `Fix this bug:\n\nCode:\n${code}\n\nBug: ${bug}`,
      {
        systemPrompt: 'You are a code fixing expert.',
        maxTokens: 8192,
        taskType: 'code_generation', // Might prefer GPT-4
        estimatedTokens: 5000,
      }
    );
    
    return response.content;
  }
}
```

---

## 📊 MONITORING DASHBOARD

### Provider Status Display

```typescript
// frontend/src/components/ProviderStatus.tsx

export function ProviderStatus() {
  const [stats, setStats] = useState([]);
  
  useEffect(() => {
    // Poll provider stats every 5 seconds
    const interval = setInterval(async () => {
      const response = await fetch('/api/providers/stats');
      const data = await response.json();
      setStats(data);
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="provider-status">
      <h3>AI Provider Status</h3>
      {stats.map(provider => (
        <div key={provider.id} className="provider-card">
          <div className="header">
            <span className="name">{provider.name}</span>
            <span className={`status ${provider.status}`}>
              {provider.status}
            </span>
          </div>
          
          <div className="usage">
            <progress 
              value={provider.usage.percentage} 
              max={100}
            />
            <span>{provider.usage.percentage}%</span>
          </div>
          
          <div className="details">
            <div>Tokens: {provider.usage.tokens}</div>
            <div>Requests: {provider.usage.requests}</div>
            <div>Today: {provider.usage.tokensToday} tokens</div>
            <div>Cost: {provider.cost.totalSpent}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

## 🎯 TESTING

### Test Scenarios

```typescript
// backend/tests/aiProvider.test.ts

describe('AIProviderRotation', () => {
  test('should rotate between providers', async () => {
    const provider = new AIProviderRotation(testConfig);
    
    const results = [];
    for (let i = 0; i < 10; i++) {
      const response = await provider.callAI('Test prompt');
      results.push(response.provider);
    }
    
    // Should use different providers
    const uniqueProviders = new Set(results);
    expect(uniqueProviders.size).toBeGreaterThan(1);
  });
  
  test('should skip rate-limited providers', async () => {
    // ... test implementation
  });
  
  test('should calculate cost correctly', async () => {
    // ... test implementation
  });
});
```

---

## 🚀 BENEFITS SUMMARY

### Với 10 tài khoản Claude:
- **40k tokens/phút/account** × 10 = **400k tokens/phút**
- **50 requests/phút/account** × 10 = **500 requests/phút**
- **10x throughput** so với 1 account

### Cost optimization:
- Simple tasks → GPT-3.5 ($0.50 vs $3.00 per 1M tokens)
- Tiết kiệm **~80%** cho simple tasks

### Reliability:
- 1 account down → **9 accounts còn lại**
- **99.9% availability** với 10 providers

---

**Version**: 1.0.0  
**Status**: Spec Complete  
**Ready for Implementation**: ✅
