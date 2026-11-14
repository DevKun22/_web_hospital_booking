import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/core/formatters/vietnam_time.dart';

void main() {
  // 2026-11-14 03:00 UTC = 10:00 giờ Việt Nam.
  final now = DateTime.utc(2026, 11, 14, 3);

  test('recent notifications read as relative time', () {
    expect(
      formatRelativeVietnamTime(
        now.subtract(const Duration(seconds: 20)),
        now: now,
      ),
      'Vừa xong',
    );
    expect(
      formatRelativeVietnamTime(
        now.subtract(const Duration(minutes: 5)),
        now: now,
      ),
      '5 phút trước',
    );
  });

  test(
    'older notifications use Vietnam wall-clock time regardless of device zone',
    () {
      // 02:00 UTC cùng ngày = 09:00 Việt Nam, đã hơn 1 giờ trước.
      expect(
        formatRelativeVietnamTime(DateTime.utc(2026, 11, 14, 1), now: now),
        '08:00',
      );
      // 16:30 UTC hôm trước = 23:30 Việt Nam hôm qua.
      expect(
        formatRelativeVietnamTime(DateTime.utc(2026, 11, 13, 16, 30), now: now),
        'Hôm qua · 23:30',
      );
      expect(
        formatRelativeVietnamTime(DateTime.utc(2026, 11, 10, 2, 5), now: now),
        '10/11/2026 · 09:05',
      );
    },
  );

  test('the Vietnam day rolls over at 17:00 UTC', () {
    final lateUtc = DateTime.utc(
      2026,
      11,
      14,
      18,
      30,
    ); // 01:30 ngày 15 ở Việt Nam
    expect(vietnamToday(lateUtc), DateTime.utc(2026, 11, 15));
    expect(
      vietnamDateOf(DateTime.utc(2026, 11, 14, 16)),
      DateTime.utc(2026, 11, 14),
    );
    expect(
      vietnamDateOf(DateTime.utc(2026, 11, 14, 17)),
      DateTime.utc(2026, 11, 15),
    );
  });
}
