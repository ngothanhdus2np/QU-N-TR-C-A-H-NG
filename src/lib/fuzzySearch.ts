export const removeDiacritics = (str: string): string =>
  str.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');

/**
 * Fuzzy match: mỗi từ trong search phải xuất hiện trong text (bất kỳ thứ tự, không phân biệt dấu).
 * Ví dụ: fuzzyMatch("sục mủ nữ", "sục nữ mủ") → true
 */
export const fuzzyMatch = (text: string, search: string): boolean => {
  if (!search.trim()) return true;
  const normalizedText = removeDiacritics(text.toLowerCase());
  const words = removeDiacritics(search.toLowerCase()).split(/\s+/).filter(Boolean);
  return words.every(word => normalizedText.includes(word));
};
