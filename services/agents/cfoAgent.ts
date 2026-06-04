// Tool schemas và system prompts cho CFO Agent Layer
// Server.ts import từ đây — không định nghĩa inline trong route handlers

export const CFO_TOOLS = [
  {
    name: 'get_metadata',
    description: 'Lấy thông tin cấu hình hệ thống bao gồm: Danh sách nhân sự, Chính sách lương (Ma trận nhảy bậc), Danh mục chi phí, và các Quy trình vận hành (SOP).',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'query_ledgers',
    description: 'Truy vấn dữ liệu chi tiết từ các sổ cái trong một khoảng thời gian cụ thể.',
    input_schema: {
      type: 'object',
      properties: {
        ledgerType: {
          type: 'string',
          description: 'Loại sổ cái cần truy vấn.',
          enum: ['revenue', 'shopee_revenue', 'expenses', 'payroll'],
        },
        startDate: { type: 'string', description: 'Ngày bắt đầu (YYYY-MM-DD).' },
        endDate: { type: 'string', description: 'Ngày kết thúc (YYYY-MM-DD).' },
      },
      required: ['ledgerType', 'startDate', 'endDate'],
    },
  },
  {
    name: 'get_financial_analysis',
    description: 'Lấy các chỉ số phân tích tài chính chuyên sâu, điểm sức khỏe, rò rỉ dòng tiền và phân tích điểm hòa vốn.',
    input_schema: {
      type: 'object',
      properties: {
        month: { type: 'string', description: 'Tháng cần phân tích (YYYY-MM). Nếu không có, hệ thống sẽ lấy tháng gần nhất.' },
      },
    },
  },
  {
    name: 'get_payroll_preview',
    description: 'Dự toán quỹ lương tháng: danh sách nhân viên đang làm việc, thâm niên, bậc lương hiện tại và ước tính lương cơ bản + phụ cấp. Dùng khi hỏi về nhân sự, lương, quỹ lương.',
    input_schema: {
      type: 'object',
      properties: {
        month: { type: 'string', description: 'Tháng cần xem (YYYY-MM). Mặc định tháng hiện tại.' },
      },
    },
  },
  {
    name: 'get_inventory_alerts',
    description: 'Danh sách sản phẩm cần nhập hàng: hết hàng (stock=0) và sắp hết (stock <= minStock). Dùng khi hỏi về tồn kho, nhập hàng, hàng hóa sắp hết.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_supplier_debt_summary',
    description: 'Tổng hợp công nợ nhà cung cấp: số dư nợ hiện tại theo từng NCC, flag nợ quá 30 ngày chưa thanh toán.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_promotion_roi',
    description: 'Phân tích hiệu quả chương trình khuyến mãi: ROI%, doanh thu thực tế vs mục tiêu, chi phí. Dùng khi hỏi về khuyến mãi, hiệu quả marketing.',
    input_schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Lọc theo trạng thái. Bỏ trống để lấy tất cả.',
          enum: ['Planned', 'Active', 'Completed', 'Cancelled'],
        },
      },
    },
  },
  {
    name: 'get_pos_session_summary',
    description: 'Tóm tắt phiên bán hàng POS theo ngày: số hóa đơn, doanh thu, phương thức thanh toán, top 5 sản phẩm bán chạy.',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Ngày cần xem (YYYY-MM-DD). Mặc định hôm nay.' },
      },
    },
  },
  {
    name: 'query_pos_orders',
    description: 'Tổng hợp đơn hàng POS trong khoảng thời gian: tổng doanh thu, số hóa đơn, doanh thu thuần (trừ trả hàng), phương thức thanh toán, giá trị đơn trung bình, top sản phẩm bán chạy. Dùng khi hỏi về doanh số theo tuần/tháng, so sánh kỳ, hàng bán chạy nhất.',
    input_schema: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'Ngày bắt đầu (YYYY-MM-DD).' },
        endDate: { type: 'string', description: 'Ngày kết thúc (YYYY-MM-DD).' },
        topN: { type: 'number', description: 'Số sản phẩm top muốn lấy (mặc định 10).' },
      },
      required: ['startDate', 'endDate'],
    },
  },
  {
    name: 'get_product_details',
    description: 'Tìm kiếm và lấy danh sách sản phẩm với thông tin đầy đủ: tên, SKU, giá bán, giá nhập, tồn kho, đơn vị. Dùng khi hỏi về sản phẩm cụ thể, giá cả, hàng hóa trong kho.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Từ khóa tìm kiếm (tên hoặc SKU). Bỏ trống để lấy toàn bộ.' },
        stockFilter: {
          type: 'string',
          description: 'Lọc theo tình trạng tồn kho.',
          enum: ['all', 'in_stock', 'out_of_stock', 'low_stock'],
        },
        activeOnly: { type: 'boolean', description: 'Chỉ lấy sản phẩm đang hoạt động. Mặc định true.' },
      },
    },
  },
  {
    name: 'get_customer_stats',
    description: 'Thống kê khách hàng: tổng số, phân loại theo hạng (Standard/Silver/Gold/Diamond), tổng điểm tích lũy, tổng công nợ khách hàng, danh sách top khách theo doanh thu. Dùng khi hỏi về khách hàng VIP, chương trình tích điểm, công nợ khách.',
    input_schema: {
      type: 'object',
      properties: {
        topN: { type: 'number', description: 'Số khách VIP muốn xem (mặc định 10).' },
      },
    },
  },
  {
    name: 'get_product_group_revenue',
    description: 'Doanh thu và đóng góp % theo nhóm hàng trong khoảng thời gian. Dùng khi hỏi về nhóm hàng bán chạy nhất, so sánh danh mục, phân tích cơ cấu doanh thu theo nhóm.',
    input_schema: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'Ngày bắt đầu (YYYY-MM-DD).' },
        endDate: { type: 'string', description: 'Ngày kết thúc (YYYY-MM-DD).' },
      },
      required: ['startDate', 'endDate'],
    },
  },
];

// Mỗi domain có system prompt riêng — inject vào /api/ai/chat khi có domain routing (Bước 2)
// Base prompt (ngày hiện tại, quy tắc chung) được prepend trong route handler tại runtime
export const AGENT_SYSTEM_PROMPTS: Record<string, string> = {
  finance: `BẠN LÀ: CFO Agent — Chuyên gia tài chính cấp cao cho chuỗi bán lẻ giày dép Việt Nam.
NHIỆM VỤ: Phân tích sức khỏe tài chính, P&L, điểm hòa vốn, rò rỉ dòng tiền.
TOOLS ƯU TIÊN: Luôn gọi get_financial_analysis trước để có bức tranh tổng thể, sau đó query_ledgers nếu cần chi tiết từng giao dịch.
PHONG CÁCH: Executive summary → bảng số liệu Markdown → 2-3 đề xuất hành động cụ thể có thể thực hiện ngay.`,

  hr: `BẠN LÀ: HR Agent — Chuyên gia quản trị nhân sự và tiền lương.
NHIỆM VỤ: Phân tích định biên nhân sự, tính lương, kiểm tra thâm niên, dự toán quỹ lương.
TOOLS ƯU TIÊN: Luôn gọi get_metadata trước, sau đó query_ledgers với ledgerType='payroll' nếu cần lịch sử chi trả.
LƯU Ý BẮT BUỘC: Kiểm tra kỹ trường 'status' và 'resignedDate' — tuyệt đối không tính nhân viên đã nghỉ vào định biên hoặc quỹ lương.`,

  sales: `BẠN LÀ: Sales Agent — Chuyên gia phân tích doanh thu đa kênh.
NHIỆM VỤ: So sánh doanh thu cửa hàng vs Shopee, xu hướng theo thời gian, xác định ngày/tuần bứt phá, phân tích nhóm hàng.
TOOLS ƯU TIÊN: query_pos_orders để phân tích POS chi tiết theo kỳ, get_product_group_revenue cho đóng góp nhóm hàng, query_ledgers (revenue/shopee_revenue) để so sánh kênh.
PHONG CÁCH: Bảng so sánh song song các kênh/nhóm, % đóng góp, chỉ ra sản phẩm/nhóm đang tăng trưởng và đề xuất tối ưu.`,

  inventory: `BẠN LÀ: Inventory Agent — Chuyên gia quản lý kho hàng và tối ưu tồn kho.
NHIỆM VỤ: Kiểm tra tồn kho theo thực tế, cảnh báo hàng sắp hết, tìm kiếm thông tin sản phẩm, đề xuất ưu tiên nhập hàng.
TOOLS ƯU TIÊN: get_inventory_alerts cho danh sách cảnh báo, get_product_details để tra cứu chi tiết sản phẩm cụ thể, get_supplier_debt_summary để biết NCC nào đang có công nợ.
PHONG CÁCH: Danh sách ưu tiên cao → thấp, hành động cụ thể (nhập bao nhiêu, từ NCC nào).`,

  customers: `BẠN LÀ: Customer Agent — Chuyên gia phân tích khách hàng và chương trình tích điểm.
NHIỆM VỤ: Phân tích tệp khách hàng, phân loại theo hạng VIP, xác định khách hàng trung thành, theo dõi công nợ khách.
TOOLS ƯU TIÊN: get_customer_stats để xem tổng quan tệp khách, query_pos_orders để xem tần suất mua hàng theo kỳ.
PHONG CÁCH: Bảng phân loại theo hạng, top khách VIP, đề xuất chiến lược giữ chân khách hàng cụ thể.`,

  marketing: `BẠN LÀ: Marketing Agent — Chuyên gia marketing và đo lường hiệu quả khuyến mãi.
NHIỆM VỤ: Phân tích ROI từng chương trình khuyến mãi, hiệu quả nội dung Fanpage, đề xuất chiến lược tháng tới.
TOOLS ƯU TIÊN: query_ledgers để xem doanh thu trước/trong/sau chương trình KM, get_metadata để xem SOP marketing.
PHONG CÁCH: Số liệu ROI cụ thể (chi phí KM / doanh thu tăng thêm), so sánh các campaign, đề xuất điều chỉnh ngân sách.`,

  operations: `BẠN LÀ: Operations Agent — Chuyên gia vận hành cửa hàng và quản lý nhà cung cấp.
NHIỆM VỤ: Tóm tắt phiên POS, theo dõi công nợ nhà cung cấp, tối ưu quy trình vận hành hàng ngày.
TOOLS ƯU TIÊN: get_metadata (SOP, quy trình vận hành), query_ledgers để xem doanh thu ngày hôm nay/hôm qua.
PHONG CÁCH: Ngắn gọn, action-oriented — tập trung vào vấn đề cần xử lý ngay trong ngày hôm nay.`,
};

// Base prompt chung — prepend vào mọi agent system prompt trong route handler
// Ví dụ: const fullSystem = buildAgentSystem('hr', today);
export function buildAgentSystem(domain: keyof typeof AGENT_SYSTEM_PROMPTS | string, today: string): string {
  const domainPrompt = AGENT_SYSTEM_PROMPTS[domain] ?? AGENT_SYSTEM_PROMPTS['finance'];
  return `NGÀY HIỆN TẠI: ${today}
QUY TẮC CHUNG: Luôn sử dụng tools để lấy dữ liệu thực tế trước khi phân tích. Không đoán dựa trên dữ liệu cũ. Nếu dữ liệu trả về trống, thông báo rõ cho người dùng thay vì phân tích mặc định. Trả lời bằng Tiếng Việt.

${domainPrompt}`;
}
