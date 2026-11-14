import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/core/network/json_readers.dart';

void main() {
  group('json readers', () {
    test('jsonMap returns an empty map for non-map values', () {
      expect(jsonMap(null), isEmpty);
      expect(jsonMap('x'), isEmpty);
      expect(jsonMap({'a': 1}), {'a': 1});
    });

    test('jsonInt reads numbers and numeric strings with a fallback', () {
      expect(jsonInt(12.9), 12);
      expect(jsonInt('7'), 7);
      expect(jsonInt('abc'), 0);
      expect(jsonInt(null, fallback: 5), 5);
    });

    test('jsonText trims and falls back when empty', () {
      expect(jsonText('  chào  '), 'chào');
      expect(jsonText('   ', fallback: 'x'), 'x');
      expect(jsonText(null), '');
    });

    test('jsonString keeps the raw text without trimming', () {
      expect(jsonString('  a '), '  a ');
      expect(jsonString(null), '');
    });

    test('jsonNullableString returns null for blank values', () {
      expect(jsonNullableString('  '), isNull);
      expect(jsonNullableString(null), isNull);
      expect(jsonNullableString(' a '), 'a');
    });

    test('jsonNumber reads numbers and numeric strings', () {
      expect(jsonNumber(3), 3.0);
      expect(jsonNumber('2.5'), 2.5);
      expect(jsonNumber('x'), 0);
    });

    test('jsonDateTime parses ISO strings and ignores invalid ones', () {
      expect(jsonDateTime('2026-11-14T08:30:00.000Z')?.toUtc().hour, 8);
      expect(jsonDateTime('không phải ngày'), isNull);
      expect(jsonDateTime(null), isNull);
    });

    test('date-only readers keep the yyyy-MM-dd prefix', () {
      expect(jsonDateOnly('2026-11-14T00:00:00.000Z'), '2026-11-14');
      expect(jsonDateOnly('14/11'), '14/11');
      expect(jsonNullableDateOnly('2026-11-14T00:00:00.000Z'), '2026-11-14');
      expect(jsonNullableDateOnly('14/11'), isNull);
      expect(jsonNullableDateOnly(' '), isNull);
    });
  });
}
