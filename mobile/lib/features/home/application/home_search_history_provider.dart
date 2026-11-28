import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/errors/swallowed_error.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/home/data/home_search_history_store.dart';

final homeSearchHistoryStoreProvider = Provider<HomeSearchHistoryStore>((ref) {
  try {
    return SharedHomeSearchHistoryStore();
  } catch (error) {
    logSwallowedError('home_search_history_provider', error);
    // Some test/desktop hosts do not register the preferences plugin.
    // Search must still work; only persistence is skipped for that process.
    return MemoryHomeSearchHistoryStore();
  }
});

/// Đăng xuất hoặc đổi tài khoản thì xóa lịch sử tìm kiếm trên máy: tên bác sĩ, chuyên khoa đã tìm có thể lộ mối quan tâm
/// sức khỏe của người dùng trước. Ứng dụng giữ provider này sống suốt vòng đời (xem `HospitalBookingApp`).
final searchHistoryAccountGuardProvider = Provider<void>((ref) {
  ref.listen<String?>(authControllerProvider.select((auth) => auth.user?.id), (
    previous,
    next,
  ) {
    if (previous == null || previous == next) return;
    unawaited(
      ref
          .read(homeSearchHistoryStoreProvider)
          .clear()
          .catchError(
            (Object error) =>
                logSwallowedError('search_history_account_guard', error),
          ),
    );
  });
});
