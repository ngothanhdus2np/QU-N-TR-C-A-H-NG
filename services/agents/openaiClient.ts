// Phase 1: stub — interface được thiết kế sẵn nhưng chưa kích hoạt
// Phase 1.5: thêm OPENAI_API_KEY vào .env.local + npm install openai + implement hàm này

export interface OpenAICallParams {
  model: string;
  system: string;
  userMessage: string;
  temperature: number;
  maxTokens: number;
}

export async function callOpenAI(_params: OpenAICallParams): Promise<string> {
  throw new Error(
    'OpenAI provider chưa được kích hoạt (Phase 1.5). ' +
    'Để bật: thêm OPENAI_API_KEY vào .env.local và npm install openai.'
  );
}
