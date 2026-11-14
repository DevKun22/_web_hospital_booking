import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/features/profile/presentation/widgets/profile_summary_widgets.dart';

void main() {
  test('che giữa mã BHYT, chỉ để lại 3 ký tự đầu và cuối', () {
    expect(maskInsuranceCode('GL2312346'), 'GL2•••346');
    expect(maskInsuranceCode('  GL2312346 '), 'GL2•••346');
  });

  test('mã ngắn hoặc trống không bị cắt sai', () {
    expect(maskInsuranceCode('GL123'), 'GL123');
    expect(maskInsuranceCode(null), isNull);
    expect(maskInsuranceCode('   '), isNull);
  });
}
