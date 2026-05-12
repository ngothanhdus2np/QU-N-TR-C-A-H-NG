
import { ContentPlanItem, ContentStrategy, ProductLine, BrandProfile, StrategicAdvice } from "../types";

const extractJSONArray = (text: string): ContentPlanItem[] => {
  try {
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start !== -1 && end !== -1) {
      return JSON.parse(text.substring(start, end + 1));
    }
    return JSON.parse(text);
  } catch {
    console.error("Lỗi parse JSON:", text);
    throw new Error("Dữ liệu AI không hợp lệ.");
  }
};

const callBackend = async (route: string, contextData: string): Promise<string> => {
  const response = await fetch(route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contextData }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'AI service error');
  return data.result as string;
};

export const getMonthlyStrategicAdvice = async (
  month: number,
  year: number,
  strategies: ContentStrategy[]
): Promise<StrategicAdvice> => {
  const strategyList = (strategies || []).map(s => `- ${s.name} (ID: ${s.id})`).join('\n');

  const contextData = `Tháng này là tháng ${month}/${year}.

DANH SÁCH TUYẾN BÀI HIỆN CÓ:
${strategyList}

NHIỆM VỤ:
1. Liệt kê các ngày lễ, ngày kỷ niệm hoặc dịp đặc biệt trong tháng ${month}/${year} tại Việt Nam.
2. Đưa ra nhận định thị trường giày dép bình dân trong tháng này (Thời tiết, nhu cầu mua sắm).
3. Đề xuất tỉ lệ (%) phân bổ cho từng Tuyến bài sao cho tổng bằng 100%. Giải thích ngắn gọn tại sao.

Trả về JSON: {"holidays":["tên ngày lễ"],"marketInsight":"nhận định","suggestedDistribution":[{"strategyId":"id","percentage":số}]}`;

  const result = await callBackend('/api/ai/marketing-monthly-advice', contextData);
  return JSON.parse(result) as StrategicAdvice;
};

export const generateContentPlan = async (
  duration: 'week' | 'month' | 'custom',
  startDate: string,
  strategies: ContentStrategy[],
  focusProducts: ProductLine[],
  brandProfile: BrandProfile,
  previousTopics: string[] = [],
  customCount?: number
): Promise<ContentPlanItem[]> => {
  let count = duration === 'week' ? 7 : 30;
  if (duration === 'custom' && customCount !== undefined) {
    count = customCount;
  }

  const startObj = new Date(startDate);
  const currentMonth = startObj.getMonth() + 1;
  const currentYear = startObj.getFullYear();

  const strategyRules = (strategies || []).map(s => `- ${s.name} (${s.percentage}%): ${s.description}`).join('\n');
  const inventoryInfo = (brandProfile?.inventory || []).map(p => `- ${p.name}: ${p.highlights}`).join('\n');
  const selectedFocusProducts = (focusProducts || []).filter(p => p.isSelected !== false);
  const focusInfo = selectedFocusProducts.map(p => `- ${p.name}: Đẩy mạnh cho ${p.target}. Điểm nổi bật: ${p.highlights}`).join('\n');
  const allowedTypes = (strategies || []).map(s => s.name).join(', ');
  const recentTopics = previousTopics.slice(-30);
  const contextPrompt = recentTopics.length > 0
    ? `Các chủ đề đã thực hiện gần đây (không được lặp lại): ${recentTopics.join(", ")}.`
    : "";

  const contextData = `Lập kế hoạch nội dung cho đúng ${count} ngày, bắt đầu từ ngày ${startDate}.

RÀNG BUỘC:
- Chỉ tạo bài trong tháng ${currentMonth}/${currentYear}, không tạo bài thuộc tháng kế tiếp.
- Chỉ tạo đúng ${count} phần tử JSON.
- Type chỉ được dùng các giá trị: ${allowedTypes}

VỀ THƯƠNG HIỆU "GIÀY DÉP PHÚC SANG":
- Câu chuyện & Giá trị: ${brandProfile.story}
- Giọng văn & Phong cách: ${brandProfile.voice}
- Khách hàng trọng tâm: ${brandProfile.targetAudience}
- Lợi thế cạnh tranh: ${brandProfile.competitiveAdvantage}
- SĐT: ${brandProfile.phone || "Liên hệ tại shop"}
- Địa chỉ: ${brandProfile.address || "Tại cửa hàng"}
- Hashtag: ${brandProfile.hashtags || ""}

${contextPrompt}

KHO HÀNG:
${inventoryInfo}

SẢN PHẨM TRỌNG TÂM (ưu tiên lồng ghép):
${focusInfo}

CHIẾN LƯỢC NỘI DUNG:
${strategyRules}

YÊU CẦU:
- Caption tối thiểu 150 chữ, kết thúc bằng Call to Action + thông tin liên hệ + hashtag.
- Headline đa dạng cấu trúc (câu hỏi, chia sẻ, tâm sự, cảnh báo).
- Ngôn ngữ: ${brandProfile.voice}, dùng icon 👟✨ duyên dáng.
- Chỉ dẫn chụp ảnh chi tiết, thực tế.`;

  const result = await callBackend('/api/ai/marketing-content-plan', contextData);
  try {
    return extractJSONArray(result);
  } catch (error) {
    console.error("Failed to parse Claude response:", error);
    throw new Error("Không thể tạo nội dung. Vui lòng thử lại.");
  }
};
