import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/features/booking/application/booking_patient_prefill.dart';
import 'package:hospital_booking_mobile/features/booking/presentation/booking_patient_form_model.dart';
import 'package:hospital_booking_mobile/features/dependents/domain/dependent_profile.dart';

const _owner = BookingPatientPrefill(
  hasBhyt: false,
  fromProfile: true,
  fullName: 'Chủ tài khoản',
  phone: '0912345678',
  email: 'chu@example.test',
  gender: 'MALE',
);

void main() {
  test('điền sẵn không ghi đè ô người dùng đã tự sửa', () {
    final form = BookingPatientFormModel();
    addTearDown(form.dispose);

    expect(form.applyPrefill(_owner), isTrue);
    expect(form.name.text, 'Chủ tài khoản');
    expect(form.gender, 'MALE');

    form.name.text = 'Tên tự gõ';
    form.applyPrefill(
      const BookingPatientPrefill(
        hasBhyt: false,
        fromProfile: true,
        fullName: 'Tên mới từ hồ sơ',
        phone: '0987654321',
      ),
    );
    expect(form.name.text, 'Tên tự gõ');
    expect(form.phone.text, '0987654321');
  });

  test('hồ sơ người thân giữ liên hệ của chủ tài khoản và khóa điền sẵn', () {
    final form = BookingPatientFormModel();
    addTearDown(form.dispose);
    form.applyPrefill(_owner);

    form.applyDependent(
      const DependentProfile(
        id: 'd1',
        fullName: 'Bé An',
        relationship: DependentRelationship.child,
        hasBhyt: true,
        healthInsuranceCode: 'DN123',
        gender: 'FEMALE',
      ),
      _owner,
    );
    expect(form.name.text, 'Bé An');
    expect(form.phone.text, '0912345678');
    expect(form.email.text, 'chu@example.test');
    expect(form.insuranceCode.text, 'DN123');
    expect(form.gender, 'FEMALE');
    expect(form.hasBhyt, isTrue);

    // Điền sẵn lại của chủ tài khoản không đè lên dữ liệu người thân.
    form.applyPrefill(_owner);
    expect(form.name.text, 'Bé An');
    expect(form.gender, 'FEMALE');
  });

  test('quay về bản thân xóa dữ liệu cũ và cho điền sẵn lại', () {
    final form = BookingPatientFormModel();
    addTearDown(form.dispose);
    form.applyDependent(
      const DependentProfile(
        id: 'd1',
        fullName: 'Bé An',
        relationship: DependentRelationship.child,
        hasBhyt: true,
      ),
      _owner,
    );
    form.reason.text = 'Khám tổng quát';

    form.resetForSelf();
    expect(form.name.text, isEmpty);
    expect(form.hasBhyt, isFalse);
    expect(form.reason.text, 'Khám tổng quát');

    form.applyPrefill(_owner);
    expect(form.name.text, 'Chủ tài khoản');
  });

  test('bản nháp gửi đi lấy đúng dữ liệu biểu mẫu', () {
    final form = BookingPatientFormModel();
    addTearDown(form.dispose);
    form.applyPrefill(_owner);
    form.reason.text = 'Đau đầu';

    final draft = form.toDraft(dependentProfileId: 'd9');
    expect(draft.dependentProfileId, 'd9');
    expect(draft.patientName, 'Chủ tài khoản');
    expect(draft.patientPhone, '0912345678');
    expect(draft.reason, 'Đau đầu');
  });

  test(
    'chỉ đặt cho chính mình khi đã đăng nhập mới bỏ qua OTP và điều khoản',
    () {
      expect(bookingNeedsOtp(authenticated: false, forRelative: false), isTrue);
      expect(bookingNeedsOtp(authenticated: false, forRelative: true), isTrue);
      expect(bookingNeedsOtp(authenticated: true, forRelative: true), isTrue);
      expect(bookingNeedsOtp(authenticated: true, forRelative: false), isFalse);
    },
  );
}
