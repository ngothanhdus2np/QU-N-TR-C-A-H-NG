"""
Cập nhật SKU đúng + xóa đơn không cần thiết trong shopee_inventory_out.
Nguồn: sheet CAN SUA MA SP trong DonHang_TatCa_2024_2026.xlsx
"""
import pandas as pd
import requests
import json
import re
import uuid

SUPABASE_URL = "https://tqouzxlnihfjdyxqlbqs.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxb3V6eGxuaWhmamR5eHFsYnFzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDEyNzk3MSwiZXhwIjoyMDg1NzAzOTcxfQ.epmAHShEIr2ZAS0n3UA5EAZCC5uYNsnOzDp0oWl5DvY"
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}
SOURCE_FILE = "/Users/apple/Downloads/Đơn Hàng Shopee/DonHang_TatCa_2024_2026.xlsx"


def load_correction_sheet():
    xl = pd.ExcelFile(SOURCE_FILE)
    df = pd.read_excel(xl, sheet_name='CAN SUA MA SP', dtype=str, header=2)
    df.columns = ['stt', 'nguon', 'tinhtrang', 'ngaygui', 'nentang', 'mavandan', 'sl', 'giatri', 'maspnew']
    df = df[df['stt'].notna() & (df['stt'] != 'STT')].copy()
    df['mavandan'] = df['mavandan'].str.strip()
    df['maspnew'] = df['maspnew'].fillna('').str.strip()

    to_delete = []
    to_update = []  # (order_id, [skus])

    for _, row in df.iterrows():
        order_id = str(row['mavandan'] or '').strip()
        new_sp = str(row['maspnew'] or '').strip()
        if not order_id or order_id == 'nan':
            continue
        normalized = new_sp.lower().replace('ó', 'o').replace('ỏ', 'o').replace('á', 'a').replace('à', 'a')
        if 'xoa bo' in normalized or 'xoabo' in normalized:
            to_delete.append(order_id)
        elif new_sp and new_sp != 'nan':
            skus = [s.strip() for s in re.split(r'\s*;\s*', new_sp) if s.strip()]
            if skus:
                to_update.append((order_id, skus))

    return to_delete, to_update


def delete_by_order_ids(order_ids, batch_size=100):
    total = len(order_ids)
    deleted = 0
    for i in range(0, total, batch_size):
        batch = order_ids[i:i + batch_size]
        ids_str = ','.join(batch)
        url = f"{SUPABASE_URL}/rest/v1/shopee_inventory_out?order_id=in.({ids_str})"
        resp = requests.delete(url, headers=HEADERS)
        if resp.status_code in (200, 204):
            deleted += len(batch)
            print(f"  ✅ Deleted {deleted}/{total}")
        else:
            print(f"  ❌ Lỗi xóa batch {i}: {resp.status_code} {resp.text[:200]}")
    return deleted


def fetch_rows_by_order_id(order_id):
    url = f"{SUPABASE_URL}/rest/v1/shopee_inventory_out?order_id=eq.{order_id}&select=*"
    resp = requests.get(url, headers={**HEADERS, "Prefer": ""})
    if resp.status_code == 200:
        return resp.json()
    return []


def update_sku_by_id(row_id, new_sku):
    url = f"{SUPABASE_URL}/rest/v1/shopee_inventory_out?id=eq.{row_id}"
    resp = requests.patch(url, headers=HEADERS, data=json.dumps({"sku": new_sku}))
    return resp.status_code in (200, 204)


def insert_rows(rows):
    url = f"{SUPABASE_URL}/rest/v1/shopee_inventory_out"
    clean = [{k: v for k, v in r.items() if not k.startswith("_")} for r in rows]
    resp = requests.post(url, headers=HEADERS, data=json.dumps(clean))
    return resp.status_code in (200, 201)


def process_updates(to_update):
    ok = 0
    errors = 0
    for order_id, skus in to_update:
        existing = fetch_rows_by_order_id(order_id)

        if not existing:
            print(f"  ⚠️  Không tìm thấy DB rows cho order_id={order_id}")
            errors += 1
            continue

        if len(skus) == 1:
            # Single SKU: update tất cả rows của order này về SKU đúng
            for row in existing:
                if update_sku_by_id(row['id'], skus[0]):
                    ok += 1
                else:
                    print(f"  ❌ Lỗi update id={row['id']}")
                    errors += 1

        else:
            # Multi-SKU: nếu số DB rows bằng số SKUs → map 1-1 theo thứ tự
            if len(existing) == len(skus):
                for row, new_sku in zip(existing, skus):
                    if update_sku_by_id(row['id'], new_sku):
                        ok += 1
                    else:
                        print(f"  ❌ Lỗi update id={row['id']}")
                        errors += 1
            else:
                # Số rows khác số SKUs: update row đầu, insert thêm các SKU còn lại
                base_row = existing[0]
                if update_sku_by_id(base_row['id'], skus[0]):
                    ok += 1
                else:
                    errors += 1
                    continue

                new_rows = []
                for extra_sku in skus[1:]:
                    new_row = {k: v for k, v in base_row.items()}
                    new_row['id'] = str(uuid.uuid4())
                    new_row['sku'] = extra_sku
                    new_rows.append(new_row)

                if new_rows:
                    if insert_rows(new_rows):
                        ok += len(new_rows)
                        print(f"  + Inserted {len(new_rows)} extra SKU rows cho order {order_id}")
                    else:
                        print(f"  ❌ Lỗi insert extra rows cho order {order_id}")
                        errors += 1

    return ok, errors


def main():
    print("=== Fix Shopee SKU Script ===\n")

    to_delete, to_update = load_correction_sheet()
    print(f"Đọc xong CAN SUA MA SP:")
    print(f"  → DELETE: {len(to_delete)} orders")
    print(f"  → UPDATE: {len(to_update)} orders ({sum(1 for _, s in to_update if len(s) > 1)} multi-SKU)")

    # 1. DELETE
    print(f"\n--- Bước 1: Xóa {len(to_delete)} orders ---")
    deleted = delete_by_order_ids(to_delete)
    print(f"  Tổng đã xóa: {deleted}")

    # 2. UPDATE
    print(f"\n--- Bước 2: Cập nhật SKU cho {len(to_update)} orders ---")
    ok, errors = process_updates(to_update)
    print(f"  Thành công: {ok} | Lỗi: {errors}")

    # 3. Kết quả cuối
    print(f"\n--- Kiểm tra DB sau khi xử lý ---")
    total = 0
    offset = 0
    while True:
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/shopee_inventory_out?select=id&limit=1000&offset={offset}",
            headers={**HEADERS, "Prefer": ""}
        )
        data = resp.json()
        if not data:
            break
        total += len(data)
        offset += len(data)
        if len(data) < 1000:
            break
    print(f"  Tổng records trong DB: {total:,}")


if __name__ == "__main__":
    main()
