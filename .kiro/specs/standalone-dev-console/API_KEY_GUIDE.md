# 🔑 Hướng dẫn Lấy và Kết nối API Keys

## 📋 TỔNG QUAN

Tài liệu này hướng dẫn chi tiết cách:
1. Tạo tài khoản AI providers
2. Lấy API keys
3. Kết nối vào app
4. Test keys
5. Monitor usage

---

## 1️⃣ ANTHROPIC CLAUDE

### Bước 1: Tạo Tài khoản

1. Truy cập: https://console.anthropic.com
2. Click **"Sign Up"**
3. Đăng ký với email (có thể dùng nhiều email khác nhau cho nhiều accounts)
4. Verify email
5. Đăng nhập

### Bước 2: Lấy API Key

1. Sau khi đăng nhập, vào: https://console.anthropic.com/settings/keys
2. Click **"Create Key"**
3. Đặt tên cho key (ví dụ: "Dev Console Key 1")
4. Copy key (format: `sk-ant-api03-xxxxxxxxxxxxx`)
5. ⚠️ **LƯU Ý**: Key chỉ hiển thị 1 lần, lưu ngay!

### Bước 3: Kiểm tra Quota

1. Vào https://console.anthropic.com/settings/limits
2. Xem rate limits:
   - **Tokens per minute (TPM)**: Thường là 40,000
   - **Requests per minute (RPM)**: Thường là 50
   - **Tokens per day**: Tùy plan (Free/Pro/Scale)

### Bước 4: Test Key

```bash
# Test trực tiếp bằng curl
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: sk-ant-api03-xxxxxxxxxxxxx" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 100,
    "messages": [
      {"role": "user", "content": "Say hello"}
    ]
  }'

# Nếu thành công, sẽ trả về response với "content"
# Nếu thất bại, sẽ có error message
```

### Pricing Claude:
- **Claude Sonnet 4**: $3/1M input tokens, $15/1M output tokens
- **Claude Opus**: $15/1M input, $75/1M output
- **Claude Haiku**: $0.25/1M input, $1.25/1M output

---

## 2️⃣ OPENAI (GPT-4, GPT-3.5)

### Bước 1: Tạo Tài khoản

1. Truy cập: https://platform.openai.com
2. Click **"Sign up"**
3. Đăng ký (có thể dùng nhiều email/phone numbers)
4. Verify email và phone
5. Add payment method (Credit card)

### Bước 2: Lấy API Key

1. Đăng nhập vào https://platform.openai.com/api-keys
2. Click **"Create new secret key"**
3. Đặt tên (ví dụ: "Dev Console Key 1")
4. Copy key (format: `sk-xxxxxxxxxxxxx`)
5. ⚠️ **LƯU Ý**: Key chỉ hiển thị 1 lần!

### Bước 3: Kiểm tra Quota

1. Vào https://platform.openai.com/account/limits
2. Xem rate limits (tùy tier):
   - **Tier 1** (Free): 3 RPM, 40k TPM
   - **Tier 2** ($50+ spent): 3,500 RPM, 90k TPM
   - **Tier 3** ($100+ spent): Higher limits

### Bước 4: Test Key

```bash
# Test GPT-4
curl https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer sk-xxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4-turbo",
    "messages": [
      {"role": "user", "content": "Say hello"}
    ],
    "max_tokens": 50
  }'

# Test GPT-3.5 (rẻ hơn)
curl https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer sk-xxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [
      {"role": "user", "content": "Say hello"}
    ],
    "max_tokens": 50
  }'
```

### Pricing OpenAI:
- **GPT-4 Turbo**: $10/1M input, $30/1M output
- **GPT-4**: $30/1M input, $60/1M output
- **GPT-3.5 Turbo**: $0.50/1M input, $1.50/1M output

---

## 3️⃣ GOOGLE GEMINI (Optional)

### Bước 1: Tạo Tài khoản

1. Truy cập: https://makersuite.google.com/app/apikey
2. Đăng nhập với Google account
3. Accept terms

### Bước 2: Lấy API Key

1. Click **"Create API Key"**
2. Chọn Google Cloud project (hoặc tạo mới)
3. Copy key
4. Lưu key

### Bước 3: Test Key

```bash
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=YOUR_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "contents": [{
      "parts":[{"text": "Say hello"}]
    }]
  }'
```

### Pricing Gemini:
- **Gemini Pro**: $0.50/1M tokens (input & output)
- **Gemini Pro Vision**: $1.50/1M tokens

---

## 4️⃣ KẾT NỐI VÀO APP

### Phương pháp 1: Environment Variables (.env.local)

**Bước 1**: Tạo file `.env.local` ở root của project:

```bash
cd standalone-dev-console
touch .env.local
```

**Bước 2**: Mở file và thêm keys:

```bash
# .env.local

# ========================================
# ANTHROPIC CLAUDE KEYS
# ========================================
# Account 1: your-email-1@gmail.com
CLAUDE_KEY_1=sk-ant-api03-xxxxxxxxxxxxx

# Account 2: your-email-2@gmail.com
CLAUDE_KEY_2=sk-ant-api03-yyyyyyyyyyyyy

# Account 3: your-email-3@gmail.com (if you have)
CLAUDE_KEY_3=sk-ant-api03-zzzzzzzzzzzzz

# ========================================
# OPENAI KEYS
# ========================================
# Account 1: your-openai-1@gmail.com
OPENAI_KEY_1=sk-xxxxxxxxxxxxx

# Account 2: your-openai-2@gmail.com
OPENAI_KEY_2=sk-yyyyyyyyyyyyy

# ========================================
# GOOGLE GEMINI KEYS (Optional)
# ========================================
GOOGLE_KEY_1=AIzaSyXXXXXXXXXXXXXX

# ========================================
# SERVER CONFIG
# ========================================
PORT=3000
NODE_ENV=development

# ========================================
# SECURITY
# ========================================
# Generate này: openssl rand -hex 32
JWT_SECRET=your-secret-key-here
```

**Bước 3**: Load env variables trong backend:

```typescript
// backend/src/config/index.ts

import dotenv from 'dotenv';

// Load .env.local
dotenv.config({ path: '../.env.local' });

// Verify keys exist
const requiredKeys = [
  'CLAUDE_KEY_1',
  'OPENAI_KEY_1',
];

for (const key of requiredKeys) {
  if (!process.env[key]) {
    throw new Error(`❌ Missing required environment variable: ${key}`);
  }
}

console.log('✅ All required API keys loaded');
```

---

### Phương pháp 2: Config File (.kiro-config.json)

**Bước 1**: Tạo/edit file `.kiro-config.json`:

```json
{
  "aiProviders": {
    "rotationEnabled": true,
    "strategy": "smart",
    "providers": [
      {
        "id": "claude-1",
        "name": "Claude Account 1 (Main)",
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
          "inputTokenCost": 3.0,
          "outputTokenCost": 15.0
        },
        "features": ["analysis", "code_review", "bug_detection"],
        "enabled": true
      },
      {
        "id": "claude-2",
        "name": "Claude Account 2 (Backup)",
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
        "name": "GPT-3.5 (Cheap tasks)",
        "type": "openai",
        "model": "gpt-3.5-turbo",
        "apiKey": "${OPENAI_KEY_2}",
        "priority": 10,
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

**Giải thích config**:

- **`${CLAUDE_KEY_1}`**: Placeholder sẽ được replace bằng value từ `.env.local`
- **`priority`**: Số càng nhỏ = ưu tiên càng cao
- **`rateLimit`**: Limits của provider (check từ console)
- **`cost`**: Cost per 1M tokens (để optimize)
- **`features`**: Tasks mà provider này giỏi
- **`enabled`**: `true` để sử dụng, `false` để tắt

**Bước 2**: Code để load config:

```typescript
// backend/src/config/index.ts

import fs from 'fs';
import path from 'path';

// Load config file
const configPath = path.join(process.cwd(), '../.kiro-config.json');
const configFile = fs.readFileSync(configPath, 'utf-8');
let config = JSON.parse(configFile);

// Replace ${ENV_VAR} with actual values from process.env
function replaceEnvVars(obj: any): any {
  if (typeof obj === 'string') {
    // Replace ${VAR_NAME} with process.env.VAR_NAME
    return obj.replace(/\$\{(\w+)\}/g, (_, key) => {
      const value = process.env[key];
      if (!value) {
        console.warn(`⚠️  Environment variable ${key} not found`);
        return '';
      }
      return value;
    });
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
}

config = replaceEnvVars(config);

export default config;
```

---

## 5️⃣ SỬ DỤNG TRONG CODE

### Cách 1: Direct Usage

```typescript
// backend/src/agents/Kiro.ts

import Anthropic from '@anthropic-ai/sdk';

// Trực tiếp sử dụng key
const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_KEY_1,
});

const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  messages: [
    { role: 'user', content: 'Hello' }
  ],
});

console.log(response.content[0].text);
```

### Cách 2: Sử dụng AI Provider Rotation (RECOMMENDED)

```typescript
// backend/src/services/AIProvider.ts đã implement rotation

// Usage trong agent:
import { aiProvider } from '../services/AIProvider';

export class Kiro {
  async chat(message: string): Promise<string> {
    // Tự động xoay tua, không cần biết dùng key nào
    const response = await aiProvider.callAI(message, {
      systemPrompt: 'You are Kiro, a helpful AI assistant.',
      maxTokens: 4096,
      taskType: 'chat',
    });
    
    console.log(`✅ Response from ${response.provider}`);
    console.log(`💰 Cost: $${response.cost.toFixed(4)}`);
    
    return response.content;
  }
}
```

---

## 6️⃣ TEST TOÀN BỘ HỆ THỐNG

### Test 1: Verify Keys Loaded

```typescript
// backend/src/scripts/testKeys.ts

import config from './config';

console.log('🔍 Testing AI Provider Keys...\n');

for (const provider of config.aiProviders.providers) {
  console.log(`Provider: ${provider.name}`);
  console.log(`  Type: ${provider.type}`);
  console.log(`  Key: ${provider.apiKey.substring(0, 15)}...`);
  console.log(`  Enabled: ${provider.enabled}`);
  console.log('');
}
```

Run:
```bash
cd backend
npx tsx src/scripts/testKeys.ts
```

### Test 2: Test Each Provider

```typescript
// backend/src/scripts/testProviders.ts

import { aiProvider } from './services/AIProvider';

async function testAllProviders() {
  console.log('🧪 Testing all AI providers...\n');
  
  try {
    // Test simple request
    const response = await aiProvider.callAI('Say hello in one word', {
      maxTokens: 10,
    });
    
    console.log(`✅ Success!`);
    console.log(`Provider: ${response.provider}`);
    console.log(`Response: ${response.content}`);
    console.log(`Cost: $${response.cost.toFixed(4)}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  // Test rotation
  console.log('\n🔄 Testing rotation...\n');
  
  for (let i = 0; i < 5; i++) {
    const response = await aiProvider.callAI('Test ' + i, {
      maxTokens: 5,
    });
    console.log(`Request ${i + 1}: ${response.provider}`);
  }
  
  // Show stats
  console.log('\n📊 Provider Stats:\n');
  const stats = aiProvider.getProviderStats();
  console.table(stats);
}

testAllProviders();
```

Run:
```bash
cd backend
npx tsx src/scripts/testProviders.ts
```

---

## 7️⃣ MONITOR USAGE

### Dashboard API Endpoint

```typescript
// backend/src/routes/providers.ts

import { Router } from 'express';
import { aiProvider } from '../services/AIProvider';

const router = Router();

// Get provider stats
router.get('/stats', (req, res) => {
  const stats = aiProvider.getProviderStats();
  res.json(stats);
});

// Enable/disable provider
router.post('/toggle/:id', (req, res) => {
  const { id } = req.params;
  const { enabled } = req.body;
  
  aiProvider.setProviderStatus(
    id, 
    enabled ? 'active' : 'disabled'
  );
  
  res.json({ success: true });
});

export default router;
```

### Frontend Component

```tsx
// frontend/src/components/ProviderDashboard.tsx

import { useEffect, useState } from 'react';

export function ProviderDashboard() {
  const [stats, setStats] = useState([]);
  
  useEffect(() => {
    const fetchStats = async () => {
      const response = await fetch('/api/providers/stats');
      const data = await response.json();
      setStats(data);
    };
    
    fetchStats();
    const interval = setInterval(fetchStats, 5000); // Update every 5s
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="provider-dashboard">
      <h2>AI Provider Status</h2>
      
      {stats.map((provider: any) => (
        <div key={provider.id} className="provider-card">
          <div className="header">
            <h3>{provider.name}</h3>
            <span className={`status ${provider.status}`}>
              {provider.status}
            </span>
          </div>
          
          <div className="usage">
            <label>Token Usage</label>
            <progress 
              value={provider.usage.percentage} 
              max={100}
            />
            <span>{provider.usage.tokens}</span>
          </div>
          
          <div className="stats">
            <div>Requests: {provider.usage.requests}</div>
            <div>Today: {provider.usage.tokensToday}</div>
            <div>Cost: {provider.cost.totalSpent}</div>
          </div>
        </div>
      ))}
      
      <div className="total-cost">
        Total Spent Today: $
        {stats.reduce((sum, p) => sum + parseFloat(p.cost.totalSpent.slice(1)), 0).toFixed(2)}
      </div>
    </div>
  );
}
```

---

## 8️⃣ BEST PRACTICES

### 1. Security

✅ **DO**:
- Lưu keys trong `.env.local` (không commit)
- Add `.env.local` vào `.gitignore`
- Rotate keys định kỳ (3-6 tháng)
- Use different keys cho dev/prod

❌ **DON'T**:
- Hardcode keys trong code
- Commit keys lên Git
- Share keys publicly
- Log keys ra console

### 2. Cost Management

✅ **Setup budget alerts**:
- Anthropic: https://console.anthropic.com/settings/billing
- OpenAI: https://platform.openai.com/account/billing/limits

✅ **Monitor daily**:
- Check provider dashboard
- Set max tokens per request
- Use cheap models cho simple tasks

### 3. Rate Limit Management

✅ **Tips**:
- Leave 10% buffer (don't use full quota)
- Implement exponential backoff
- Auto-rotate trước khi hit limit
- Monitor usage real-time

---

## 9️⃣ TROUBLESHOOTING

### Lỗi: "Invalid API key"

**Nguyên nhân**:
- Key sai
- Key đã expired
- Key chưa được activate

**Giải pháp**:
```bash
# Test key trực tiếp
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: YOUR_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-sonnet-4-20250514","max_tokens":10,"messages":[{"role":"user","content":"hi"}]}'
```

### Lỗi: "Rate limit exceeded"

**Nguyên nhân**:
- Đã dùng hết quota

**Giải pháp**:
- Đợi 60 giây (rate limit reset)
- Sử dụng key khác
- Upgrade plan

### Lỗi: "Environment variable not found"

**Nguyên nhân**:
- Chưa tạo `.env.local`
- Tên variable sai

**Giải pháp**:
```bash
# Check env variables
cat .env.local | grep KEY

# Load lại env
source .env.local
```

---

## 🎯 CHECKLIST: ĐÃ SETUP ĐÚNG CHƯA?

```
Accounts:
✅ Đã tạo 2-3 tài khoản Claude
✅ Đã tạo 2-3 tài khoản OpenAI
✅ Đã verify email/phone

API Keys:
✅ Đã lấy được keys từ consoles
✅ Đã lưu keys vào .env.local
✅ Đã test keys bằng curl

Configuration:
✅ .env.local đã tạo
✅ .kiro-config.json đã config
✅ .env.local trong .gitignore

Testing:
✅ Backend start được
✅ Keys load được (test script)
✅ Rotation working (test script)
✅ Dashboard hiển thị stats

Ready to use! 🚀
```

---

**Ước tính thời gian**: 30-45 phút để setup tất cả keys  
**Cost**: $0 to start (free tiers available)  
**Maintenance**: 10 phút/tuần để monitor
