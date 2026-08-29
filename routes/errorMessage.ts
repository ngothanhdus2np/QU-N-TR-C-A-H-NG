/**
 * Trích thông điệp lỗi dễ đọc từ một giá trị `unknown` bắt được trong catch.
 *
 * Trước 29/08/2026 hàm này được copy-paste y hệt ở 6 file route
 * (`data.ts`, `ai.ts`, `import.ts`, `facebook.ts`, `notifications.ts`,
 * `factoryReset.ts`). Gộp về một chỗ để sửa một lần là ăn cả 6.
 *
 * Ngoài `Error` chuẩn, hàm còn xử lý object lỗi kiểu Supabase/PostgREST —
 * vốn không phải instance của `Error` mà là object phẳng có `message`,
 * `details`, `hint`, `code`. Nối các phần có giá trị bằng ' | ' để giữ đủ
 * ngữ cảnh khi debug (vd: mã lỗi Postgres `42703` đi kèm tên cột sai).
 *
 * @param fallback Thông điệp khi không moi được gì. Mặc định 'Unknown error';
 *                 `ai.ts` truyền 'AI service error' để giữ nguyên hành vi cũ.
 */
export const getErrorMessage = (error: unknown, fallback = 'Unknown error'): string => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    const parts = [record.message, record.details, record.hint, record.code]
      .filter(Boolean)
      .map(String);
    if (parts.length > 0) return parts.join(' | ');
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return fallback;
};
