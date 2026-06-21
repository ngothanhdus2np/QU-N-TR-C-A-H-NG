export interface ProductContentInput {
  name: string;
  sku: string;
  category: string;
  price: number;
  brandName?: string;
  material?: string;
  colors?: string[];
  sizeRange?: string;
  origin?: string;
  warrantyPolicy?: string;
  description?: string;
  sellingPoints?: string[];
}

export interface ContentWarning {
  type: 'forbidden_claim' | 'missing_data' | 'format_violation';
  phrase?: string;
  message: string;
}

export interface ContentGenerationResult {
  result: string;
  platform: string;
  task: string;
  model: string;
  warnings: ContentWarning[];
  parseError?: boolean;
}

export async function generateProductContent(
  productInput: ProductContentInput,
  platformId: string,
  objective?: string,
  extraInstruction?: string
): Promise<ContentGenerationResult> {
  const response = await fetch('/api/ai/content/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productInput, platformId, objective, extraInstruction }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Lỗi sinh nội dung');
  return data as ContentGenerationResult;
}
