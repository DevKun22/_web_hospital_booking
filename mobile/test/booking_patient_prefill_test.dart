import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/features/auth/domain/patient_user.dart';
import 'package:hospital_booking_mobile/features/booking/application/booking_patient_prefill.dart';
import 'package:hospital_booking_mobile/features/profile/domain/patient_profile.dart';

const _user = PatientUser(
  id: 'patient-1',
  fullName: 'Tên trong phiên',
  phone: '0912345678',
  email: 'session@example.test',
  isPhoneVerified: true,
);

void main() {
  test('uses the owned patient profile as the self-booking source', () {
    const profile = PatientProfile(
      id: 'patient-1',
      fullName: 'Nguyễn Văn An',
      phone: '0987654321',
      email: 'profile@example.test',
      isPhoneVerified: true,
      dateOfBirth: '1995-05-20',
      gender: PatientGender.male,
      cccd: '012345678901',
      address: 'TP. Hồ Chí Minh',
      hasBhyt: true,
      healthInsuranceCode: 'DN4012345678901',
      registeredHospital: 'Bệnh viện Đại học Y Dược',
    );

    final result = BookingPatientPrefill.from(user: _user, profile: profile);

    expect(result.fromProfile, isTrue);
    expect(result.fullName, 'Nguyễn Văn An');
    expect(result.phone, '0987654321');
    expect(result.email, 'profile@example.test');
    expect(result.dateOfBirth, '1995-05-20');
    expect(result.gender, 'MALE');
    expect(result.cccd, '012345678901');
    expect(result.address, 'TP. Hồ Chí Minh');
    expect(result.hasBhyt, isTrue);
    expect(result.healthInsuranceCode, 'DN4012345678901');
    expect(result.registeredHospital, 'Bệnh viện Đại học Y Dược');
  });

  test('falls back to session identity and rejects a foreign profile', () {
    const foreignProfile = PatientProfile(
      id: 'patient-2',
      fullName: 'Không được sử dụng',
      phone: '0900000000',
      isPhoneVerified: true,
      hasBhyt: true,
    );

    final result = BookingPatientPrefill.from(
      user: _user,
      profile: foreignProfile,
    );

    expect(result.fromProfile, isFalse);
    expect(result.fullName, _user.fullName);
    expect(result.phone, _user.phone);
    expect(result.email, _user.email);
    expect(result.hasBhyt, isFalse);
  });
}
