/**
 * translateError — chuyển lỗi kỹ thuật (Supabase/PostgREST/mạng/JS) sang câu tiếng Việt
 * dễ hiểu cho nhân viên bán hàng. UI chỉ hiển thị câu thân thiện; raw message được log ra
 * console cho dev debug. Dùng thay cho việc đưa thẳng `err.message` lên toast/alert.
 *
 * Cách dùng:
 *   showToast(translateError(err), 'error');
 *   showToast(translateError(err, 'Không lưu được sản phẩm'), 'error');  // fallback riêng
 */
export function translateError(
  err: unknown,
  fallback = 'Đã có lỗi xảy ra, vui lòng thử lại'
): string {
  const raw = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  const msg = raw.toLowerCase();

  // Mạng / kết nối
  if (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('fetch failed') ||
    msg.includes('load failed') ||
    msg.includes('err_network')
  ) {
    return 'Mất kết nối mạng. Kiểm tra internet rồi thử lại.';
  }
  if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('quá lâu')) {
    return 'Máy chủ phản hồi quá lâu. Vui lòng thử lại.';
  }

  // Xác thực / phân quyền
  if (
    msg.includes('401') ||
    msg.includes('unauthorized') ||
    msg.includes('jwt') ||
    msg.includes('invalid token') ||
    msg.includes('session')
  ) {
    return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  }
  if (
    msg.includes('403') ||
    msg.includes('permission denied') ||
    msg.includes('row-level security') ||
    msg.includes('42501')
  ) {
    return 'Bạn không có quyền thực hiện thao tác này.';
  }

  // Ràng buộc dữ liệu
  if (
    msg.includes('duplicate key') ||
    msg.includes('already exists') ||
    msg.includes('unique constraint') ||
    msg.includes('23505')
  ) {
    return 'Dữ liệu đã tồn tại (trùng mã). Vui lòng kiểm tra lại.';
  }
  if (
    msg.includes('check constraint') ||
    msg.includes('invalid input') ||
    msg.includes('không hợp lệ') ||
    msg.includes('22p02') ||
    msg.includes('không được âm')
  ) {
    return 'Dữ liệu nhập không hợp lệ. Vui lòng kiểm tra lại các ô số/giá.';
  }
  if (msg.includes('foreign key') || msg.includes('23503')) {
    return 'Dữ liệu liên quan không tồn tại hoặc đang được tham chiếu.';
  }
  if (msg.includes('not-null') || msg.includes('null value') || msg.includes('23502')) {
    return 'Thiếu thông tin bắt buộc. Vui lòng điền đầy đủ.';
  }

  // Lỗi máy chủ
  if (msg.includes('500') || msg.includes('internal server') || msg.includes('502') || msg.includes('503')) {
    return 'Máy chủ gặp sự cố. Vui lòng thử lại sau ít phút.';
  }

  // Không nhận diện được → giữ raw ở console cho dev, UI trả câu chung
  if (raw) console.error('[translateError] raw:', raw);
  return fallback;
}
