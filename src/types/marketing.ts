/**
 * Marketing & Promotion Types
 * Types related to marketing, promotions, and content planning
 */

export interface GiftTier {
  id: string;
  minInvoiceValue: number;
  giftValue: number;
  giftName: string;
}

export interface PromotionPlan {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  type: 'Discount' | 'Buy1Get1' | 'Voucher' | 'Gift' | 'Other';
  budget: number;
  targetRevenue: number;
  description: string;
  status: 'Planned' | 'Active' | 'Completed' | 'Cancelled';
  giftTiers?: GiftTier[];
  // Actual performance metrics
  actualRevenue?: number;
  actualCost?: number;
  incrementalRevenue?: number;
  actualRoi?: number;
}

export interface ContentStrategy {
  id: string;
  name: string;
  percentage: number;
  description: string;
  color: string;
}

export interface ProductLine {
  id: string;
  name: string;
  target: string;
  highlights: string;
  isSelected?: boolean;
}

export interface BrandProfile {
  name?: string;
  story: string;
  voice: string;
  targetAudience: string;
  competitiveAdvantage: string;
  logo?: string;
  inventory: ProductLine[];
  phone?: string;
  address?: string;
  hashtags?: string;
}

export interface ContentPlanItem {
  date: string;
  topic: string;
  type: string;
  imageInstruction: string;
  caption: string;
  image?: string;
  isPosted?: boolean;
  scheduledTime?: string;
  status?: 'draft' | 'scheduled' | 'posted' | 'error';
  fbPostId?: string;
  errorLog?: string;
  isDraft?: boolean;
}

export interface StrategicAdvice {
  holidays: string[];
  marketInsight: string;
  suggestedDistribution: { strategyId: string; percentage: number }[];
}

export interface GenerationRequest {
  duration: 'week' | 'month';
  startDate: string;
}
