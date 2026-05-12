export const getCurrentStaffId = () => {
  if (typeof window === 'undefined') return 'unknown';

  return (
    localStorage.getItem('cfo_current_staff_id') ||
    localStorage.getItem('cfo_staff_id') ||
    localStorage.getItem('current_staff_id') ||
    'unknown'
  );
};
