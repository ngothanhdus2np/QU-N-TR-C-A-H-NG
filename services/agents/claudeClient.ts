import Anthropic from '@anthropic-ai/sdk';

// Singleton — tái sử dụng connection, không tạo mới mỗi request
let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY chưa được cấu hình trong .env.local');
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

export interface ClaudeCallParams {
  model?: 'claude-haiku-4-5' | 'claude-sonnet-4-6';
  system: string;
  userMessage: string;
  temperature?: number;
  maxTokens?: number;
}

export async function callClaude(params: ClaudeCallParams): Promise<string> {
  const client = getClient();

  const response = await client.messages.create({
    model: params.model ?? 'claude-haiku-4-5',
    max_tokens: params.maxTokens ?? 2048,
    temperature: params.temperature ?? 0.3,
    system: params.system,
    messages: [{ role: 'user', content: params.userMessage }],
  });

  const u = response.usage as any;
  console.error(`[Claude] in=${u.input_tokens} out=${u.output_tokens}`);

  const content = response.content[0];
  if (content.type !== 'text') throw new Error('Unexpected response type from Claude');
  return content.text;
}

export interface ClaudeChatParams {
  model?: 'claude-haiku-4-5' | 'claude-sonnet-4-6';
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: any }>;
  tools?: any[];
  temperature?: number;
  maxTokens?: number;
}

export async function callClaudeChat(params: ClaudeChatParams): Promise<any[]> {
  const client = getClient();

  // Wrap system in array with cache_control — cached across tool-use loop iterations
  const systemBlock = [{ type: 'text', text: params.system, cache_control: { type: 'ephemeral' } }];

  const createParams: any = {
    model: params.model ?? 'claude-sonnet-4-6',
    max_tokens: params.maxTokens ?? 4096,
    temperature: params.temperature ?? 0.1,
    system: systemBlock,
    messages: params.messages,
  };

  if (params.tools && params.tools.length > 0) {
    // Mark last tool with cache_control so entire tools array is cached
    const tools = params.tools.map((t, i) =>
      i === params.tools!.length - 1 ? { ...t, cache_control: { type: 'ephemeral' } } : t
    );
    createParams.tools = tools;
  }

  const response = await client.messages.create(createParams);

  const u = response.usage as any;
  console.error(`[Claude/chat] in=${u.input_tokens} out=${u.output_tokens} cache_read=${u.cache_read_input_tokens ?? 0} cache_write=${u.cache_creation_input_tokens ?? 0}`);

  return response.content as any[];
}

export interface ClaudeFileCallParams {
  model?: 'claude-haiku-4-5' | 'claude-sonnet-4-6';
  system: string;
  textPrompt: string;
  file: { base64: string; mimeType: string };
  maxTokens?: number;
}

export async function callClaudeWithFile(params: ClaudeFileCallParams): Promise<string> {
  const client = getClient();
  const { base64, mimeType } = params.file;

  const isImage = mimeType.startsWith('image/');
  const isPDF = mimeType === 'application/pdf';

  if (!isImage && !isPDF) {
    throw new Error(`Định dạng không hỗ trợ: ${mimeType}. Chỉ hỗ trợ PDF và ảnh (JPG, PNG).`);
  }

  const baseParams = {
    model: (params.model ?? 'claude-haiku-4-5') as string,
    max_tokens: params.maxTokens ?? 2048,
    system: params.system,
  };

  if (isImage) {
    const response = await client.messages.create({
      ...baseParams,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mimeType as any, data: base64 } },
          { type: 'text', text: params.textPrompt },
        ],
      }],
    });
    const u = response.usage as any;
    console.error(`[Claude/file] in=${u.input_tokens} out=${u.output_tokens}`);
    const block = response.content[0];
    if (block.type !== 'text') throw new Error('Unexpected response type from Claude');
    return block.text;
  } else {
    // PDF requires beta
    const response = await client.beta.messages.create({
      ...baseParams,
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } } as any,
          { type: 'text', text: params.textPrompt },
        ] as any,
      }],
      betas: ['pdfs-2024-09-25'],
    });
    const u = response.usage as any;
    console.error(`[Claude/file] in=${u.input_tokens} out=${u.output_tokens}`);
    const block = response.content[0];
    if (block.type !== 'text') throw new Error('Unexpected response type from Claude');
    return block.text;
  }
}
