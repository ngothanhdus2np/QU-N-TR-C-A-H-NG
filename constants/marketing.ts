
import { ContentStrategy, ProductLine, BrandProfile } from '../types';

export const STRATEGY_COLORS: Record<string, { bg: string, text: string, border: string, dot: string, fill: string, hex: string }> = {
  blue:   { bg: 'bg-blue-50',   text: 'text-blue-600',   border: 'border-blue-100',   dot: 'bg-blue-400',   fill: 'fill-blue-600',   hex: '#2563eb' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-100', dot: 'bg-purple-400', fill: 'fill-purple-600', hex: '#9333ea' },
  green:  { bg: 'bg-green-50',  text: 'text-green-600',  border: 'border-green-100',  dot: 'bg-green-400',  fill: 'fill-green-600',  hex: '#16a34a' },
  red:    { bg: 'bg-red-50',    text: 'text-red-600',    border: 'border-red-100',    dot: 'bg-red-400',    fill: 'fill-red-600',    hex: '#dc2626' },
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-100', dot: 'bg-indigo-400', fill: 'fill-indigo-600', hex: '#4f46e5' },
  slate:  { bg: 'bg-slate-50',  text: 'text-slate-600',  border: 'border-slate-100',  dot: 'bg-slate-400',  fill: 'fill-slate-600',  hex: '#475569' },
};

export const DEFAULT_STRATEGIES: ContentStrategy[] = [
  { id: '1', name: 'Góc Kiến Thức', percentage: 20, description: 'Chia sẻ mẹo chọn giày, vệ sinh giày, phối đồ hữu ích.', color: 'blue' },
  { id: '2', name: 'Gia Đình & Cảm Xúc', percentage: 30, description: 'Kể chuyện về tình cảm gia đình, sự gắn kết thông qua đôi giày.', color: 'purple' },
  { id: '3', name: 'Phản Hồi Khách Hàng', percentage: 10, description: 'Đăng ảnh khách mua hàng, feedback thực tế để tạo tin cậy.', color: 'green' },
  { id: '4', name: 'Bán Hàng & Khuyến Mãi', percentage: 40, description: 'Giới thiệu mẫu mới, báo giá, thúc đẩy mua hàng trực tiếp.', color: 'red' }
];

export const DEFAULT_INVENTORY: ProductLine[] = [
  { id: 'i1', name: 'Sandal quai ngang', target: 'Mọi lứa tuổi', highlights: 'Bền, chống trơn trượt', isSelected: true },
  { id: 'i2', name: 'Giày cao gót 5cm', target: 'Văn phòng', highlights: 'Êm chân, thanh lịch', isSelected: true },
  { id: 'i3', name: 'Dép tổ ong', target: 'Gia đình', highlights: 'Huyền thoại, siêu bền', isSelected: true }
];

export const DEFAULT_FOCUS_PRODUCTS: ProductLine[] = [
  { id: 'f1', name: 'Sandal học sinh (Mùa tựu trường)', target: 'Học sinh cấp 1, 2', highlights: 'Giá cực rẻ, siêu bền cho trẻ hiếu động', isSelected: true }
];

export const DEFAULT_BRAND: BrandProfile = {
  name: "Giày Dép Phúc Sang",
  story: "Giày Dép Phúc Sang ra đời với mong muốn mang lại những đôi giày bền bỉ, giá cả bình dân cho mọi gia đình Việt.",
  voice: "Thân thiện, chân thành, bình dân, sử dụng ngôn ngữ đời thường gần gũi.",
  targetAudience: "Các bà nội trợ, người lao động, học sinh sinh viên.",
  competitiveAdvantage: "Sản phẩm siêu bền, giá thành rẻ nhất khu vực.",
  inventory: DEFAULT_INVENTORY,
  phone: "090xxxxxxx",
  address: "Địa chỉ cửa hàng của bạn",
  hashtags: "#GiayDepPhucSang #GiayDepGiaRe #BenDep"
};
