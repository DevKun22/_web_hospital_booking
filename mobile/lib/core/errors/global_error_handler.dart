import 'package:flutter/foundation.dart';

/// Gắn bộ bắt lỗi toàn cục để lỗi không được bắt ở nơi khác (ví dụ lỗi trong tác vụ
/// `unawaited`) không biến mất âm thầm.
///
/// Chỉ ghi loại lỗi và nơi phát sinh, không ghi thông điệp lỗi: ứng dụng y tế có thể có dữ liệu
/// cá nhân trong chuỗi lỗi (ví dụ `FormatException` kèm nội dung đang phân tích).
void installGlobalErrorHandlers({void Function(String line)? log}) {
  final sink = log ?? (line) => debugPrint(line);
  final previousFlutterHandler = FlutterError.onError;

  FlutterError.onError = (details) {
    sink(
      '[FLUTTER_ERROR] ${details.exception.runtimeType} '
      'in ${details.library ?? 'unknown'}',
    );
    previousFlutterHandler?.call(details);
  };

  PlatformDispatcher.instance.onError = (error, stack) {
    sink('[UNCAUGHT_ERROR] ${error.runtimeType}');
    // Đã ghi nhận: không để lỗi bất đồng bộ làm thoát ứng dụng ở bản phát hành.
    return true;
  };
}
