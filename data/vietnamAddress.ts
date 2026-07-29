// Static province → district mapping (offline-safe)
// Wards are fetched from provinces.open-api.vn API (cached in localStorage)

const VIETNAM_DISTRICTS: Record<string, string[]> = {
  "Thành phố Hà Nội": [
    "Quận Ba Đình","Quận Hoàn Kiếm","Quận Tây Hồ","Quận Long Biên",
    "Quận Cầu Giấy","Quận Đống Đa","Quận Hai Bà Trưng","Quận Hoàng Mai",
    "Quận Thanh Xuân","Quận Nam Từ Liêm","Quận Bắc Từ Liêm","Quận Hà Đông",
    "Thị xã Sơn Tây","Huyện Ba Vì","Huyện Phúc Thọ","Huyện Đan Phượng",
    "Huyện Hoài Đức","Huyện Quốc Oai","Huyện Thạch Thất","Huyện Chương Mỹ",
    "Huyện Thanh Oai","Huyện Thường Tín","Huyện Phú Xuyên","Huyện Ứng Hòa",
    "Huyện Mỹ Đức","Huyện Mê Linh","Huyện Gia Lâm","Huyện Đông Anh","Huyện Sóc Sơn"
  ],
  "Tỉnh Hà Giang": [
    "Thành phố Hà Giang","Huyện Đồng Văn","Huyện Mèo Vạc","Huyện Yên Minh",
    "Huyện Quản Bạ","Huyện Vị Xuyên","Huyện Bắc Mê","Huyện Hoàng Su Phì",
    "Huyện Xín Mần","Huyện Bắc Quang","Huyện Quang Bình"
  ],
  "Tỉnh Cao Bằng": [
    "Thành phố Cao Bằng","Huyện Bảo Lâm","Huyện Bảo Lạc","Huyện Hà Quảng",
    "Huyện Trùng Khánh","Huyện Hạ Lang","Huyện Trà Lĩnh","Huyện Quảng Hòa",
    "Huyện Hòa An","Huyện Nguyên Bình","Huyện Thạch An"
  ],
  "Tỉnh Bắc Kạn": [
    "Thành phố Bắc Kạn","Huyện Pác Nặm","Huyện Ba Bể","Huyện Ngân Sơn",
    "Huyện Bạch Thông","Huyện Chợ Đồn","Huyện Chợ Mới","Huyện Na Rì"
  ],
  "Tỉnh Tuyên Quang": [
    "Thành phố Tuyên Quang","Huyện Lâm Bình","Huyện Na Hang","Huyện Chiêm Hóa",
    "Huyện Hàm Yên","Huyện Yên Sơn","Huyện Sơn Dương"
  ],
  "Tỉnh Lào Cai": [
    "Thành phố Lào Cai","Huyện Bát Xát","Huyện Mường Khương","Huyện Si Ma Cai",
    "Huyện Bắc Hà","Huyện Bảo Thắng","Huyện Bảo Yên","Huyện Sa Pa","Huyện Văn Bàn"
  ],
  "Tỉnh Điện Biên": [
    "Thành phố Điện Biên Phủ","Thị xã Mường Lay","Huyện Điện Biên","Huyện Điện Biên Đông",
    "Huyện Mường Ảng","Huyện Mường Nhé","Huyện Nậm Pồ","Huyện Tủa Chùa","Huyện Tuần Giáo"
  ],
  "Tỉnh Lai Châu": [
    "Thành phố Lai Châu","Huyện Tam Đường","Huyện Mường Tè","Huyện Sìn Hồ",
    "Huyện Phong Thổ","Huyện Than Uyên","Huyện Tân Uyên","Huyện Nậm Nhùn"
  ],
  "Tỉnh Sơn La": [
    "Thành phố Sơn La","Huyện Quỳnh Nhai","Huyện Thuận Châu","Huyện Mường La",
    "Huyện Bắc Yên","Huyện Phù Yên","Huyện Mộc Châu","Huyện Yên Châu",
    "Huyện Mai Sơn","Huyện Sông Mã","Huyện Sốp Cộp","Huyện Vân Hồ"
  ],
  "Tỉnh Yên Bái": [
    "Thành phố Yên Bái","Thị xã Nghĩa Lộ","Huyện Lục Yên","Huyện Văn Yên",
    "Huyện Mù Cang Chải","Huyện Trấn Yên","Huyện Trạm Tấu","Huyện Văn Chấn","Huyện Yên Bình"
  ],
  "Tỉnh Hoà Bình": [
    "Thành phố Hòa Bình","Huyện Đà Bắc","Huyện Mai Châu","Huyện Tân Lạc",
    "Huyện Cao Phong","Huyện Lương Sơn","Huyện Kim Bôi","Huyện Lạc Sơn",
    "Huyện Lạc Thủy","Huyện Yên Thủy","Huyện Kỳ Sơn"
  ],
  "Tỉnh Thái Nguyên": [
    "Thành phố Thái Nguyên","Thành phố Sông Công","Thị xã Phổ Yên",
    "Huyện Định Hóa","Huyện Võ Nhai","Huyện Phú Lương","Huyện Đồng Hỷ",
    "Huyện Đại Từ","Huyện Phú Bình"
  ],
  "Tỉnh Lạng Sơn": [
    "Thành phố Lạng Sơn","Huyện Tràng Định","Huyện Bình Gia","Huyện Văn Lãng",
    "Huyện Cao Lộc","Huyện Lộc Bình","Huyện Văn Quan","Huyện Bắc Sơn",
    "Huyện Hữu Lũng","Huyện Chi Lăng","Huyện Đình Lập"
  ],
  "Tỉnh Quảng Ninh": [
    "Thành phố Hạ Long","Thành phố Móng Cái","Thành phố Cẩm Phả","Thành phố Uông Bí",
    "Thị xã Đông Triều","Thị xã Quảng Yên","Huyện Vân Đồn","Huyện Cô Tô",
    "Huyện Tiên Yên","Huyện Bình Liêu","Huyện Hải Hà","Huyện Đầm Hà","Huyện Ba Chẽ"
  ],
  "Tỉnh Bắc Giang": [
    "Thành phố Bắc Giang","Huyện Yên Thế","Huyện Tân Yên","Huyện Lạng Giang",
    "Huyện Lục Nam","Huyện Lục Ngạn","Huyện Sơn Động","Huyện Yên Dũng",
    "Huyện Việt Yên","Huyện Hiệp Hòa"
  ],
  "Tỉnh Phú Thọ": [
    "Thành phố Việt Trì","Thị xã Phú Thọ","Huyện Đoan Hùng","Huyện Hạ Hòa",
    "Huyện Thanh Ba","Huyện Cẩm Khê","Huyện Yên Lập","Huyện Tam Nông",
    "Huyện Lâm Thao","Huyện Phù Ninh","Huyện Thanh Sơn","Huyện Thanh Thủy","Huyện Tân Sơn"
  ],
  "Tỉnh Vĩnh Phúc": [
    "Thành phố Vĩnh Yên","Thành phố Phúc Yên","Huyện Lập Thạch","Huyện Sông Lô",
    "Huyện Tam Dương","Huyện Tam Đảo","Huyện Bình Xuyên","Huyện Yên Lạc","Huyện Vĩnh Tường"
  ],
  "Tỉnh Bắc Ninh": [
    "Thành phố Bắc Ninh","Thị xã Từ Sơn","Huyện Yên Phong","Huyện Quế Võ",
    "Huyện Tiên Du","Huyện Gia Bình","Huyện Thuận Thành","Huyện Lương Tài"
  ],
  "Tỉnh Hải Dương": [
    "Thành phố Hải Dương","Thành phố Chí Linh","Thị xã Kinh Môn","Huyện Nam Sách",
    "Huyện Bình Giang","Huyện Cẩm Giàng","Huyện Tứ Kỳ","Huyện Gia Lộc",
    "Huyện Thanh Miện","Huyện Ninh Giang","Huyện Kim Thành","Huyện Thanh Hà"
  ],
  "Thành phố Hải Phòng": [
    "Quận Hồng Bàng","Quận Lê Chân","Quận Ngô Quyền","Quận Kiến An",
    "Quận Hải An","Quận Đồ Sơn","Quận Dương Kinh","Huyện Cát Hải",
    "Huyện Thủy Nguyên","Huyện An Dương","Huyện An Lão","Huyện Kiến Thụy",
    "Huyện Tiên Lãng","Huyện Vĩnh Bảo","Huyện Bạch Long Vĩ"
  ],
  "Tỉnh Hưng Yên": [
    "Thành phố Hưng Yên","Huyện Văn Lâm","Huyện Văn Giang","Huyện Yên Mỹ",
    "Huyện Mỹ Hào","Huyện Khoái Châu","Huyện Kim Động","Huyện Tiên Lữ",
    "Huyện Phù Cừ","Huyện Ân Thi"
  ],
  "Tỉnh Thái Bình": [
    "Thành phố Thái Bình","Huyện Quỳnh Phụ","Huyện Hưng Hà","Huyện Đông Hưng",
    "Huyện Thái Thụy","Huyện Tiền Hải","Huyện Kiến Xương","Huyện Vũ Thư"
  ],
  "Tỉnh Hà Nam": [
    "Thành phố Phủ Lý","Thị xã Duy Tiên","Huyện Kim Bảng",
    "Huyện Bình Lục","Huyện Lý Nhân","Huyện Thanh Liêm"
  ],
  "Tỉnh Nam Định": [
    "Thành phố Nam Định","Huyện Mỹ Lộc","Huyện Vụ Bản","Huyện Ý Yên",
    "Huyện Nghĩa Hưng","Huyện Nam Trực","Huyện Trực Ninh","Huyện Xuân Trường",
    "Huyện Giao Thủy","Huyện Hải Hậu"
  ],
  "Tỉnh Ninh Bình": [
    "Thành phố Ninh Bình","Thành phố Tam Điệp","Huyện Nho Quan","Huyện Gia Viễn",
    "Huyện Hoa Lư","Huyện Yên Khánh","Huyện Kim Sơn","Huyện Yên Mô"
  ],
  "Tỉnh Thanh Hóa": [
    "Thành phố Thanh Hóa","Thành phố Sầm Sơn","Thị xã Bỉm Sơn","Thị xã Nghi Sơn",
    "Huyện Mường Lát","Huyện Quan Hóa","Huyện Bá Thước","Huyện Quan Sơn",
    "Huyện Lang Chánh","Huyện Ngọc Lặc","Huyện Cẩm Thủy","Huyện Thạch Thành",
    "Huyện Vĩnh Lộc","Huyện Yên Định","Huyện Thọ Xuân","Huyện Thường Xuân",
    "Huyện Triệu Sơn","Huyện Thiệu Hóa","Huyện Đông Sơn","Huyện Quảng Xương",
    "Huyện Nông Cống","Huyện Như Xuân","Huyện Như Thanh","Huyện Hà Trung","Huyện Hậu Lộc"
  ],
  "Tỉnh Nghệ An": [
    "Thành phố Vinh","Thị xã Cửa Lò","Thị xã Thái Hòa","Thị xã Hoàng Mai",
    "Huyện Diễn Châu","Huyện Quỳnh Lưu","Huyện Nghĩa Đàn","Huyện Quỳ Hợp",
    "Huyện Quỳ Châu","Huyện Quế Phong","Huyện Tương Dương","Huyện Kỳ Sơn",
    "Huyện Tân Kỳ","Huyện Anh Sơn","Huyện Con Cuông","Huyện Đô Lương",
    "Huyện Thanh Chương","Huyện Nam Đàn","Huyện Hưng Nguyên","Huyện Nghi Lộc","Huyện Yên Thành"
  ],
  "Tỉnh Hà Tĩnh": [
    "Thành phố Hà Tĩnh","Thị xã Hồng Lĩnh","Thị xã Kỳ Anh","Huyện Đức Thọ",
    "Huyện Nghi Xuân","Huyện Lộc Hà","Huyện Thạch Hà","Huyện Cẩm Xuyên",
    "Huyện Kỳ Anh","Huyện Vũ Quang","Huyện Hương Khê","Huyện Hương Sơn","Huyện Can Lộc"
  ],
  "Tỉnh Quảng Bình": [
    "Thành phố Đồng Hới","Thị xã Ba Đồn","Huyện Minh Hóa","Huyện Tuyên Hóa",
    "Huyện Quảng Trạch","Huyện Bố Trạch","Huyện Quảng Ninh","Huyện Lệ Thủy"
  ],
  "Tỉnh Quảng Trị": [
    "Thành phố Đông Hà","Thị xã Quảng Trị","Huyện Vĩnh Linh","Huyện Hướng Hóa",
    "Huyện Gio Linh","Huyện Đa Krông","Huyện Cam Lộ","Huyện Triệu Phong",
    "Huyện Hải Lăng","Huyện Cồn Cỏ"
  ],
  "Thành phố Huế": [
    "Quận Thuận Hóa","Quận Tây Lộc","Quận Phú Bình","Quận Phú Hiệp","Quận Phú Hòa",
    "Huyện Phong Điền","Huyện Quảng Điền","Huyện Phú Vang","Huyện Phú Lộc",
    "Huyện Nam Đông","Huyện A Lưới",
    "Thị xã Hương Thủy","Thị xã Hương Trà"
  ],
  "Thành phố Đà Nẵng": [
    "Quận Hải Châu","Quận Thanh Khê","Quận Sơn Trà","Quận Ngũ Hành Sơn",
    "Quận Liên Chiểu","Quận Cẩm Lệ","Huyện Hòa Vang","Huyện Hoàng Sa"
  ],
  "Tỉnh Quảng Nam": [
    "Thành phố Tam Kỳ","Thành phố Hội An","Thị xã Điện Bàn","Huyện Tây Giang",
    "Huyện Đông Giang","Huyện Đại Lộc","Huyện Duy Xuyên","Huyện Quế Sơn",
    "Huyện Nam Giang","Huyện Phước Sơn","Huyện Hiệp Đức","Huyện Thăng Bình",
    "Huyện Tiên Phước","Huyện Bắc Trà My","Huyện Nam Trà My","Huyện Nông Sơn",
    "Huyện Núi Thành","Huyện Phú Ninh"
  ],
  "Tỉnh Quảng Ngãi": [
    "Thành phố Quảng Ngãi","Huyện Bình Sơn","Huyện Trà Bồng","Huyện Sơn Hà",
    "Huyện Sơn Tây","Huyện Minh Long","Huyện Nghĩa Hành","Huyện Mộ Đức",
    "Huyện Đức Phổ","Huyện Ba Tơ","Huyện Lý Sơn","Huyện Tư Nghĩa","Huyện Sơn Tịnh"
  ],
  "Tỉnh Bình Định": [
    "Thành phố Quy Nhơn","Thị xã An Nhơn","Thị xã Hoài Nhơn","Huyện An Lão",
    "Huyện Hoài Ân","Huyện Phù Mỹ","Huyện Vĩnh Thạnh","Huyện Tây Sơn",
    "Huyện Vân Canh","Huyện Phù Cát","Huyện Tuy Phước"
  ],
  "Tỉnh Phú Yên": [
    "Thành phố Tuy Hòa","Thị xã Sông Cầu","Thị xã Đông Hòa","Huyện Đồng Xuân",
    "Huyện Tuy An","Huyện Sơn Hòa","Huyện Sông Hinh","Huyện Phú Hòa","Huyện Tây Hòa"
  ],
  "Tỉnh Khánh Hòa": [
    "Thành phố Nha Trang","Thành phố Cam Ranh","Thị xã Ninh Hòa","Huyện Vạn Ninh",
    "Huyện Diên Khánh","Huyện Khánh Vĩnh","Huyện Khánh Sơn","Huyện Trường Sa"
  ],
  "Tỉnh Ninh Thuận": [
    "Thành phố Phan Rang-Tháp Chàm","Huyện Bác Ái","Huyện Ninh Sơn",
    "Huyện Ninh Hải","Huyện Ninh Phước","Huyện Thuận Bắc","Huyện Thuận Nam"
  ],
  "Tỉnh Bình Thuận": [
    "Thành phố Phan Thiết","Thị xã La Gi","Huyện Tuy Phong","Huyện Bắc Bình",
    "Huyện Hàm Thuận Bắc","Huyện Hàm Thuận Nam","Huyện Tánh Linh",
    "Huyện Đức Linh","Huyện Hàm Tân","Huyện Phú Quí"
  ],
  "Tỉnh Kon Tum": [
    "Thành phố Kon Tum","Huyện Đắk Glei","Huyện Ngọc Hồi","Huyện Đắk Tô",
    "Huyện Kon Plông","Huyện Sa Thầy","Huyện Đắk Hà","Huyện Ia H'Drai","Huyện Tu Mơ Rông"
  ],
  "Tỉnh Gia Lai": [
    "Thành phố Pleiku","Thị xã An Khê","Thị xã Ayun Pa","Huyện KBang",
    "Huyện Đak Đoa","Huyện Chư Păh","Huyện Ia Grai","Huyện Mang Yang",
    "Huyện Kông Chro","Huyện Đức Cơ","Huyện Chư Prông","Huyện Chư Sê",
    "Huyện Chư Pưh","Huyện Đak Pơ","Huyện Ia Pa","Huyện Krông Pa","Huyện Phú Thiện"
  ],
  "Tỉnh Đắk Lắk": [
    "Thành phố Buôn Ma Thuột","Thị xã Buôn Hồ","Huyện Ea H'Leo","Huyện Ea Súp",
    "Huyện Krông Năng","Huyện Krông Buk","Huyện Buôn Đôn","Huyện Cư M'gar",
    "Huyện Ea Kar","Huyện M'Đrắk","Huyện Krông Pắc","Huyện Krông Ana",
    "Huyện Lắk","Huyện Cư Kuin"
  ],
  "Tỉnh Đắk Nông": [
    "Thành phố Gia Nghĩa","Huyện Đắk Mil","Huyện Krông Nô","Huyện Đắk Song",
    "Huyện Đắk R'Lấp","Huyện Đắk Glong","Huyện Cư Jút","Huyện Tuy Đức"
  ],
  "Tỉnh Lâm Đồng": [
    "Thành phố Đà Lạt","Thành phố Bảo Lộc","Huyện Đam Rông","Huyện Lạc Dương",
    "Huyện Lâm Hà","Huyện Đơn Dương","Huyện Đức Trọng","Huyện Di Linh",
    "Huyện Bảo Lâm","Huyện Đạ Huoai","Huyện Đạ Tẻh","Huyện Cát Tiên"
  ],
  "Tỉnh Bình Phước": [
    "Thành phố Đồng Xoài","Thị xã Bình Long","Thị xã Phước Long","Huyện Bù Gia Mập",
    "Huyện Lộc Ninh","Huyện Bù Đốp","Huyện Hớn Quản","Huyện Đồng Phú",
    "Huyện Bù Đăng","Huyện Chơn Thành","Huyện Phú Riềng"
  ],
  "Tỉnh Tây Ninh": [
    "Thành phố Tây Ninh","Huyện Tân Biên","Huyện Tân Châu","Huyện Dương Minh Châu",
    "Huyện Châu Thành","Huyện Hòa Thành","Huyện Gò Dầu","Huyện Bến Cầu","Huyện Trảng Bàng"
  ],
  "Tỉnh Bình Dương": [
    "Thành phố Thủ Dầu Một","Thành phố Dĩ An","Thành phố Thuận An",
    "Thành phố Bến Cát","Thị xã Tân Uyên","Huyện Bàu Bàng","Huyện Dầu Tiếng","Huyện Phú Giáo"
  ],
  "Tỉnh Đồng Nai": [
    "Thành phố Biên Hòa","Thành phố Long Khánh","Huyện Tân Phú","Huyện Định Quán",
    "Huyện Xuân Lộc","Huyện Cẩm Mỹ","Huyện Long Thành","Huyện Nhơn Trạch",
    "Huyện Trảng Bom","Huyện Thống Nhất","Huyện Vĩnh Cửu"
  ],
  "Tỉnh Bà Rịa - Vũng Tàu": [
    "Thành phố Vũng Tàu","Thành phố Bà Rịa","Thị xã Phú Mỹ","Huyện Châu Đức",
    "Huyện Xuyên Mộc","Huyện Long Điền","Huyện Đất Đỏ","Huyện Côn Đảo"
  ],
  "Thành phố Hồ Chí Minh": [
    "Quận 1","Quận 3","Quận 4","Quận 5","Quận 6","Quận 7","Quận 8",
    "Quận 10","Quận 11","Quận 12","Quận Bình Thạnh","Quận Phú Nhuận",
    "Quận Tân Bình","Quận Tân Phú","Quận Bình Tân","Quận Gò Vấp",
    "Thành phố Thủ Đức","Huyện Bình Chánh","Huyện Hóc Môn",
    "Huyện Củ Chi","Huyện Cần Giờ","Huyện Nhà Bè"
  ],
  "Tỉnh Long An": [
    "Thành phố Tân An","Thị xã Kiến Tường","Huyện Tân Hưng","Huyện Vĩnh Hưng",
    "Huyện Mộc Hóa","Huyện Tân Thạnh","Huyện Thạnh Hóa","Huyện Đức Huệ",
    "Huyện Đức Hòa","Huyện Bến Lức","Huyện Thủ Thừa","Huyện Tân Trụ",
    "Huyện Cần Đước","Huyện Cần Giuộc","Huyện Châu Thành"
  ],
  "Tỉnh Tiền Giang": [
    "Thành phố Mỹ Tho","Thị xã Gò Công","Thị xã Cai Lậy","Huyện Tân Phước",
    "Huyện Cái Bè","Huyện Cai Lậy","Huyện Châu Thành","Huyện Chợ Gạo",
    "Huyện Gò Công Tây","Huyện Gò Công Đông","Huyện Tân Phú Đông"
  ],
  "Tỉnh Bến Tre": [
    "Thành phố Bến Tre","Huyện Châu Thành","Huyện Chợ Lách","Huyện Mỏ Cày Nam",
    "Huyện Giồng Trôm","Huyện Bình Đại","Huyện Ba Tri","Huyện Thạnh Phú","Huyện Mỏ Cày Bắc"
  ],
  "Tỉnh Trà Vinh": [
    "Thành phố Trà Vinh","Thị xã Duyên Hải","Huyện Càng Long","Huyện Cầu Kè",
    "Huyện Tiểu Cần","Huyện Châu Thành","Huyện Cầu Ngang","Huyện Trà Cú","Huyện Duyên Hải"
  ],
  "Tỉnh Vĩnh Long": [
    "Thành phố Vĩnh Long","Thị xã Bình Minh","Huyện Long Hồ","Huyện Mang Thít",
    "Huyện Vũng Liêm","Huyện Tam Bình","Huyện Bình Tân","Huyện Trà Ôn"
  ],
  "Tỉnh Đồng Tháp": [
    "Thành phố Cao Lãnh","Thành phố Sa Đéc","Thị xã Hồng Ngự","Huyện Tân Hồng",
    "Huyện Hồng Ngự","Huyện Tam Nông","Huyện Tháp Mười","Huyện Cao Lãnh",
    "Huyện Thanh Bình","Huyện Lấp Vò","Huyện Lai Vung","Huyện Châu Thành"
  ],
  "Tỉnh An Giang": [
    "Thành phố Long Xuyên","Thành phố Châu Đốc","Thị xã Tân Châu","Huyện An Phú",
    "Huyện Phú Tân","Huyện Châu Phú","Huyện Tịnh Biên","Huyện Tri Tôn",
    "Huyện Châu Thành","Huyện Chợ Mới","Huyện Thoại Sơn"
  ],
  "Tỉnh Kiên Giang": [
    "Thành phố Rạch Giá","Thành phố Phú Quốc","Thị xã Hà Tiên","Huyện Kiên Lương",
    "Huyện Hòn Đất","Huyện Tân Hiệp","Huyện Châu Thành","Huyện Giồng Riềng",
    "Huyện Gò Quao","Huyện An Biên","Huyện An Minh","Huyện Vĩnh Thuận",
    "Huyện U Minh Thượng","Huyện Giang Thành"
  ],
  "Thành phố Cần Thơ": [
    "Quận Ninh Kiều","Quận Ô Môn","Quận Bình Thủy","Quận Cái Răng","Quận Thốt Nốt",
    "Huyện Vĩnh Thạnh","Huyện Cờ Đỏ","Huyện Phong Điền","Huyện Thới Lai"
  ],
  "Tỉnh Hậu Giang": [
    "Thành phố Vị Thanh","Thành phố Ngã Bảy","Thị xã Long Mỹ","Huyện Châu Thành",
    "Huyện Châu Thành A","Huyện Phụng Hiệp","Huyện Vị Thủy","Huyện Long Mỹ"
  ],
  "Tỉnh Sóc Trăng": [
    "Thành phố Sóc Trăng","Thị xã Ngã Năm","Thị xã Vĩnh Châu","Huyện Châu Thành",
    "Huyện Kế Sách","Huyện Mỹ Tú","Huyện Cù Lao Dung","Huyện Long Phú",
    "Huyện Mỹ Xuyên","Huyện Thạnh Trị","Huyện Trần Đề"
  ],
  "Tỉnh Bạc Liêu": [
    "Thành phố Bạc Liêu","Huyện Hồng Dân","Huyện Phước Long","Huyện Vĩnh Lợi",
    "Huyện Giá Rai","Huyện Đông Hải","Huyện Hòa Bình"
  ],
  "Tỉnh Cà Mau": [
    "Thành phố Cà Mau","Huyện U Minh","Huyện Thới Bình","Huyện Trần Văn Thời",
    "Huyện Cái Nước","Huyện Đầm Dơi","Huyện Năm Căn","Huyện Phú Tân","Huyện Ngọc Hiển"
  ],
};

export function getProvinces(): string[] {
  return Object.keys(VIETNAM_DISTRICTS);
}

export function getDistricts(province: string): string[] {
  return VIETNAM_DISTRICTS[province] ?? [];
}
