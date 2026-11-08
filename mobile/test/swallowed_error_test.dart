import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/core/errors/swallowed_error.dart';

void main() {
  test('logs only the source and error type, never the message', () {
    final lines = <String>[];
    logSwallowedError(
      'pending_booking_store',
      const FormatException('so-dien-thoai-0912345678'),
      sink: lines.add,
    );
    expect(lines, ['[SWALLOWED] pending_booking_store FormatException']);
    expect(lines.join(), isNot(contains('0912345678')));
  });
}
