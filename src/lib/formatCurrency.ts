// Nguồn dùng chung cho định dạng tiền tệ hiển thị (VNĐ).
// Tạo để chống tái diễn bug từng xảy ra (commit 0f35300: FinanceReportPage hiển thị
// '$' USD thay vì 'đ' VNĐ) khi mỗi trang tự viết hàm format riêng.
//
// PHẠM VI: chỉ dành cho HIỂN THỊ (đọc). KHÔNG dùng cho ô nhập liệu — format ô nhập
// (PromotionManager dùng en-US + parseCurrency, POSCheckout dùng formatSplitCurrency)
// có ngữ nghĩa khác, giữ riêng.

// Định dạng tiền chuẩn: làm tròn về số nguyên đồng, phân tách hàng nghìn kiểu VN,
// hậu tố 'đ'. Ví dụ: 1234567.8 → "1.234.568đ".
export function formatCurrency(value: number): string {
  return `${Math.round(value).toLocaleString('vi-VN')}đ`;
}

// Định dạng rút gọn cho trục biểu đồ: tỷ / tr / k. Ví dụ: 1_500_000 → "1.5 tr".
// Bản superset (gộp từ SalesReportPage — có nhánh tỷ; OrderReportPage bản cũ thiếu nhánh
// này nên giá trị >= 1 tỷ trước đây hiển thị dạng "1500 tr", nay ra "1.5 tỷ").
export function formatCurrencyAxis(value: number): string {
  if (value >= 1_000_000_000) return `${Number((value / 1_000_000_000).toFixed(1))} tỷ`;
  if (value >= 1_000_000) return `${Number((value / 1_000_000).toFixed(1))} tr`;
  if (value >= 1000) return `${Math.round(value / 1000)}k`;
  return String(value);
}
