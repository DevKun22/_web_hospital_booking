import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/home/application/home_search_history_provider.dart';
import 'package:hospital_booking_mobile/features/home/data/home_search_history_store.dart';
import 'package:hospital_booking_mobile/features/home/domain/home_search_history_entry.dart';

import 'helpers/fake_auth_controller.dart';

void main() {
  test('đăng xuất hoặc đổi tài khoản thì xóa lịch sử tìm kiếm', () async {
    final store = MemoryHomeSearchHistoryStore();
    final container = ProviderContainer(
      overrides: [
        fakeAuthOverride,
        homeSearchHistoryStoreProvider.overrideWithValue(store),
      ],
    );
    addTearDown(container.dispose);
    container.read(searchHistoryAccountGuardProvider);
    final auth =
        container.read(authControllerProvider.notifier) as FakeAuthController;

    // Khách đăng nhập: giữ lịch sử (vẫn là người đang cầm máy).
    store.entries.add(
      const HomeSearchHistoryEntry(
        title: 'Tim mạch',
        subtitle: 'Chuyên khoa',
        location: '/departments/department-1',
        kind: HomeSearchHistoryKind.department,
      ),
    );
    auth.signInAs('patient-a');
    await Future<void>.delayed(Duration.zero);
    expect(store.entries, isNotEmpty);

    auth.signOut();
    await Future<void>.delayed(Duration.zero);
    expect(store.entries, isEmpty);
  });
}
