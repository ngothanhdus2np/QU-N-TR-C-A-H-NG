
import { GoogleGenAI, Type } from "@google/genai";
import { ContentPlanItem, ContentStrategy, ProductLine, BrandProfile, StrategicAdvice } from "../types";

const getAIInstance = () => {
  const userKey = localStorage.getItem('GEMINI_USER_API_KEY');
  const apiKey = userKey || process.env.GEMINI_API_KEY || '';
  return new GoogleGenAI({ apiKey });
};

/**
 * Hàm hỗ trợ trích xuất JSON an toàn khỏi phản hồi của AI
 */
const extractJSONArray = (text: string): any[] => {
  try {
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start !== -1 && end !== -1) {
      const jsonStr = text.substring(start, end + 1);
      return JSON.parse(jsonStr);
    }
    return JSON.parse(text);
  } catch (e) {
    console.error("Lỗi parse JSON:", text);
    throw new Error("Dữ liệu AI không hợp lệ.");
  }
};

export const getMonthlyStrategicAdvice = async (
  month: number,
  year: number,
  strategies: ContentStrategy[]
): Promise<StrategicAdvice> => {
  const ai = getAIInstance();
  const strategyList = (strategies || []).map(s => `- ${s.name} (ID: ${s.id})`).join('\n');
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Bạn là chuyên gia Marketing tư vấn cho shop "Giày Dép Phúc Sang".
    Tháng này là tháng ${month}/${year}.
    
    DANH SÁCH TUYẾN BÀI HIỆN CÓ:
    ${strategyList}
    
    NHIỆM VỤ:
    1. Liệt kê các ngày lễ, ngày kỷ niệm hoặc dịp đặc biệt trong tháng này tại Việt Nam.
    2. Đưa ra nhận định thị trường giày dép bình dân trong tháng này (Thời tiết, nhu cầu mua sắm).
    3. Đề xuất tỉ lệ (%) phân bổ cho từng Tuyến bài trên sao cho tổng bằng 100%. Giải thích ngắn gọn tại sao.
    
    Yêu cầu trả về định dạng JSON nghiêm ngặt.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          holidays: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          marketInsight: { type: Type.STRING },
          suggestedDistribution: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                strategyId: { type: Type.STRING },
                percentage: { type: Type.NUMBER }
              },
              required: ['strategyId', 'percentage']
            }
          }
        },
        required: ['holidays', 'marketInsight', 'suggestedDistribution']
      }
    }
  });

  return JSON.parse(response.text) as StrategicAdvice;
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
  const ai = getAIInstance();
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
  const allowedTypes = (strategies || []).map(s => s.name);

  const recentTopics = previousTopics.slice(-30);

  const contextPrompt = recentTopics.length > 0 
    ? `Dưới đây là danh sách các chủ đề đã thực hiện gần đây (không được lặp lại): ${recentTopics.join(", ")}.`
    : "";

  const brandingAutomation = `
    THÔNG TIN LIÊN HỆ BẮT DUỘC Ở CUỐI MỖI BÀI:
    - SĐT: ${brandProfile.phone || "Liên hệ tại shop"}
    - Địa chỉ: ${brandProfile.address || "Tại cửa hàng"}
    - Hashtag: ${brandProfile.hashtags || ""}
    
    YÊU CẦU: Hãy tự động thêm một đoạn "Call to Action" (Lời kêu gọi mua hàng) kèm thông tin liên hệ và hashtag trên vào cuối mỗi phần "caption".
  `;

  const brandContext = `
    VỀ THƯƠNG HIỆU "GIÀY DÉP PHÚC SANG":
    - Câu chuyện & Giá trị: ${brandProfile.story}
    - Giọng văn & Phong cách: ${brandProfile.voice}
    - Khách hàng trọng tâm: ${brandProfile.targetAudience}
    - Lợi thế cạnh tranh: ${brandProfile.competitiveAdvantage}
    ${brandingAutomation}
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: `Bạn là Quản lý Nội dung chuyên nghiệp cho thương hiệu "Giày Dép Phúc Sang". Hãy lập kế hoạch cho đúng ${count} ngày, bắt đầu từ ngày ${startDate}.
 
    RÀNG BUỘC QUAN TRỌNG:
    - Tuyệt đối không tạo bài viết cho các ngày thuộc tháng kế tiếp. Mọi bài viết phải nằm trong tháng ${currentMonth}/${currentYear}.
    - Chỉ tạo đúng ${count} bài JSON.

    ${brandContext}
    ${contextPrompt}

    KHO HÀNG TỔNG CỦA THƯƠNG HIỆU:
    ${inventoryInfo}

    MỤC TIÊU TRỌNG TÂM (SẢN PHẨM MÙA VỤ) - HÃY ƯU TIÊN CÁC SẢN PHẨM NÀY:
    ${focusInfo}

    CHIẾN LƯỢC NỘI DUNG TÙY CHỈNH:
    ${strategyRules}

    MỤC TIÊU THÁNG ${currentMonth}:
    - Lồng ghép SẢN PHẨM TRỌNG TÂM vào các bài viết một cách tự nhiên và thu hút nhất.
    - Điều chỉnh thông điệp phù hợp với thời tiết và tâm lý khách hàng tháng này tại Việt Nam.
    - Headline: Đa dạng cấu trúc (Câu hỏi, chia sẻ, tâm sự, cảnh báo).
    - Ngôn ngữ: ${brandProfile.voice}, sử dụng icon 👟✨ một cách duyên dáng.

    Yêu cầu: Trả về JSON, caption đầy đủ (ít nhất 150 chữ), chỉ dẫn chụp ảnh chi tiết. Đảm bảo đúng số lượng bài là ${count} bài.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            date: { type: Type.STRING },
            topic: { type: Type.STRING },
            type: { type: Type.STRING, enum: allowedTypes },
            imageInstruction: { type: Type.STRING },
            caption: { type: Type.STRING }
          },
          required: ['date', 'topic', 'type', 'imageInstruction', 'caption']
        }
      }
    }
  });

  try {
    return extractJSONArray(response.text);
  } catch (error) {
    console.error("Failed to parse Gemini response:", error);
    throw new Error("Không thể tạo nội dung. Vui lòng thử lại.");
  }
};
