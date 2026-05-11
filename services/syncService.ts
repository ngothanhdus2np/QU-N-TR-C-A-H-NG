
const PENDING_KEY = 'cfo_brain_pending_count';

export function incrementPending(): number {
  const n = getPendingCount() + 1;
  localStorage.setItem(PENDING_KEY, String(n));
  return n;
}

export function getPendingCount(): number {
  return parseInt(localStorage.getItem(PENDING_KEY) || '0', 10);
}

export function clearPending(): void {
  localStorage.removeItem(PENDING_KEY);
}
