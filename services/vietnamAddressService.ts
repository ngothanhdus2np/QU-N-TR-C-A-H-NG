import { getProvinces as getStaticProvinces, getDistricts as getStaticDistricts } from '../data/vietnamAddress';

const API_BASE = 'https://provinces.open-api.vn/api';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface AddressProvince { name: string }
export interface AddressDistrict { name: string }
export interface AddressWard { name: string }

function cacheGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw) as { data: T; ts: number };
    if (Date.now() - ts > CACHE_TTL_MS) { localStorage.removeItem(key); return null; }
    return data;
  } catch { return null; }
}

function cacheSet(key: string, data: unknown): void {
  try { localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })); } catch { /* ignore */ }
}

export function fetchProvinces(): AddressProvince[] {
  return getStaticProvinces().map(name => ({ name }));
}

export function fetchDistricts(province: string): AddressDistrict[] {
  return getStaticDistricts(province).map(name => ({ name }));
}

// District name → province API code lookup (for ward fetching)
const PROVINCE_CODES: Record<string, number> = {
  "Thành phố Hà Nội":1,"Tỉnh Hà Giang":2,"Tỉnh Cao Bằng":4,"Tỉnh Bắc Kạn":6,
  "Tỉnh Tuyên Quang":8,"Tỉnh Lào Cai":10,"Tỉnh Điện Biên":11,"Tỉnh Lai Châu":12,
  "Tỉnh Sơn La":14,"Tỉnh Yên Bái":15,"Tỉnh Hoà Bình":17,"Tỉnh Thái Nguyên":19,
  "Tỉnh Lạng Sơn":20,"Tỉnh Quảng Ninh":22,"Tỉnh Bắc Giang":24,"Tỉnh Phú Thọ":25,
  "Tỉnh Vĩnh Phúc":26,"Tỉnh Bắc Ninh":27,"Tỉnh Hải Dương":30,"Thành phố Hải Phòng":31,
  "Tỉnh Hưng Yên":33,"Tỉnh Thái Bình":34,"Tỉnh Hà Nam":35,"Tỉnh Nam Định":36,
  "Tỉnh Ninh Bình":37,"Tỉnh Thanh Hóa":38,"Tỉnh Nghệ An":40,"Tỉnh Hà Tĩnh":42,
  "Tỉnh Quảng Bình":44,"Tỉnh Quảng Trị":45,"Thành phố Huế":46,"Thành phố Đà Nẵng":48,
  "Tỉnh Quảng Nam":49,"Tỉnh Quảng Ngãi":51,"Tỉnh Bình Định":52,"Tỉnh Phú Yên":54,
  "Tỉnh Khánh Hòa":56,"Tỉnh Ninh Thuận":58,"Tỉnh Bình Thuận":60,"Tỉnh Kon Tum":62,
  "Tỉnh Gia Lai":64,"Tỉnh Đắk Lắk":66,"Tỉnh Đắk Nông":67,"Tỉnh Lâm Đồng":68,
  "Tỉnh Bình Phước":70,"Tỉnh Tây Ninh":72,"Tỉnh Bình Dương":74,"Tỉnh Đồng Nai":75,
  "Tỉnh Bà Rịa - Vũng Tàu":77,"Thành phố Hồ Chí Minh":79,"Tỉnh Long An":80,
  "Tỉnh Tiền Giang":82,"Tỉnh Bến Tre":83,"Tỉnh Trà Vinh":84,"Tỉnh Vĩnh Long":86,
  "Tỉnh Đồng Tháp":87,"Tỉnh An Giang":89,"Tỉnh Kiên Giang":91,"Thành phố Cần Thơ":92,
  "Tỉnh Hậu Giang":93,"Tỉnh Sóc Trăng":94,"Tỉnh Bạc Liêu":95,"Tỉnh Cà Mau":96,
};

// Fetch districts with codes from API (needed to then fetch wards)
async function fetchDistrictCodesForProvince(province: string): Promise<Map<string, number>> {
  const provinceCode = PROVINCE_CODES[province];
  if (!provinceCode) return new Map();
  const cacheKey = `vn_district_codes_${provinceCode}`;
  const cached = cacheGet<[string, number][]>(cacheKey);
  if (cached) return new Map(cached);
  try {
    const res = await fetch(`${API_BASE}/p/${provinceCode}?depth=2`);
    const json = await res.json() as { districts: { code: number; name: string }[] };
    const entries: [string, number][] = (json.districts ?? []).map(d => [d.name, d.code]);
    cacheSet(cacheKey, entries);
    return new Map(entries);
  } catch { return new Map(); }
}

export async function fetchWards(province: string, district: string): Promise<AddressWard[]> {
  const cacheKey = `vn_wards_${province}_${district}`;
  const cached = cacheGet<string[]>(cacheKey);
  if (cached) return cached.map(name => ({ name }));
  try {
    const districtCodes = await fetchDistrictCodesForProvince(province);
    const districtCode = districtCodes.get(district);
    if (!districtCode) return [];
    const res = await fetch(`${API_BASE}/d/${districtCode}?depth=2`);
    const json = await res.json() as { wards: { name: string }[] };
    const wardNames = (json.wards ?? []).map(w => w.name);
    cacheSet(cacheKey, wardNames);
    return wardNames.map(name => ({ name }));
  } catch { return []; }
}
