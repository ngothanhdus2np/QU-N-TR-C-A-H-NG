export const getCurrentStaffId = () => {
  if (typeof window === 'undefined') return 'unknown';

  return (
    localStorage.getItem('cfo_current_staff_id') ||
    localStorage.getItem('cfo_staff_id') ||
    localStorage.getItem('current_staff_id') ||
    'unknown'
  );
};

// Chủ cửa hàng — lựa chọn "người bán" giả trong POS, KHÔNG phải bản ghi trong bảng `employees`.
// Cố tình để ngoài bảng employees để không lọt vào bất kỳ tính toán KPI/xếp hạng/lương nào
// (calculateMarketingPerformance, calculateStaffRanking... đều duyệt qua bảng employees).
export const OWNER_STAFF_ID = 'OWNER';
export const OWNER_STAFF_NAME = 'Ngô Thành Du';

// Tra tên hiển thị cho 1 staffId (Chủ cửa hàng hoặc nhân viên trong bảng employees).
// Dùng ở mọi nơi hiển thị "người tạo/người bán" thay vì hiện thẳng staffId thô (vd "OWNER").
export const resolveStaffName = (
  staffId?: string,
  employees: Array<{ id: string; name: string }> = []
): string | undefined => {
  if (!staffId) return undefined;
  if (staffId === OWNER_STAFF_ID) return OWNER_STAFF_NAME;
  return employees.find(e => e.id === staffId)?.name || staffId;
};
