/// Tên và khẩu hiệu thương hiệu, viết đúng theo bộ nhận diện DevKunCare.
abstract final class AppBrand {
  /// Phông chữ đóng gói trong ứng dụng (khai báo ở pubspec.yaml). Chưa có tệp phông thì Flutter dùng phông hệ thống.
  static const fontFamily = 'BeVietnamPro';

  static const name = 'DevKunCare';
  static const tagline = 'Đặt lịch trực tuyến';

  /// Website của cơ sở: bài viết Kiến thức và trang pháp lý mở ở đây, ứng dụng không dựng lại.
  static const webUrl = 'https://care.ngoloi.dev';
}
