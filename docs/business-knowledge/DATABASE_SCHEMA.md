# DATABASE_SCHEMA — Cơ sở dữ liệu CFO Brain 4.0

> Source: supabase_setup.sql, types.ts, services/dataMapper.ts
> Database: PostgreSQL (Supabase self-hosted, 192.168.1.3:8000)

---

## Nhóm bảng theo domain

### 1. NHÂN SỰ & LƯƠNG

#### employees
| Cột | Kiểu | Mô tả |
|-----|------|-------|
| id | UUID PK | |
| name | TEXT | Tên đầy đủ |
| position | TEXT | Chức vụ |
| join_date | TEXT | Ngày vào làm (YYYY-MM-DD) |
| resigned_date | TEXT | Ngày nghỉ việc (null = đang làm) |
| assigned_policy_id | TEXT | FK logic → salary_policies.id |
| dob / phone / address / email | TEXT | Thông tin cá nhân |
| bank_account_number / bank_name / bank_account_holder | TEXT | Tài khoản ngân hàng |
| photo_url | TEXT | Ảnh đại diện |
| carry_forward_debt | NUMERIC DEFAULT 0 | Nợ lương chuyển kỳ còn lại |
| branch_id | TEXT DEFAULT 'main' | |

#### salary_policies
| Cột | Kiểu | Mô tả |
|-----|------|-------|
| id | UUID PK | |
| name | TEXT | Tên chính sách |
| salary_type | TEXT | 'daily' hoặc 'monthly' |
| base_salary | NUMERIC | Lương cơ bản |
| start_threshold / end_threshold | NUMERIC | Khoảng thâm niên ngày (end=0 → vô cực) |
| ot_rate | NUMERIC | Hệ số tăng ca |
| commission_rate | NUMERIC | Tỷ lệ hoa hồng (%) |
| seniority_bonus_per_year | NUMERIC | Thưởng thâm niên theo năm |
| attendance_allowance | NUMERIC | Phụ cấp chuyên cần |
| cleaning_allowance | NUMERIC | Phụ cấp vệ sinh |
| customer_service_allowance | NUMERIC | Phụ cấp CSKH |
| dinner_allowance | NUMERIC | Phụ cấp ăn tối |
| housing_allowance | NUMERIC | Phụ cấp nhà ở |
| responsibility_allowance | NUMERIC | Phụ cấp trách nhiệm |
| is_pro_rated | BOOLEAN | Tính theo ngày thực tế |

#### attendance_records
| Cột | Kiểu | Mô tả |
|-----|------|-------|
| employee_id | UUID FK | |
| date | TEXT | YYYY-MM-DD |
| status | TEXT | 'Present' / 'AuthorizedLeave' (CP) / 'UnauthorizedLeave' (KP) / 'Holiday' / 'Absent' |
| hours | NUMERIC | Số giờ làm |

#### overtime_records
| Cột | Kiểu | Mô tả |
|-----|------|-------|
| employee_id | UUID FK | |
| date | TEXT | |
| hours | NUMERIC | Số giờ tăng ca |
| multiplier | NUMERIC DEFAULT 1 | Hệ số (thường 1.5× hoặc 2×) |

#### sales_records
| Cột | Kiểu | Mô tả |
|-----|------|-------|
| employee_id | UUID FK | |
| date | TEXT | |
| sales_amount | NUMERIC | Doanh số |
| commission_rate / commission_earned | NUMERIC | Hoa hồng |

#### payroll_records
| Cột | Kiểu | Mô tả |
|-----|------|-------|
| employee_id | UUID FK | |
| month | TEXT | YYYY-MM |
| basic_salary / allowance / responsibility_pay | NUMERIC | Lương cơ bản + phụ cấp |
| overtime_pay / commission_pay / seniority_bonus | NUMERIC | Các khoản thêm |
| holiday_bonus / tet_bonus / tet_bonus_before / tet_bonus_after | NUMERIC | Thưởng |
| advance / shortage / fine | NUMERIC | Khấu trừ |
| net_pay | NUMERIC | Thực lĩnh |
| is_official | BOOLEAN | true = đã chốt lương |
| has_tet_commitment | BOOLEAN | Có ràng buộc Tết |
| carry_forward_deduction | NUMERIC DEFAULT 0 | Khấu trừ nợ kỳ trước |
| carry_forward_debt_out | NUMERIC DEFAULT 0 | Nợ chuyển kỳ sau |

---

### 2. HÀNG HÓA & KHO

#### pos_products
| Cột | Kiểu | Mô tả |
|-----|------|-------|
| id | UUID PK | |
| sku | TEXT | Mã hàng (UNIQUE) |
| name | TEXT | Tên sản phẩm |
| category_id / category_path | TEXT | Danh mục (dạng path "A > B > C") |
| import_price | NUMERIC | Giá nhập hiện tại |
| sale_price | NUMERIC | Giá bán |
| stock | NUMERIC | Tồn kho hiện tại |
| min_stock | NUMERIC DEFAULT 0 | Tồn kho tối thiểu (cảnh báo) |
| location | TEXT | Vị trí kho |
| brand | TEXT | Thương hiệu |
| barcode | TEXT | Mã vạch |
| status | TEXT DEFAULT 'Active' | 'Active' / 'Inactive' / 'Discontinued' |
| parent_id | TEXT FK | Sản phẩm cha (variant grouping) |
| is_parent | BOOLEAN | true = sản phẩm cha |
| variant_count | INTEGER | Số biến thể con |
| variant_attributes | JSONB | { "Màu": "Đen", "Size": "39" } |
| allow_points | BOOLEAN DEFAULT true | Cho phép tích điểm |
| images | JSONB | Mảng URL ảnh |
| units | JSONB | Đơn vị đo (chuyển đổi) |

#### inventory_transactions
| Cột | Kiểu | Mô tả |
|-----|------|-------|
| id | UUID PK | |
| date | TEXT | |
| type | TEXT | 'Import' / 'Sale' / 'Return' / 'Check' / 'PurchaseReturn' / 'Export' / 'internal_use' / 'disposal' |
| status | TEXT | 'draft' / 'completed' / 'cancelled' / 'balanced' |
| items | JSONB | Mảng item (sku, qty, previousStock, newStock, nextImportPrice, previousImportPrice) |
| supplier_id / supplier_name | TEXT | Nhà cung cấp (nhập hàng) |
| reference_id | TEXT | Mã phiếu (TH..., PN...) |
| total_amount | NUMERIC | Tổng giá trị phiếu |
| invoice_status | TEXT | 'full' / 'partial' / 'memo_only' / 'none' |
| branch_id | TEXT | |

#### product_cost_history
| Cột | Kiểu | Mô tả |
|-----|------|-------|
| sku | TEXT | |
| import_price | NUMERIC | Giá vốn tại thời điểm |
| effective_date | TEXT | Ngày hiệu lực |
| source | TEXT DEFAULT 'purchase' | |
| INDEX | | (sku, effective_date DESC) |

---

### 3. BÁN HÀNG POS

#### pos_orders
| Cột | Kiểu | Mô tả |
|-----|------|-------|
| id | UUID PK | |
| order_code | TEXT UNIQUE | Mã đơn (TH... = trả hàng) |
| date | TEXT | YYYY-MM-DD |
| customer_id / customer_name | TEXT | |
| items | JSONB | Mảng POSOrderItem |
| total_amount / discount / final_amount | NUMERIC | |
| refund_amount | NUMERIC | Hoàn tiền (đơn trả hàng) |
| payment_method | TEXT | 'Cash' / 'Bank' / 'Momo' / 'Card' / 'Other' |
| split_payments | JSONB | [{ method, amount }] |
| cash_received | NUMERIC | Tiền khách đưa |
| staff_id / staff_name | TEXT | Thu ngân |
| channel | TEXT DEFAULT 'direct' | 'direct' / 'website' |
| is_return | BOOLEAN DEFAULT false | |
| status | TEXT DEFAULT 'completed' | 'completed' / 'pending' / 'cancelled' / 'returned' / 'return_requested' |
| points_earned | NUMERIC | Điểm tích lũy |
| updated_at | TIMESTAMPTZ | [thêm 2026-06-16] |
| branch_id / tenant_id | TEXT | |

#### pos_customers
| Cột | Kiểu | Mô tả |
|-----|------|-------|
| id | UUID PK | |
| name / phone / email | TEXT | |
| points | NUMERIC | Điểm tích lũy |
| total_spent | NUMERIC | Tổng đã chi |
| last_visit | TEXT | Ngày mua cuối |
| tier | TEXT | 'Standard' / 'Silver' / 'Gold' / 'Diamond' |
| debt_amount | NUMERIC DEFAULT 0 | Công nợ hiện tại |

#### customer_debt_history
| Cột | Kiểu | Mô tả |
|-----|------|-------|
| customer_id | UUID FK → pos_customers | |
| order_id | UUID | |
| type | TEXT CHECK | 'debt' / 'repay' |
| amount | NUMERIC | |
| date / note | TEXT | |

---

### 4. MUA HÀNG & NHÀ CUNG CẤP

#### suppliers
| Cột | Kiểu | Mô tả |
|-----|------|-------|
| id | UUID PK | |
| name / code | TEXT | |
| phone / email / address | TEXT | |
| status | TEXT DEFAULT 'active' | 'active' / 'inactive' |
| company_name / tax_code | TEXT | Công ty (xuất hóa đơn) |
| invoice_company_name / invoice_tax_code | TEXT | Thông tin hóa đơn |

#### supplier_debts
| Cột | Kiểu | Mô tả |
|-----|------|-------|
| supplier_id | UUID FK | |
| supplier_name | TEXT | |
| date | TEXT | |
| type | TEXT | 'purchase' (mua hàng) / 'payment' (thanh toán) |
| amount | NUMERIC | |

---

### 5. TÀI CHÍNH

#### revenue_records
| Cột | Kiểu | Mô tả |
|-----|------|-------|
| date | TEXT | Ngày doanh thu |
| total_gross_revenue | NUMERIC | Doanh thu thô |
| discount | NUMERIC | Giảm giá |
| revenue_other | NUMERIC | Doanh thu khác (phí trả hàng...) |
| returns_value | NUMERIC | Giá trị hàng trả |
| net_revenue | NUMERIC | Doanh thu thuần |
| total_cogs | NUMERIC | Tổng giá vốn |
| gross_profit | NUMERIC | Lợi nhuận gộp |
| branch_id / tenant_id | TEXT | |

#### expense_records
| Cột | Kiểu | Mô tả |
|-----|------|-------|
| date | TEXT | |
| category | TEXT | Danh mục (hierarchical, path) |
| amount | NUMERIC | |
| description | TEXT | |

#### invoice_attachments
| Cột | Kiểu | Mô tả |
|-----|------|-------|
| purchase_record_id | UUID FK | → inventory_transactions.id |
| file_url | TEXT | Supabase Storage URL |
| invoice_number / invoice_date | TEXT | Thông tin hóa đơn |
| invoice_amount / vat_amount | NUMERIC | |
| invoice_status | TEXT | 'full' / 'partial' / 'memo_only' / 'none' |

---

### 6. SHOPEE

#### shopee_inventory_out
| Cột | Kiểu | Mô tả |
|-----|------|-------|
| order_id | TEXT | Mã đơn Shopee |
| sku | TEXT | |
| date | TEXT | |
| status | TEXT | 'OK' / 'RETURN' / 'CANCEL' / 'LOST' / 'SHIPPING' / 'PENDING' |
| quantity / sale_price / customer_paid | NUMERIC | |
| platform_fee / payment_fee / freeship_extra | NUMERIC | Phí nền tảng |
| piship_fee / vat_tax / personal_income_tax | NUMERIC | |
| affiliate_fee / handling_fee / ads_cost | NUMERIC | |
| platform | TEXT | 'Shopee 1' (giaydepphucsang) / 'Shopee 2' (phuc_sang_store) |
| UNIQUE | | (order_id, sku) |

#### shopee_products / shopee_product_variants
Bảng quản lý sản phẩm trên Shopee Seller Center. Tạo 2026-06-16 via docker exec.

---

### 7. WEBSITE STORE

#### store_products
SEO metadata (slug, title, description, gallery), `published` flag.

#### store_product_variants
FK → pos_products, fields: size, color, website_price_override, is_published, stock override.

#### store_collections + store_product_collections
Nhóm sản phẩm cho website (nhiều-nhiều).

#### store_order_addresses
Địa chỉ giao hàng cho đơn website (FK → pos_orders).

#### shipments
Vận đơn: tracking_number, carrier, status, shipped_at, delivered_at.

---

### 8. CONFIG / KEY-VALUE

#### app_state
Bảng key-value lưu config app (key TEXT PK, value JSONB):
- `violation_types` — danh mục vi phạm
- `holidays` — ngày lễ
- `tet_campaign` — cấu hình thưởng Tết
- `expense_categories` — cây danh mục chi phí
- `pos_payment_settings` — cài đặt thanh toán POS
- `pos_inventory_settings` — cài đặt tồn kho (costMethod, allowNegativeStock)
- `daily_break_even_config` — cấu hình điểm hòa vốn

#### categories
| Cột | Kiểu | Mô tả |
|-----|------|-------|
| path | TEXT PK | "Giày > Nam > Oxford" |
| location | TEXT | Vị trí kho mặc định cho danh mục |

#### knowledge_base
Bảng lưu SOP, quy trình, quy chuẩn (kết hợp AI search).

---

### 9. AUDIT

#### audit_logs
Ghi log thay đổi tự động khi: `payroll_records`, `expense_records`, `revenue_records`, `advance_records`, `shortage_records`, `salary_policies`, `inventory_transactions`, `suppliers`, `pos_products` có mutation.

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| table_name / record_id | TEXT | Bảng và ID bị thay đổi |
| action | TEXT | 'INSERT' / 'UPDATE' / 'DELETE' |
| snapshot | JSONB | Dữ liệu trước/sau |

---

## RPC Functions

| Tên | Mô tả |
|-----|-------|
| `decrement_product_stock(product_id, qty)` | Trừ tồn kho, check âm |
| `increment_product_stock(product_id, qty)` | Cộng tồn kho |
| `apply_inventory_transaction_with_stock(...)` | Apply transaction + update stock atomically |
| `delete_inventory_transaction_with_stock(id)` | Xóa + rollback stock |
| `create_store_order(...)` | Tạo đơn website (atomic, lock rows) |
| `update_website_order_status(...)` | Đổi status + cộng/trừ stock |

---

## Tổng số bảng: ~48 bảng

Nhóm chính: employees(1), salary_policies(1), attendance_records(1), overtime_records(1), sales_records(1), shortage_records(1), advance_records(1), payroll_records(1), revenue_records(1), expense_records(1), product_groups(1), product_group_revenue(1), pos_products(1), pos_orders(1), pos_customers(1), customer_debt_history(1), inventory_transactions(1), suppliers(1), supplier_debts(1), shopee_revenue_records(1), shopee_inventory_in(1), shopee_inventory_out(1), shopee_products(1), shopee_product_variants(1), product_cost_history(1), audit_logs(1), invoice_attachments(1), categories(1), knowledge_base(1), app_state(1), staff_performance(1), promotions(1), cashflow_records(1), recurring_expenses(1), store_products(1), store_product_variants(1), store_collections(1), store_product_collections(1), store_order_addresses(1), shipments(1), store_preorder_requests(1), store_contacts(1), vat_documents(1), vat_document_items(1), vat_allocations(1), vat_allocation_events(1), tax_filing_periods(1), shopee_source_data(1)
