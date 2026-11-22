import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/core/formatters/search_text.dart';

void main() {
  test('foldVietnamese bỏ dấu và đổi chữ thường', () {
    expect(foldVietnamese('Nguyễn Thị Mai'), 'nguyen thi mai');
    expect(foldVietnamese('Đỗ Quang Huy'), 'do quang huy');
    expect(foldVietnamese('Tim mạch'), 'tim mach');
    expect(foldVietnamese('ƯỜỞỢ'), 'uooo');
  });

  test('matchesSearch cần đủ mọi từ, không phân biệt dấu', () {
    expect(matchesSearch('BS. Đỗ Quang Huy Da liễu', 'huy da lieu'), isTrue);
    expect(matchesSearch('BS. Đỗ Quang Huy Da liễu', 'huy tim'), isFalse);
    expect(matchesSearch('Bất kỳ', '   '), isTrue);
  });
}
