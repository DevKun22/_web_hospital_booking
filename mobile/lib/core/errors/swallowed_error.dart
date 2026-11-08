import 'package:flutter/foundation.dart';

/// Ghi nhận lỗi đã được chủ ý bỏ qua (lưu cục bộ thất bại, nền tảng không hỗ trợ, ...).
///
/// Chỉ chạy ở chế độ phát triển và chỉ ghi nơi phát sinh cùng loại lỗi, không ghi thông điệp
/// vì ứng dụng y tế có thể có dữ liệu cá nhân trong chuỗi lỗi. Mục đích là để lỗi bị nuốt
/// không biến mất hoàn toàn khi gỡ lỗi, không thay đổi hành vi của ứng dụng.
void logSwallowedError(
  String source,
  Object error, {
  void Function(String line)? sink,
}) {
  if (sink == null && !kDebugMode) return;
  (sink ?? debugPrint)('[SWALLOWED] $source ${error.runtimeType}');
}
