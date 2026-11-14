import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Controller giữ dữ liệu lấy từ máy chủ và biết lần đồng bộ gần nhất.
///
/// Lớp này gom logic "chỉ làm mới khi dữ liệu đã cũ" dùng chung, để bộ đồng bộ ứng dụng
/// (`PatientDataSyncCoordinator`) điều khiển mọi nguồn dữ liệu theo cùng một giao diện.
abstract class SyncedNotifier<S> extends Notifier<S> {
  /// Thời điểm tải thành công gần nhất; null nếu chưa từng tải.
  DateTime? get lastSyncedAt;

  /// Tải lại dữ liệu từ máy chủ.
  Future<void> refresh();

  /// Chỉ tải lại khi dữ liệu cũ hơn [maxAge] hoặc chưa từng tải.
  Future<void> refreshIfStale({required Duration maxAge}) async {
    final syncedAt = lastSyncedAt;
    if (syncedAt != null && DateTime.now().difference(syncedAt) < maxAge) {
      return;
    }
    await refresh();
  }
}
