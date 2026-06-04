/**
 * Common Types
 * Shared types used across multiple domains
 */

export type DiagnosisRange =
  | 'today'
  | 'yesterday'
  | 'last7'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisYear'
  | 'custom'
  | 'all';

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  isTable?: boolean;
}

export interface AppAlert {
  id: string;
  type: 'low_stock' | 'overdue_debt' | 'revenue_drop';
  severity: 'warning' | 'critical';
  title: string;
  message: string;
  createdAt: string;
}

export interface AlertConfig {
  defaultMinStock: number; // Ngưỡng tồn kho tối thiểu mặc định (khi SP không set minStock)
  debtOverdueDays: number; // Số ngày nợ NCC chưa thanh toán bị cảnh báo
  revenueDropPct: number; // % doanh thu giảm so với trung bình 6 ngày (0-100)
}

export interface KnowledgeBaseArticle {
  id: string;
  category: 'Nhân sự' | 'Vận hành' | 'Bán hàng' | 'Tài chính' | 'Biểu mẫu' | 'Khác';
  title: string;
  content: string; // Hỗ trợ Markdown
  summary?: string;
  updatedAt: string;
  sourceFileName?: string;
  sourceFileData?: string; // Legacy base64 data of original file
  sourceFilePath?: string;
  sourceFileUrl?: string;
  sourcePreviewUrl?: string;
  sourcePageImages?: string[];
  sourceFileType?: string;
  sourceFileSize?: number;
}
