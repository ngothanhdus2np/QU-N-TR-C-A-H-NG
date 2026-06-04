"""
Script import toàn bộ đơn hàng Shopee vào bảng shopee_inventory_out.
Chạy: python3 scripts/import_shopee.py
"""
import pandas as pd
import os
import uuid
import unicodedata
import re
import requests
import json
from datetime import datetime

# ──────────────────────────────────────────────
# Config
# ──────────────────────────────────────────────
SUPABASE_URL = "https://tqouzxlnihfjdyxqlbqs.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxb3V6eGxuaWhmamR5eHFsYnFzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDEyNzk3MSwiZXhwIjoyMDg1NzAzOTcxfQ.epmAHShEIr2ZAS0n3UA5EAZCC5uYNsnOzDp0oWl5DvY"

SHOP_BASE = "/Users/apple/Downloads/Đơn Hàng Shopee/shopee_exports"
SHOPS = [
    ("Shop1", "Shopee 1"),
    ("Shop2", "Shopee 2"),
]

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}

# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────
def normalize_header(val):
    if val is None:
        return ""
    s = unicodedata.normalize("NFD", str(val).lower())
    s = re.sub(r"[̀-ͯ]", "", s)
    s = s.replace("đ", "d")
    s = re.sub(r"[^a-z0-9]", "", s)
    return s.strip()


def clean_number(val):
    if isinstance(val, float):
        return 0.0 if (val != val) else val  # NaN → 0
    if isinstance(val, int):
        return float(val)
    if not val:
        return 0.0
    s = str(val).strip()
    if s in ("", "---", "0"):
        return 0.0
    clean = re.sub(r"[^\d.,-]", "", s)
    if not clean:
        return 0.0
    # Dấu phẩy + dấu chấm: format 1.234,56 (EU) → 1234.56
    if "." in clean and "," in clean:
        clean = clean.replace(".", "").replace(",", ".")
    elif "," in clean:
        parts = clean.split(",")
        if len(parts[-1]) == 3:
            clean = clean.replace(",", "")  # thousand separator
        else:
            clean = clean.replace(",", ".")
    elif "." in clean:
        parts = clean.split(".")
        if len(parts) > 2 or len(parts[-1]) == 3:
            clean = clean.replace(".", "")  # thousand separator
    try:
        return float(clean)
    except Exception:
        return 0.0


def parse_date(val):
    if val is None:
        return ""
    if isinstance(val, (datetime, pd.Timestamp)):
        if pd.isna(val):
            return ""
        return val.strftime("%Y-%m-%d")
    s = str(val).strip()
    if not s or s == "nan":
        return ""
    for fmt in ["%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d",
                "%d/%m/%Y %H:%M:%S", "%d/%m/%Y %H:%M", "%d/%m/%Y",
                "%d-%m-%Y"]:
        try:
            return datetime.strptime(s[:len(fmt)], fmt).strftime("%Y-%m-%d")
        except Exception:
            pass
    return s[:10] if len(s) >= 10 else s


def map_status(raw_status):
    s = normalize_header(str(raw_status))
    if "huy" in s:
        return "CANCEL"
    if "trahang" in s or "hoantien" in s:
        return "RETURN"
    if "hoanthanh" in s or "nhanduochan" in s or "xacnhan" in s or "danhan" in s:
        return "OK"
    if "danggiao" in s or "vanchuyen" in s or "dagiao" in s:
        return "SHIPPING"
    return "OK"


# ──────────────────────────────────────────────
# Parse một file Shopee
# ──────────────────────────────────────────────
def parse_file(filepath, platform_label):
    if filepath.endswith(".csv"):
        df = pd.read_csv(filepath, dtype=str)
    else:
        df = pd.read_excel(filepath, dtype=str)

    # Normalize column names
    col_map = {col: normalize_header(col) for col in df.columns}
    df.rename(columns=col_map, inplace=True)

    records = []
    for _, row in df.iterrows():
        def g(key, fallbacks=()):
            """Lấy giá trị từ row theo normalized key hoặc fallbacks."""
            v = row.get(key)
            if v is not None and str(v) not in ("nan", "", "None"):
                return v
            for fb in fallbacks:
                v = row.get(fb)
                if v is not None and str(v) not in ("nan", "", "None"):
                    return v
            return None

        order_id = str(g("madonhang", ("orderid",)) or "").strip()
        sku = str(g("skuphanloaihang", ("masku", "skusanpham", "sku", "tenphanloaihang")) or "").strip()

        # Bỏ qua dòng không có order ID hoặc SKU (gift items, blank rows)
        if not order_id or not sku:
            continue

        raw_date = g("ngaydathang", ("ngaydat", "ngaydatdon", "ngaytaodon",
                                      "thoigiantaodon", "ngaygui", "ngaygiao"))
        date = parse_date(raw_date) or datetime.today().strftime("%Y-%m-%d")

        raw_status = g("trangthaidonhang", ("trangthai",)) or "Hoàn thành"
        status = map_status(raw_status)

        quantity = clean_number(g("soluong", ("quantity",)) or 1)
        sale_price = clean_number(g("giauudai", ("giaban", "giagoc", "price")) or 0)
        platform_fee = clean_number(g("phicodinh", ("commissionfee", "phihoacong")) or 0)
        payment_fee = clean_number(g("phixulygiaodich", ("phithanhtoan", "paymentfee")) or 0)
        freeship_extra = clean_number(g("phidichvu", ("servicefee", "freeshipextra")) or 0)
        affiliate_fee = clean_number(g("phitiepthilienket",
                                        ("phitiepthilienketshopee", "affiliatefee")) or 0)
        address = str(g("diachinhanhang", ("address", "diachigiaohan")) or "").strip()
        shipping_unit = str(g("donvivanchuyen", ("shippingcarrier",)) or "").strip()

        # Lợi nhuận cơ bản (chưa trừ giá vốn + chi phí vận hành)
        if status in ("OK", "SHIPPING"):
            net_profit = sale_price - platform_fee - payment_fee - freeship_extra - affiliate_fee
        else:
            net_profit = 0.0

        records.append({
            "id": str(uuid.uuid4()),
            "date": date,
            "status": status,
            "order_id": order_id,
            "sku": sku,
            "quantity": quantity,
            "sale_price": sale_price,
            "platform_fee": platform_fee,
            "payment_fee": payment_fee,
            "freeship_extra": freeship_extra,
            "affiliate_fee": affiliate_fee,
            "handling_fee": 0.0,
            "ads_cost": 0.0,
            "ads_tax": 0.0,
            "personal_income_tax": 0.0,
            "net_profit": net_profit,
            "address": address,
            "shipping_unit": shipping_unit,
            "_platform": platform_label,   # meta, không insert vào DB
        })

    return records


# ──────────────────────────────────────────────
# Lấy danh sách order_id + sku đã có trong DB
# ──────────────────────────────────────────────
def fetch_existing_keys():
    all_keys = set()
    offset = 0
    page_size = 1000
    while True:
        url = (f"{SUPABASE_URL}/rest/v1/shopee_inventory_out"
               f"?select=order_id,sku&limit={page_size}&offset={offset}")
        resp = requests.get(url, headers=HEADERS)
        if resp.status_code != 200:
            print(f"  WARNING: Không lấy được existing records: {resp.text}")
            return all_keys
        data = resp.json()
        if not data:
            break
        for r in data:
            all_keys.add((r.get("order_id", ""), r.get("sku", "")))
        offset += len(data)
        if len(data) < page_size:
            break
    return all_keys


# ──────────────────────────────────────────────
# Insert batch vào Supabase
# ──────────────────────────────────────────────
def insert_batch(records, batch_size=500):
    total = len(records)
    success = 0
    for i in range(0, total, batch_size):
        batch = records[i: i + batch_size]
        # Bỏ field meta _platform trước khi insert
        clean_batch = [{k: v for k, v in r.items() if not k.startswith("_")} for r in batch]
        url = f"{SUPABASE_URL}/rest/v1/shopee_inventory_out"
        resp = requests.post(url, headers=HEADERS, data=json.dumps(clean_batch))
        if resp.status_code in (200, 201):
            success += len(batch)
            print(f"  ✅ Inserted {i + len(batch):,}/{total:,}")
        else:
            print(f"  ❌ Lỗi batch {i}–{i+len(batch)}: {resp.status_code} {resp.text[:200]}")
    return success


# ──────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────
def main():
    print("=== Shopee Import Script ===\n")

    # 1. Thu thập tất cả file, bỏ trùng "(1)"
    all_files = []  # list of (filepath, platform_label)
    for shop_folder, label in SHOPS:
        folder = os.path.join(SHOP_BASE, shop_folder)
        files = sorted(os.listdir(folder))
        seen_basenames = set()
        for f in files:
            if not (f.endswith(".xlsx") or f.endswith(".csv")):
                continue
            basename = f.replace(" (1)", "")
            if basename in seen_basenames:
                print(f"  [SKIP trùng] {f}")
                continue
            seen_basenames.add(basename)
            all_files.append((os.path.join(folder, f), label))

    print(f"Sẽ xử lý {len(all_files)} files\n")

    # 2. Parse tất cả files
    all_records = []
    seen_keys = set()  # (order_id, sku) để deduplicate giữa các files
    for filepath, label in all_files:
        fname = os.path.basename(filepath)
        try:
            recs = parse_file(filepath, label)
            added = 0
            for r in recs:
                key = (r["order_id"], r["sku"])
                if key not in seen_keys:
                    seen_keys.add(key)
                    all_records.append(r)
                    added += 1
            print(f"  [{label}] {fname}: {len(recs)} rows → {added} unique")
        except Exception as e:
            print(f"  ❌ Lỗi đọc {fname}: {e}")

    print(f"\nTổng unique records parsed: {len(all_records):,}")

    # Thống kê theo status
    from collections import Counter
    status_counts = Counter(r["status"] for r in all_records)
    for s, cnt in sorted(status_counts.items()):
        print(f"  {s}: {cnt:,}")

    # 3. Lọc bỏ records đã có trong DB
    print("\nĐang kiểm tra records đã có trong DB...")
    existing = fetch_existing_keys()
    print(f"  DB hiện có: {len(existing):,} records")

    new_records = [r for r in all_records
                   if (r["order_id"], r["sku"]) not in existing]
    print(f"  Records mới cần insert: {len(new_records):,}")

    if not new_records:
        print("\nKhông có records mới. Thoát.")
        return

    # 4. Insert vào Supabase
    print(f"\nBắt đầu insert {len(new_records):,} records...")
    inserted = insert_batch(new_records)
    print(f"\n✅ Hoàn thành! Đã insert {inserted:,}/{len(new_records):,} records.")


if __name__ == "__main__":
    main()
