import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/features/support/application/support_action_launcher.dart';

void main() {
  group('normalizeDialablePhone', () {
    test('removes visual separators', () {
      expect(normalizeDialablePhone(' 1900 10-80 '), '19001080');
      expect(normalizeDialablePhone('(028) 1234.5678'), '02812345678');
    });

    test('preserves only one leading international prefix', () {
      expect(normalizeDialablePhone('+84 912 345 678'), '+84912345678');
    });

    test('rejects empty and unusable values', () {
      expect(normalizeDialablePhone(''), isNull);
      expect(normalizeDialablePhone('hotline'), isNull);
      expect(normalizeDialablePhone('12'), isNull);
    });
  });
}
