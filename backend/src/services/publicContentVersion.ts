// Phiên bản nội dung công khai: tăng mỗi khi quản trị sửa khoa, bác sĩ, gói, hỏi đáp, banner, cấu hình trang chủ
// (qua PublicBootstrapService.invalidate). Bộ đệm danh mục gắn phiên bản này nên tự bỏ dữ liệu cũ ngay sau khi sửa.
let version = 0;

export const getPublicContentVersion = () => version;

export const bumpPublicContentVersion = () => {
  version += 1;
};
