import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

// Test TẦNG HTTP cho createAiRouter (audit 2026-07-21 GĐ4: route AI — cửa DUY NHẤT được
// phép gọi Claude API theo codebase.md — trước đây 0 test). Trọng tâm bảo mật/chi phí:
// (1) mọi route /api/ai đi qua requireAuth, (2) lỗi từ Claude KHÔNG leak chi tiết kỹ
// thuật/API key ra client, (3) validate input trước khi tốn 1 lời gọi Claude.

const callClaudeMock = vi.fn();
vi.mock('../services/agents/claudeClient', () => ({
  callClaude: (...args: unknown[]) => callClaudeMock(...args),
  callClaudeWithFile: (...args: unknown[]) => callClaudeMock(...args),
  callClaudeChat: (...args: unknown[]) => callClaudeMock(...args),
}));

const { createAiRouter } = await import('./ai');

// requireAuth stub: chặn 401 trừ khi có header x-test-auth — khẳng định router.use gắn đúng.
const requireAuthStub: express.RequestHandler = (req, res, next) => {
  if (req.headers['x-test-auth'] === 'yes') return next();
  res.status(401).json({ error: 'Unauthorized' });
};

function startApp(): Promise<{ server: Server; baseUrl: string }> {
  const app = express();
  app.use(express.json());
  app.use(createAiRouter(requireAuthStub));
  return new Promise(resolve => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

const authed = { 'Content-Type': 'application/json', 'x-test-auth': 'yes' };

describe('createAiRouter — auth + không leak lỗi', () => {
  let server: Server;
  let baseUrl: string;
  beforeAll(async () => { ({ server, baseUrl } = await startApp()); });
  afterAll(() => server?.close());

  it('không qua requireAuth → 401 (router.use gắn đúng)', async () => {
    const res = await fetch(`${baseUrl}/api/ai/executive-briefing`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contextData: 'x' }),
    });
    expect(res.status).toBe(401);
    expect(callClaudeMock).not.toHaveBeenCalled();
  });

  it('thiếu contextData → 400, KHÔNG gọi Claude (tiết kiệm chi phí)', async () => {
    callClaudeMock.mockClear();
    const res = await fetch(`${baseUrl}/api/ai/executive-briefing`, {
      method: 'POST', headers: authed, body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    expect(callClaudeMock).not.toHaveBeenCalled();
  });

  it('Claude throw lỗi chứa API key → client CHỈ nhận thông báo chung, KHÔNG leak', async () => {
    callClaudeMock.mockClear();
    // Lỗi giả lập lộ secret — đúng thứ KHÔNG được trả về client
    callClaudeMock.mockRejectedValueOnce(
      new Error('401 Unauthorized: invalid x-api-key sk-ant-api03-SECRETKEY123')
    );
    const res = await fetch(`${baseUrl}/api/ai/executive-briefing`, {
      method: 'POST', headers: authed, body: JSON.stringify({ contextData: 'dữ liệu' }),
    });
    expect(res.status).toBe(500);
    const bodyText = await res.text();
    expect(bodyText).not.toContain('sk-ant');
    expect(bodyText).not.toContain('x-api-key');
    expect(bodyText).not.toContain('SECRETKEY');
    // Chỉ trả thông báo chung
    expect(JSON.parse(bodyText).error).toBe('AI service error');
  });

  it('thành công → trả { result } từ Claude', async () => {
    callClaudeMock.mockClear();
    callClaudeMock.mockResolvedValueOnce('Phân tích tài chính...');
    const res = await fetch(`${baseUrl}/api/ai/executive-briefing`, {
      method: 'POST', headers: authed, body: JSON.stringify({ contextData: 'dữ liệu thật' }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).result).toBe('Phân tích tài chính...');
    expect(callClaudeMock).toHaveBeenCalledTimes(1);
  });
});
