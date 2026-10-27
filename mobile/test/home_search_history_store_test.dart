import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/features/home/data/home_search_history_store.dart';
import 'package:hospital_booking_mobile/features/home/domain/home_search_history_entry.dart';

void main() {
  test('keeps the latest five distinct public destinations', () async {
    final store = MemoryHomeSearchHistoryStore();
    for (var index = 0; index < 6; index += 1) {
      await store.remember(
        HomeSearchHistoryEntry(
          title: 'Bác sĩ $index',
          subtitle: 'Bác sĩ',
          location: '/doctors/$index',
          kind: HomeSearchHistoryKind.doctor,
        ),
      );
    }
    await store.remember(
      const HomeSearchHistoryEntry(
        title: 'Bác sĩ 3',
        subtitle: 'Bác sĩ',
        location: '/doctors/3',
        kind: HomeSearchHistoryKind.doctor,
      ),
    );

    final entries = await store.read();
    expect(entries, hasLength(5));
    expect(entries.first.location, '/doctors/3');
    expect(
      entries.where((item) => item.location == '/doctors/3'),
      hasLength(1),
    );
    expect(entries.any((item) => item.location == '/doctors/0'), isFalse);
  });

  test('rejects destinations outside the app router', () async {
    final store = MemoryHomeSearchHistoryStore();
    await store.remember(
      const HomeSearchHistoryEntry(
        title: 'Không hợp lệ',
        subtitle: 'Liên kết',
        location: 'https://example.test',
        kind: HomeSearchHistoryKind.department,
      ),
    );

    expect(await store.read(), isEmpty);
  });
}
