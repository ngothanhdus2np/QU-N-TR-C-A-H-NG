# KE HOACH DATABASE VA TICH HOP WEBSITE - APP PHUC SANG

Cap nhat: 15/06/2026

## 1. Muc tieu

Xay dung he thong trong do:

- Website `phucsang.com.vn` la kenh ban hang cho khach.
- App quan tri cua hang la noi xu ly van hanh.
- Website va app dung chung mot nguon du lieu PostgreSQL/Supabase tren iMac.
- San pham, gia va ton kho khong bi nhap trung o hai noi.
- Don dat tren website tu dong xuat hien trong app.
- App xu ly xac nhan, dong goi, van don, giao hang, doi tra va bao cao.
- Dashboard website chi quan ly noi dung trung bay va marketing.

## 2. Hien trang da kiem tra

### 2.1 Website

Thu muc:

`/Users/apple/Downloads/website phúc sang`

Website hien la HTML/CSS/JavaScript tinh:

- Co 43 san pham, anh tham chieu day du.
- Gia, ton kho, size het hang va khuyen mai dang duoc tao bang cong thuc gia trong `products-data.js`.
- Ca 43 san pham con thieu chat lieu va xuat xu.
- Gio hang, tai khoan, don hang va admin dang luu bang `localStorage`.
- Mat khau khach hang dang luu dang van ban thuong trong trinh duyet.
- Ma admin `2026` nam truc tiep trong `admin.js`.
- Form lien he va newsletter chi hien thong bao thanh cong, khong gui du lieu.
- Du an nang khoang 2.6 GB; tai nguyen duoc catalog tham chieu khoang 673 MB.
- Chua co Git, backend, quy trinh deploy va test tu dong.

### 2.2 App quan tri

Thu muc:

`/Users/apple/phucsang app/QU-N-TR-C-A-H-NG`

App dang dung:

- React 19 + TypeScript + Vite.
- Express.js + Node.js.
- Supabase/PostgreSQL.
- Supabase Auth, Realtime va Storage.
- Hang doi offline bang IndexedDB.
- Cloudflare Tunnel.
- Deploy Express app len iMac `192.168.1.3`.
- PostgreSQL tren iMac, cong noi bo `5432`.
- Supabase API noi bo tai `http://192.168.1.3:8000`.
- Domain ben ngoai dang cau hinh `https://app.phucsang.com.vn`.

Bang co san lien quan:

- `pos_products`
- `pos_orders`
- `pos_customers`
- `inventory_transactions`
- `audit_logs`
- `categories`
- `promotions`
- `system_configs`

App da co API bao ve bang Supabase JWT hoac internal API key. Khong duoc dua service-role key hoac internal API key sang code website.

## 3. Kien truc duoc thong nhat

```text
Khach hang
    |
    v
Website phucsang.com.vn
    |
    | HTTPS Store API
    v
Express server tren iMac
    |
    v
Supabase self-host tren iMac
    |
    +-- PostgreSQL
    +-- Auth
    +-- Realtime
    +-- Storage
    |
    v
App quan tri cua hang
```

Nguyen tac:

1. Website khong ket noi truc tiep PostgreSQL.
2. Website khong duoc so huu service-role key.
3. Moi lenh dat hang phai di qua Store API.
4. App la nguon du lieu chinh cho SKU, gia, ton kho va van hanh.
5. Dashboard website chi bo sung du lieu trung bay.
6. Tat ca don website phai duoc danh dau `channel = 'website'`.

## 4. Phan chia trach nhiem

### 4.1 App quan tri la nguon du lieu chinh

App quan ly:

- SKU va barcode.
- Ten noi bo cua hang hoa.
- Gia von.
- Gia ban chuan.
- Ton kho theo tung SKU/size/mau.
- Nhap, xuat, kiem va dieu chinh kho.
- Nha cung cap.
- Khach hang.
- Don hang va trang thai van hanh.
- Thanh toan, doanh thu va gia von.
- Dong goi, van don, giao hang, doi tra va hoan tien.
- Bao cao va audit log.

### 4.2 Dashboard website quan ly trung bay

Dashboard website quan ly:

- San pham nao duoc xuat ban.
- Ten thuong mai tren website.
- Slug URL.
- Mo ta ngan va mo ta chi tiet.
- Anh dai dien, gallery va video da toi uu.
- Chat lieu, xuat xu va huong dan bao quan.
- Bang chon size.
- SEO title, SEO description va Open Graph.
- Thu tu hien thi.
- San pham noi bat, moi, ban chay.
- Bo suu tap.
- Banner trang chu.
- Bai viet, chinh sach va FAQ.
- Lien ket Facebook, Shopee, TikTok va Zalo.
- Gia khuyen mai rieng cho website neu duoc phep.
- Form lien he va danh sach newsletter.

Dashboard website khong duoc sua truc tiep:

- Gia von.
- Ton kho.
- Lich su nhap/xuat.
- Bao cao tai chinh.
- Trang thai van don.

### 4.3 Website cho khach

Website chi thuc hien:

- Doc danh sach san pham da xuat ban.
- Xem gia ban va ton kha dung.
- Tim kiem, loc va xem chi tiet.
- Them gio hang.
- Tao don.
- Tra cuu don bang ma don va so dien thoai.
- Gui lien he.
- Dang ky newsletter.
- Dang nhap khach hang neu giai doan sau can.

## 5. Mo hinh san pham

### 5.1 Nguon du lieu

Khong tao hai bo san pham doc lap.

Quy trinh dung:

1. Tao hang hoa va cac bien the trong app.
2. Moi size/mau co mot SKU trong `pos_products`.
3. Dashboard website chon cac SKU can ban online.
4. Dashboard bo sung thong tin trung bay.
5. Website lay gia va ton kho hien tai tu app/database.

### 5.2 Lien ket SKU

Moi bien the website phai lien ket bang:

- `pos_product_id` la khoa chinh.
- `sku` la gia tri doi chieu va tim kiem.

Khong chi lien ket bang ten san pham vi ten co the thay doi.

### 5.3 Bang can bo sung

#### `store_products`

Mot dong dai dien cho mot san pham trung bay.

Cot de nghi:

```text
id UUID PRIMARY KEY
name TEXT NOT NULL
slug TEXT UNIQUE NOT NULL
short_description TEXT
description TEXT
material TEXT
sole_material TEXT
origin TEXT
care_instructions TEXT
size_guide JSONB
cover_image_url TEXT
gallery JSONB
video_url TEXT
seo_title TEXT
seo_description TEXT
og_image_url TEXT
is_published BOOLEAN DEFAULT false
is_featured BOOLEAN DEFAULT false
is_new BOOLEAN DEFAULT false
is_best_seller BOOLEAN DEFAULT false
display_order INTEGER DEFAULT 0
collection_ids JSONB DEFAULT '[]'
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

#### `store_product_variants`

Lien ket san pham trung bay voi SKU trong app.

```text
id UUID PRIMARY KEY
store_product_id UUID REFERENCES store_products(id)
pos_product_id UUID REFERENCES pos_products(id)
sku TEXT NOT NULL
size TEXT
color_name TEXT
color_hex TEXT
website_price_override NUMERIC
compare_at_price NUMERIC
is_published BOOLEAN DEFAULT true
display_order INTEGER DEFAULT 0
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

Quy tac gia:

1. Neu `website_price_override` co gia tri, website dung gia nay.
2. Neu khong, website dung `pos_products.sale_price`.
3. `import_price` tuyet doi khong duoc tra cho website.
4. Khuyen mai phai co ngay bat dau, ngay ket thuc va trang thai neu sau nay can mo rong.

### 5.4 Ton kho

Ton kho that nam trong `pos_products.stock`.

Website chi hien:

- Con hang.
- Sap het.
- Het hang.
- Hoac so luong gioi han neu can.

Khong nen cong khai toan bo so luong kho that.

Can them `inventory_reservations` de giu hang tam:

```text
id UUID PRIMARY KEY
order_id UUID
pos_product_id UUID
quantity INTEGER
status TEXT
expires_at TIMESTAMPTZ
created_at TIMESTAMPTZ
```

Trang thai de nghi:

- `active`
- `confirmed`
- `released`
- `expired`

## 6. Mo hinh don hang va van don

### 6.1 Dung lai `pos_orders`

Don website nen ghi vao `pos_orders` de app nhan ngay.

Gia tri bat buoc:

```text
channel = 'website'
channel_name = 'Website PHUC SANG'
status = 'pending'
payment_method = 'cod' hoac 'bank'
```

Khong ghi don website la `completed` ngay khi khach bam Dat hang.

### 6.2 Thong tin giao hang

Nen tao bang `store_order_addresses`:

```text
id UUID PRIMARY KEY
order_id UUID REFERENCES pos_orders(id)
recipient_name TEXT
phone TEXT
email TEXT
address_line TEXT
ward TEXT
district TEXT
province TEXT
postal_code TEXT
customer_note TEXT
created_at TIMESTAMPTZ
```

### 6.3 Trang thai don

De nghi chuan hoa:

- `pending`: website vua ghi nhan.
- `confirmed`: nhan vien da xac nhan.
- `packing`: dang dong goi.
- `ready_to_ship`: san sang giao.
- `shipping`: da giao don vi van chuyen.
- `completed`: giao thanh cong.
- `cancelled`: da huy.
- `returned`: da hoan/tra.

### 6.4 Van don

Van don xu ly trong app, khong xu ly o dashboard website.

Can bo sung bang `shipments` neu app chua co:

```text
id UUID PRIMARY KEY
order_id UUID REFERENCES pos_orders(id)
provider TEXT
tracking_code TEXT
shipping_fee NUMERIC DEFAULT 0
cod_amount NUMERIC DEFAULT 0
status TEXT
label_url TEXT
provider_payload JSONB
shipped_at TIMESTAMPTZ
delivered_at TIMESTAMPTZ
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

App thuc hien:

1. Xac nhan don.
2. Kiem tra hoac giu ton kho.
3. Tao van don.
4. Luu ma van don.
5. Cap nhat trang thai.
6. Website doc trang thai de khach tra cuu.

## 7. API can phat trien trong code app

Nen tao file route rieng, vi du:

`routes/store.ts`

### 7.1 API cong khai chi doc

```text
GET /api/store/products
GET /api/store/products/:slug
GET /api/store/collections
GET /api/store/settings
```

Chi tra cac truong cong khai. Khong tra:

- `import_price`
- thong tin nha cung cap
- vi tri kho noi bo
- audit log
- du lieu tai chinh

### 7.2 API tao don

```text
POST /api/store/orders
```

Payload du kien:

```json
{
  "customer": {
    "name": "Nguyen Van A",
    "phone": "0912345678",
    "email": "email@example.com"
  },
  "shippingAddress": {
    "addressLine": "So nha, duong",
    "ward": "Phuong/Xa",
    "district": "Quan/Huyen",
    "province": "Tinh/Thanh"
  },
  "paymentMethod": "cod",
  "note": "",
  "items": [
    {
      "posProductId": "uuid",
      "quantity": 1
    }
  ]
}
```

Server phai tu:

1. Doc lai san pham tu database.
2. Kiem tra san pham dang duoc xuat ban.
3. Kiem tra gia tren server.
4. Kiem tra ton kho.
5. Tinh lai tong tien.
6. Tao hoac cap nhat khach hang.
7. Tao ma don duy nhat.
8. Tao `pos_orders`.
9. Tao dia chi giao hang.
10. Tao reservation hoac tru kho theo quy tac.
11. Ghi audit log.
12. Gui thong bao cho nhan vien.

Khong tin gia, ten san pham hoac tong tien do browser gui len.

### 7.3 API tra cuu don

```text
POST /api/store/orders/lookup
```

Yeu cau:

- Ma don.
- So dien thoai.

Chi tra:

- Ma don.
- Thoi gian dat.
- Danh sach san pham rut gon.
- Tong tien.
- Trang thai don.
- Ma van don va don vi giao hang neu co.

Khong cho phep tim don chi bang ma don.

### 7.4 API lien he

```text
POST /api/store/contacts
POST /api/store/newsletter
```

Bang:

`store_contacts`

```text
id UUID PRIMARY KEY
name TEXT
phone TEXT
email TEXT
topic TEXT
order_code TEXT
message TEXT
status TEXT DEFAULT 'new'
created_at TIMESTAMPTZ
```

`newsletter_subscribers`

```text
id UUID PRIMARY KEY
email TEXT UNIQUE
status TEXT DEFAULT 'active'
source TEXT DEFAULT 'website'
subscribed_at TIMESTAMPTZ
unsubscribed_at TIMESTAMPTZ
```

### 7.5 API dashboard website

API nay phai yeu cau Supabase Auth va role `admin` hoac `content_manager`.

```text
GET    /api/admin/store/products
POST   /api/admin/store/products
PATCH  /api/admin/store/products/:id
DELETE /api/admin/store/products/:id
POST   /api/admin/store/products/:id/publish
POST   /api/admin/store/media
GET    /api/admin/store/contacts
PATCH  /api/admin/store/contacts/:id
GET    /api/admin/store/newsletter
```

## 8. Giao dich dat hang va ton kho

Day la phan rui ro cao nhat.

Can viet PostgreSQL function/RPC, vi du:

`create_store_order`

RPC phai chay trong mot transaction:

1. Khoa cac dong `pos_products` lien quan.
2. Kiem tra ton kha dung.
3. Kiem tra gia.
4. Tao don.
5. Tao cac reservation.
6. Tra ve ma don.

Khong nen:

- Doc ton kho o mot request.
- Sau do tao don o request khac.
- Tru ton bang JavaScript client.

Cach nay co the gay ban vuot ton khi hai khach dat cung luc.

Quyet dinh quy tac ton kho truoc khi lam:

### Lua chon khuyen nghi

- Khi dat don: tao reservation trong 30-60 phut.
- Khi nhan vien xac nhan: reservation thanh `confirmed` va tru ton chinh thuc.
- Khi huy/het han: giai phong reservation.

Neu can don gian giai doan dau:

- Tru ton ngay khi tao don.
- Khi huy don thi app hoan ton.

## 9. Bao mat

### 9.1 Bat buoc

- Website khong chua Supabase service-role key.
- Website khong chua internal API key.
- Khong cho browser ghi truc tiep vao `pos_products` hay `pos_orders`.
- Store API dung service-role o server iMac.
- Dashboard dung Supabase Auth.
- Kiem tra role o backend, khong chi an nut tren frontend.
- Bat RLS cho bang `store_*`.
- An `import_price` va du lieu noi bo.
- Validate payload bang schema.
- Rate limit API dat hang, dang nhap, lien he va tra cuu.
- Them CAPTCHA/Turnstile cho form cong khai.
- Chuan hoa so dien thoai.
- Escape/sanitize noi dung do nguoi dung nhap.
- CORS chi cho domain can thiet.
- Ghi audit cho thay doi san pham va trang thai don.

### 9.2 Sua diem hien tai trong app

`pos_products` dang co policy cho phep anon doc. Dieu nay co nguy co lam lo `import_price` neu client query truc tiep.

Can mot trong hai cach:

1. Thu hoi anon SELECT truc tiep va bat buoc doc qua Store API.
2. Tao view cong khai chi chua truong an toan.

Khuyen nghi cach 1 de de kiem soat.

### 9.3 Tai khoan khach

Giai doan dau khong bat buoc co tai khoan khach. Cho phep dat hang guest va tra cuu bang ma don + so dien thoai.

Giai doan sau neu can:

- Dung Supabase Auth OTP qua email/so dien thoai.
- Khong tu luu password trong bang hoac localStorage.
- Lien ket user Auth voi `pos_customers`.

## 10. Luu tru anh tren iMac

Co hai phuong an:

### Phuong an A - Supabase Storage self-host

Khuyen nghi neu he thong Storage tren iMac da hoat dong on dinh.

- Dashboard upload anh vao bucket `store-media`.
- Database luu URL/path.
- Tao thumbnail va anh WebP/AVIF.
- Public read cho anh san pham.
- Admin-only upload/update/delete.

### Phuong an B - Thu muc file do Express phuc vu

- Luu file vao thu muc rieng tren iMac.
- Express phuc vu duong dan `/media/store/...`.
- Can tu quan ly quyen, ten file, backup va xoa file rac.

Phuong an A phu hop hon voi kien truc app hien tai.

Khong upload 2.6 GB thu muc `assets` hien tai len production. Can:

- Chon anh that su dung.
- Resize theo cac kich thuoc co dinh.
- Chuyen sang WebP/AVIF.
- Nen video.
- Lazy-load.
- Xoa `.DS_Store`, file tam va anh trung.
- Tach anh goc khoi thu muc deploy.

## 11. Backup va do tin cay cua iMac

Vi iMac la may chu, can:

- iMac luon bat.
- Tat che do sleep lam ngat server.
- Docker va Cloudflare Tunnel tu dong khoi dong.
- Express app chay bang LaunchAgent/launchd.
- UPS neu khu vuc hay mat dien.
- PostgreSQL backup hang ngay.
- Backup file Storage hang ngay.
- Luu them mot ban tren o cung ngoai hoac may/cloud khac.
- Kiem tra khoi phuc backup dinh ky.
- Theo doi dung luong dia.
- Health check cho Express, Supabase va tunnel.

Lich backup de nghi:

- Backup database moi dem.
- Giu 7 ban hang ngay.
- Giu 4 ban hang tuan.
- Giu 6 ban hang thang.
- Ma hoa backup neu dua len cloud.

Khong coi RAID hoac Time Machine la phuong an backup database duy nhat.

## 12. Thay doi can lam trong code app

Thu muc:

`/Users/apple/phucsang app/QU-N-TR-C-A-H-NG`

Danh sach cong viec:

1. Tao migration SQL cho cac bang `store_*`, `shipments` va `inventory_reservations`.
2. Tao index va unique constraint.
3. Tao RLS policies.
4. Thu hoi quyen anon khong an toan tren bang POS.
5. Tao PostgreSQL RPC dat hang atomic.
6. Tao `routes/store.ts`.
7. Mount route trong `server.ts`.
8. Them CORS cho domain website chinh thuc.
9. Them rate limiter rieng cho Store API.
10. Them validation schema cho moi endpoint.
11. Them audit log.
12. Them notification khi co don website.
13. Sua app de hien channel `Website`.
14. Them trang/bo loc don website.
15. Them cac trang thai `pending`, `confirmed`, `packing`, `ready_to_ship`, `shipping`, `completed`, `cancelled`, `returned`.
16. Them giao dien tao va cap nhat van don.
17. Them dashboard noi dung website hoac tao module Store Content trong app.
18. Them upload anh vao bucket `store-media`.
19. Them Realtime cho san pham/don website neu can.
20. Viet test API, permission va transaction ton kho.

Luu y: app hien co nhieu thay doi Git chua commit. Truoc khi sua phai:

- Doc ky `git status`.
- Khong revert thay doi cua nguoi dung.
- Tao branch hoac commit checkpoint neu nguoi dung cho phep.

## 13. Thay doi can lam trong code website

Thu muc:

`/Users/apple/Downloads/website phúc sang`

Danh sach cong viec:

1. Tao module cau hinh API base URL.
2. Tao `store-api.js` de goi Store API.
3. Thay du lieu gia trong `products-data.js` bang API.
4. Trong giai doan chuyen doi, co the giu data local lam fallback chi doc.
5. Sua trang danh sach san pham lay data tu `GET /api/store/products`.
6. Sua trang chi tiet lay data theo slug.
7. Gio hang co the tam luu localStorage, nhung gia phai duoc server tinh lai khi dat.
8. Sua `checkout.js` goi `POST /api/store/orders`.
9. Xoa viec luu don vao `phuc-sang-orders-v1`.
10. Sua tra cuu don goi API.
11. Bo admin local voi PIN `2026`.
12. Bo tai khoan/password tu luu trong localStorage.
13. Sua form lien he goi API.
14. Sua newsletter goi API.
15. Them trang thai loading, empty va error.
16. Xu ly API timeout va server iMac mat ket noi.
17. Them thong bao ro rang, khong hien "thanh cong" neu server chua ghi du lieu.
18. Them Turnstile/CAPTCHA.
19. Them SEO dong cho trang san pham.
20. Toi uu anh va dung luong deploy.
21. Them `robots.txt`, `sitemap.xml`, canonical, Open Graph va Product JSON-LD.
22. Khoi tao Git va quy trinh deploy sau khi duoc phep.

## 14. Dashboard website nen nam o dau

Co hai lua chon:

### Lua chon khuyen nghi

Them module "Website" vao app quan tri hien tai.

Dieu nay khong co nghia la dua toan bo source code website vao trong app.

Hai du an van tach rieng:

```text
App quan tri
    |
    +-- Kho, ban hang, bao cao
    +-- Don hang va van don
    +-- Module Quan ly Website
          +-- Noi dung san pham
          +-- Banner
          +-- SEO
          +-- Bo suu tap
          +-- Lien he/newsletter

Website rieng
    |
    +-- Giao dien cong khai cho khach
    +-- Doc san pham/noi dung qua Store API
    +-- Gui don hang qua Store API
```

Website tiep tuc nam trong repo:

`/Users/apple/Downloads/website phúc sang`

App tiep tuc nam trong repo:

`/Users/apple/phucsang app/QU-N-TR-C-A-H-NG`

Chi co dashboard quan ly noi dung website duoc them vao giao dien app. Website van la mot ung dung/doc lap, co domain, quy trinh deploy va giao dien rieng.

Uu diem:

- Mot noi dang nhap.
- Dung lai Supabase Auth va role.
- Nhan vien khong phai mo hai dashboard.
- De chon SKU tu `pos_products`.
- De xem don website va noi dung cung mot he thong.

Module co cac muc:

- Tong quan website: so san pham da xuat ban, don moi, lien he moi.
- San pham website.
- Bo suu tap.
- Banner.
- Bai viet/chinh sach.
- Lien he.
- Newsletter.
- Cau hinh website.
- Xem truoc va xuat ban.

Phan quyen de nghi:

- `admin`: toan quyen website va cau hinh.
- `content_manager`: sua noi dung, anh, SEO va xuat ban.
- `order_staff`: xem/xu ly don va van don, khong sua noi dung website.
- `viewer`: chi xem.

### Lua chon khac

Tao dashboard rieng trong repo website.

Chi nen chon neu:

- Co doi content tach biet.
- Can deploy dashboard doc lap.
- App hien tai qua lon hoac kho mo rong.

Du chon cach nao, dashboard van phai goi API app va dung chung database.

## 15. Domain va subdomain

### 15.1 Nguyen tac

Mot hostname cu the, vi du `phucsang.com.vn`, khong nen dong thoi tro doc lap den ca website va app quan tri.

Tuy nhien, cung mot ten mien co the chia thanh nhieu subdomain, moi subdomain tro den mot dich vu rieng.

### 15.2 Cau hinh khuyen nghi

```text
phucsang.com.vn
www.phucsang.com.vn
    -> Website ban hang cong khai

app.phucsang.com.vn
    -> App quan tri noi bo

api.phucsang.com.vn
    -> Express Store API tren iMac

Supabase/PostgreSQL
    -> Khong cong khai bang domain database cho khach
    -> Chi app va backend API truy cap
```

Neu `phucsang.com.vn` hien dang gan cho app, can:

1. Tao DNS/subdomain `app.phucsang.com.vn`.
2. Chuyen Cloudflare Tunnel route cua app sang `app.phucsang.com.vn`.
3. Cap nhat allowed origins, redirect URL va Supabase Auth URL.
4. Kiem tra dang nhap, cookie, CORS va Realtime tren domain app moi.
5. Sau khi app chay on dinh tai subdomain, tro `phucsang.com.vn` va `www.phucsang.com.vn` den website.
6. Tao `api.phucsang.com.vn` cho Store API, hoac proxy `/api/store/*` qua cung domain website.
7. Tao redirect tu dia chi app cu sang `app.phucsang.com.vn` neu can.

### 15.3 Phuong an API

Phuong an ro rang:

```text
Website: https://phucsang.com.vn
API:     https://api.phucsang.com.vn/api/store/*
App:     https://app.phucsang.com.vn
```

Phuong an giam CORS:

```text
Website: https://phucsang.com.vn
API:     https://phucsang.com.vn/api/store/*
App:     https://app.phucsang.com.vn
```

Voi phuong an thu hai, Cloudflare proxy cac request `/api/store/*` ve Express server tren iMac, con file giao dien website co the duoc phuc vu tu hosting khac.

Khuyen nghi ban dau: dung `api.phucsang.com.vn` de tach ro dich vu va de debug. Sau khi he thong on dinh co the proxy cung domain neu can.

### 15.4 Bao mat domain

- Khong tao `db.phucsang.com.vn` cong khai neu khong that su can.
- Khong mo truc tiep PostgreSQL cong `5432` ra Internet.
- Cloudflare Tunnel chi route HTTP/HTTPS den Express/Supabase gateway can thiet.
- Dashboard app phai yeu cau dang nhap.
- Website chi goi cac endpoint `/api/store/*` duoc thiet ke cho khach.
- Them `phucsang.com.vn`, `www.phucsang.com.vn` va `app.phucsang.com.vn` vao CORS dung muc dich; khong dung wildcard cho endpoint nhay cam.

## 16. Lo trinh trien khai

### Giai doan 0 - Chot du lieu that

- Xac nhan danh sach 43 san pham.
- Xac nhan moi SKU/size/mau trong app.
- Xac nhan gia ban.
- Xac nhan ton kho.
- Xac nhan tai khoan ngan hang.
- Xac nhan lien ket mang xa hoi.
- Xac nhan nha van chuyen.
- Xac nhan quy tac giu/tru ton.

Dieu kien hoan thanh:

- Khong con gia, ton kho hoac tai khoan ngan hang mau.

### Giai doan 1 - Database va API doc

- Tao bang `store_products` va `store_product_variants`.
- Tao Store API chi doc.
- Import/lien ket 43 san pham.
- Website doc danh sach va chi tiet tu API.

Dieu kien hoan thanh:

- Sua gia/ton trong app, website phan anh dung.
- Website khong thay gia von.

### Giai doan 2 - Dat hang

- Tao dia chi don.
- Tao RPC atomic.
- Tao API dat hang.
- Website checkout goi API.
- Don xuat hien trong app voi channel Website.

Dieu kien hoan thanh:

- Dat mot don test tu dien thoai.
- App nhan dung san pham, gia, so luong va dia chi.
- Khong the sua gia bang DevTools de dat gia thap.

### Giai doan 3 - Van hanh va van don

- Bo sung workflow trang thai.
- Tao shipment.
- App cap nhat van don.
- Website tra cuu don.
- Gui thong bao.

Dieu kien hoan thanh:

- Khach xem duoc trang thai moi nhat.
- Don huy/tra cap nhat ton kho dung.

### Giai doan 4 - Dashboard noi dung

- Them module Website vao app.
- Quan ly mo ta, anh, SEO, publish va thu tu.
- Quan ly lien he/newsletter.

Dieu kien hoan thanh:

- Nguoi quan tri khong can sua file JavaScript de thay noi dung.

### Giai doan 5 - Production hardening

- Toi uu media.
- CAPTCHA va rate limit.
- Backup.
- Monitoring.
- Test bao mat.
- Test tai.
- SEO.
- Deploy chinh thuc.

## 17. Test bat buoc

### San pham

- Chi san pham published moi hien.
- Bien the het hang khong dat duoc.
- Gia override dung thu tu uu tien.
- API khong lo gia von.
- Slug khong trung.

### Don hang

- Khong dat gio hang rong.
- Khong dat so luong am/0.
- Khong dat SKU khong published.
- Khong dat vuot ton.
- Server tu tinh lai gia.
- Hai request dong thoi khong lam ton kho am.
- Retry request khong tao hai don.
- Ma don la duy nhat.

### Bao mat

- Anon khong ghi truc tiep bang POS.
- Khach khong doc duoc don cua nguoi khac.
- Dashboard yeu cau role.
- Service-role khong xuat hien trong file frontend.
- CORS chan origin la.
- Rate limit hoat dong.

### Van hanh

- Don website hien trong app.
- Doi trang thai app cap nhat tra cuu website.
- Huy don giai phong/hoan ton.
- Mat mang khong hien dat hang thanh cong gia.
- iMac khoi dong lai thi service tu chay.
- Backup co the restore.
- Domain chinh mo website, khong mo nham app.
- `app.phucsang.com.vn` mo dung app va dang nhap duoc.
- Store API chi chap nhan cac origin duoc phep.
- Chuyen domain khong lam hong Supabase Auth callback, cookie hoac Realtime.

## 18. Quyet dinh da chot - KHONG hoi lai

Cap nhat: 16/06/2026. Tat ca cac quyet dinh duoi day da duoc nguoi dung xac nhan.

1. **Ton kho**: Tru ton NGAY khi dat don. Cong lai NGAY khi huy. KHONG dung reservation. Bo bang `inventory_reservations`.
2. **Reservation**: Khong ap dung (chon Cach A - tru ton ngay).
3. **Het hang**: Nut "Mua ngay" chuyen thanh "Dat truoc". Dat truoc CHI thu thong tin (ten, SDT, san pham, size), khong tao don that. Nhan vien bao khach khi co hang lai. Bang: `store_preorder_requests`.
4. **Gia website**: Co the khac gia tai cua hang. Dung `website_price_override` trong `store_product_variants`.
5. **Chuyen khoan**: Nhan vien xac nhan tay. Tich hop VietQR/Casso/SePay sau khi on dinh.
6. **Van chuyen**: Dung SPX Shopee, nhap tay ma van don. Xem xet GHN/GHTK khi can auto.
7. **Dashboard Website**: Module quan ly website (anh, mo ta, SEO, xuat ban) nam TRONG app quan tri. Website va app van la 2 codebase rieng.
8. **Tai khoan khach**: Guest checkout, dang ky tuy chon. Khong bat buoc.
9. **Thong bao don**: Co, nhung chua lam giai doan dau. Se them o giai doan 3 (Zalo OA).
10. **Domain Store API**: `api.phucsang.com.vn` (chot truoc khi deploy website).
11. **Chuyen domain app**: Sau khi tich hop va test on dinh moi chuyen sang `app.phucsang.com.vn`.
12. **Host website**: PA Viet Nam (shared hosting, phu hop vi website la file tinh HTML/JS).

## 18.1 SQL Migration - Bang can tao

Chay toan bo SQL nay tren Supabase dashboard. KHONG co bang `inventory_reservations`.

```sql
-- 1. San pham trung bay website
CREATE TABLE store_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  short_description TEXT,
  description TEXT,
  material TEXT,
  sole_material TEXT,
  origin TEXT,
  care_instructions TEXT,
  size_guide JSONB,
  cover_image_url TEXT,
  gallery JSONB DEFAULT '[]',
  video_url TEXT,
  seo_title TEXT,
  seo_description TEXT,
  og_image_url TEXT,
  is_published BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  is_new BOOLEAN DEFAULT false,
  is_best_seller BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Lien ket SKU voi san pham trung bay
CREATE TABLE store_product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_product_id UUID NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
  pos_product_id UUID NOT NULL REFERENCES pos_products(id),
  sku TEXT NOT NULL,
  size TEXT,
  color_name TEXT,
  color_hex TEXT,
  website_price_override NUMERIC,
  compare_at_price NUMERIC,
  is_published BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(pos_product_id)
);

-- 3. Bo suu tap (thay JSONB collection_ids trong store_products)
CREATE TABLE store_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  is_published BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE store_product_collections (
  store_product_id UUID NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
  collection_id UUID NOT NULL REFERENCES store_collections(id) ON DELETE CASCADE,
  PRIMARY KEY (store_product_id, collection_id)
);

-- 4. Dia chi giao hang theo don
CREATE TABLE store_order_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES pos_orders(id) ON DELETE CASCADE,
  recipient_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  address_line TEXT NOT NULL,
  ward TEXT,
  district TEXT NOT NULL,
  province TEXT NOT NULL,
  postal_code TEXT,
  customer_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Van don
CREATE TABLE shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES pos_orders(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL DEFAULT 'SPX',
  tracking_code TEXT,
  shipping_fee NUMERIC DEFAULT 0,
  cod_amount NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  label_url TEXT,
  provider_payload JSONB,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Dat truoc khi het hang (CHI thu thong tin, khong tao don)
CREATE TABLE store_preorder_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  pos_product_id UUID REFERENCES pos_products(id),
  sku TEXT,
  size TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'waiting',
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- status: 'waiting' | 'notified' | 'converted' | 'cancelled'

-- 7. Form lien he
CREATE TABLE store_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  phone TEXT,
  email TEXT,
  topic TEXT,
  order_code TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT now()
);
-- status: 'new' | 'in_progress' | 'resolved'

-- 8. Newsletter
CREATE TABLE newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  source TEXT DEFAULT 'website',
  subscribed_at TIMESTAMPTZ DEFAULT now(),
  unsubscribed_at TIMESTAMPTZ
);
-- status: 'active' | 'unsubscribed'

-- Index
CREATE INDEX ON store_products(slug);
CREATE INDEX ON store_products(is_published, display_order);
CREATE INDEX ON store_product_variants(store_product_id);
CREATE INDEX ON store_product_variants(pos_product_id);
CREATE INDEX ON store_product_variants(sku);
CREATE INDEX ON store_order_addresses(order_id);
CREATE INDEX ON shipments(order_id);
CREATE INDEX ON shipments(tracking_code);
CREATE INDEX ON store_preorder_requests(status, created_at DESC);
CREATE INDEX ON store_preorder_requests(phone);
CREATE INDEX ON store_contacts(status, created_at DESC);
CREATE INDEX ON newsletter_subscribers(email);

-- RLS
ALTER TABLE store_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_product_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_order_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_preorder_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Anon chi doc san pham da xuat ban (qua Store API, khong truc tiep)
-- Tat ca cac policy ghi deu yeu cau authenticated + role service_role
-- Chi Store API (service-role) duoc ghi du lieu
CREATE POLICY "service_role_all" ON store_products TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON store_product_variants TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON store_collections TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON store_product_collections TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON store_order_addresses TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON shipments TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON store_preorder_requests TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON store_contacts TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON newsletter_subscribers TO service_role USING (true) WITH CHECK (true);
```

## 19. Thu tu file nen doc khi tiep tuc

### App

1. `/Users/apple/phucsang app/QU-N-TR-C-A-H-NG/README.md`
2. `/Users/apple/phucsang app/QU-N-TR-C-A-H-NG/server.ts`
3. `/Users/apple/phucsang app/QU-N-TR-C-A-H-NG/routes/data.ts`
4. `/Users/apple/phucsang app/QU-N-TR-C-A-H-NG/services/supabase.ts`
5. `/Users/apple/phucsang app/QU-N-TR-C-A-H-NG/services/apiService.ts`
6. `/Users/apple/phucsang app/QU-N-TR-C-A-H-NG/services/posOrderService.ts`
7. `/Users/apple/phucsang app/QU-N-TR-C-A-H-NG/hooks/useRealtimeSync.ts`
8. `/Users/apple/phucsang app/QU-N-TR-C-A-H-NG/hooks/useOfflineSync.ts`
9. `/Users/apple/phucsang app/QU-N-TR-C-A-H-NG/supabase_setup.sql`
10. `/Users/apple/phucsang app/QU-N-TR-C-A-H-NG/supabase_migrations/`

### Website

1. `/Users/apple/Downloads/website phúc sang/products-data.js`
2. `/Users/apple/Downloads/website phúc sang/all-products.js`
3. `/Users/apple/Downloads/website phúc sang/product-detail.js`
4. `/Users/apple/Downloads/website phúc sang/cart-store.js`
5. `/Users/apple/Downloads/website phúc sang/checkout.js`
6. `/Users/apple/Downloads/website phúc sang/account-store.js`
7. `/Users/apple/Downloads/website phúc sang/admin.js`
8. `/Users/apple/Downloads/website phúc sang/contact.js`

## 20. Viec nen lam dau tien o phien tiep theo

Khong sua website truoc.

Bat dau trong code app:

1. Kiem tra Git va cac thay doi chua commit.
2. Doc schema `pos_products` va `pos_orders` thuc te.
3. Chay SQL o muc 18.1 tren Supabase dashboard (nguoi dung tu chay, can quyen service_role). Cac bang can tao:
   - `store_products`
   - `store_product_variants`
   - `store_collections` + `store_product_collections`
   - `store_order_addresses`
   - `store_contacts`
   - `newsletter_subscribers`
   - `store_preorder_requests`
   - `shipments`
   - KHONG tao `inventory_reservations` (da chot khong dung reservation)
4. Tao RLS va index.
5. Tao `routes/store.ts` voi hai API read-only dau tien.
6. Viet test de dam bao khong lo `import_price`.
7. Sau khi API doc on dinh moi ket noi website.
8. Lap ke hoach chuyen app tu domain chinh sang `app.phucsang.com.vn` truoc khi dua website len domain chinh.

## 21. Prompt de tiep tuc bang tai khoan khac

Dung prompt sau:

```text
Doc file nay truoc khi lam bat cu thu gi:
/Users/apple/phucsang app/QU-N-TR-C-A-H-NG/KE-HOACH-DATABASE-VA-TICH-HOP-APP.md

Day la tai lieu tich hop website PHUC SANG voi app quan tri va Supabase/PostgreSQL self-host tren iMac.

Code app tai:
/Users/apple/phucsang app/QU-N-TR-C-A-H-NG

Code website tai:
/Users/apple/Downloads/website phuc sang

Cac quyet dinh o muc 18 DA DUOC CHOT ngay 16/06/2026 - khong hoi lai. Tom tat:
- Tru ton NGAY khi dat don, KHONG dung reservation, KHONG co bang inventory_reservations
- Het hang: chi thu thong tin dat truoc vao store_preorder_requests, khong tao don that
- SPX nhap tay ma van don, chua tich hop API van chuyen
- Dashboard quan ly website nam TRONG giao dien app (2 codebase van rieng)
- Host website tren PA Viet Nam (file tinh)
- SQL day du cho tat ca bang can tao nam o muc 18.1

Tiep tuc theo muc 20.

Bat buoc truoc khi sua bat cu gi:
- Chay git status, doc ky output
- Khong revert thay doi cua nguoi dung
- Khong dua service-role key, API key hoac password vao frontend hoac tai lieu
- Website van la du an rieng - chi them module Quan ly Website vao giao dien app
- Domain chinh danh cho website, app se chuyen sang app.phucsang.com.vn sau khi test on dinh

Buoc dau tien: doc schema thuc te pos_products va pos_orders. Sau do yeu cau nguoi dung tu chay SQL o muc 18.1 tren Supabase dashboard (AI khong co quyen truc tiep). Sau khi bang ton tai, tao routes/store.ts voi 2 API doc dau tien va dam bao khong lo import_price.
```

## 22. Ket luan

Huong trien khai duoc chon:

- Dung Supabase/PostgreSQL self-host hien co tren iMac.
- App la he thong quan ly van hanh va nguon du lieu chinh.
- Website la kenh ban hang.
- Website va app van la hai du an code rieng.
- Chi module Dashboard Website duoc them vao app.
- Noi dung trung bay luu trong bang `store_*`.
- SKU, gia va ton kho lien ket voi `pos_products`.
- Don website ghi vao `pos_orders` voi channel Website.
- Van don xu ly trong app va dong bo trang thai ve website.
- Tat ca thao tac ghi quan trong di qua Express Store API.
- `phucsang.com.vn` va `www.phucsang.com.vn` danh cho website.
- `app.phucsang.com.vn` danh cho app quan tri.
- `api.phucsang.com.vn` danh cho Store API trong giai doan dau.
