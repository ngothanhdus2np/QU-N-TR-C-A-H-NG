// PUBLIC config — an toàn để import từ frontend
// KHÔNG chứa system prompt, rules chi tiết, hay forbidden claims
// Các thông tin nhạy cảm đó nằm trong services/agents/contentPrompts.ts (backend only)

export type ContentPlatform = 'shopee' | 'facebook' | 'website' | 'blog';
export type ContentTask = 'product_description' | 'product_caption' | 'seo_article' | 'web_product';
export type ContentObjective = 'sell_fast' | 'clearance' | 'new_arrival' | 'seo';

export interface PlatformPublicConfig {
  id: string;
  platform: ContentPlatform;
  task: ContentTask;
  name: string;
  icon: string;
  supportedObjectives: ContentObjective[];
  output: {
    format: 'text' | 'markdown' | 'json';
    maxLength?: number;
    sections: string[];
  };
}

export const CONTENT_PLATFORMS: PlatformPublicConfig[] = [
  {
    id: 'shopee_product_description',
    platform: 'shopee',
    task: 'product_description',
    name: 'Mô tả Shopee',
    icon: '🛒',
    supportedObjectives: ['sell_fast', 'clearance', 'new_arrival'],
    output: {
      format: 'text',
      maxLength: 500,
      sections: ['tiêu đề', 'điểm nổi bật', 'chất liệu/đế', 'hướng dẫn chọn size', 'cta'],
    },
  },
  {
    id: 'blog_seo_article',
    platform: 'blog',
    task: 'seo_article',
    name: 'Bài blog SEO',
    icon: '📝',
    supportedObjectives: ['seo'],
    output: {
      format: 'markdown',
      maxLength: 1200,
      sections: ['tiêu đề SEO', 'meta description', 'intro', 'nội dung chính', 'kết luận'],
    },
  },
  {
    id: 'website_product_description',
    platform: 'website',
    task: 'web_product',
    name: 'Trang sản phẩm web',
    icon: '🌐',
    supportedObjectives: ['sell_fast', 'seo', 'new_arrival'],
    output: {
      format: 'json',
      sections: ['shortDescription', 'longDescription', 'specs', 'seoTitle'],
    },
  },
  {
    id: 'facebook_product_caption',
    platform: 'facebook',
    task: 'product_caption',
    name: 'Caption Facebook',
    icon: '📘',
    supportedObjectives: ['sell_fast', 'clearance', 'new_arrival'],
    output: {
      format: 'text',
      maxLength: 600,
      sections: ['hook', 'nội dung chính', 'cta', 'contact', 'hashtag'],
    },
  },
];

export const OBJECTIVE_LABELS: Record<ContentObjective, string> = {
  sell_fast: 'Bán nhanh',
  clearance: 'Xả hàng',
  new_arrival: 'Ra mắt mẫu mới',
  seo: 'SEO / Blog',
};
