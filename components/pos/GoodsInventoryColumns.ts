// Tăng version khi thêm/xóa cột để user thấy cột mới tự động
export const COLUMN_PREFS_VERSION = 'v4';
export const COLUMN_PREFS_KEY = `goods_visible_columns_${COLUMN_PREFS_VERSION}`;

export const ALL_COLUMNS: { key: string; label: string; defaultVisible: boolean }[] = [
  { key: 'image',          label: 'Hình ảnh',               defaultVisible: true  },
  { key: 'category',       label: 'Nhóm hàng',              defaultVisible: true  },
  { key: 'productType',    label: 'Loại hàng',              defaultVisible: false },
  { key: 'salePrice',      label: 'Giá bán',                defaultVisible: true  },
  { key: 'importPrice',    label: 'Giá vốn',                defaultVisible: true  },
  { key: 'brand',          label: 'Thương hiệu',            defaultVisible: true  },
  { key: 'location',       label: 'Vị trí',                 defaultVisible: true  },
  { key: 'stock',          label: 'Tồn kho',                defaultVisible: true  },
  { key: 'customerOrders', label: 'Khách đặt',              defaultVisible: false },
  { key: 'minStock',       label: 'Định mức tồn ít nhất',   defaultVisible: false },
  { key: 'maxStock',       label: 'Định mức tồn nhiều nhất',defaultVisible: false },
  { key: 'weight',         label: 'Trọng lượng',            defaultVisible: false },
  { key: 'allowPoints',    label: 'Tích điểm',              defaultVisible: false },
  { key: 'directSale',     label: 'Được bán trực tiếp',     defaultVisible: false },
  { key: 'status',         label: 'Trạng thái',             defaultVisible: false },
  { key: 'warranty',       label: 'Bảo hành',               defaultVisible: false },
  { key: 'createdAt',      label: 'Thời gian tạo',          defaultVisible: false },
];

export const DEFAULT_VISIBLE_COLS = ALL_COLUMNS.filter(c => c.defaultVisible).map(c => c.key);
