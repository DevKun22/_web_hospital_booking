import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/core/formatters/professional_name_formatter.dart';

void main() {
  test(
    'uses the structured title without duplicating a title in full name',
    () {
      expect(
        formatProfessionalName(
          title: 'ThS.BS',
          fullName: 'BS.CK2 Đỗ Quang Huy',
        ),
        'ThS.BS Đỗ Quang Huy',
      );
    },
  );

  test('collapses repeated titles in an unstructured display name', () {
    expect(
      normalizeProfessionalName('ThS.BS ThS.BS Nguyễn Văn Bắc Sĩ'),
      'ThS.BS Nguyễn Văn Bắc Sĩ',
    );
  });

  test('preserves a name that has no professional title', () {
    expect(normalizeProfessionalName('Nguyễn Văn An'), 'Nguyễn Văn An');
  });
}
