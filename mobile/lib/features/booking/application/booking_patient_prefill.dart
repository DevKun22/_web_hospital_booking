import 'package:hospital_booking_mobile/features/auth/domain/patient_user.dart';
import 'package:hospital_booking_mobile/features/profile/domain/patient_profile.dart';

/// Snapshot used to prefill a self-booking form.
///
/// The authenticated profile is authoritative. Session identity is only a
/// fallback while the richer profile is still loading or has missing values.
class BookingPatientPrefill {
  const BookingPatientPrefill({
    required this.hasBhyt,
    required this.fromProfile,
    this.fullName,
    this.phone,
    this.email,
    this.dateOfBirth,
    this.gender,
    this.cccd,
    this.address,
    this.healthInsuranceCode,
    this.registeredHospital,
  });

  factory BookingPatientPrefill.from({
    PatientUser? user,
    PatientProfile? profile,
  }) {
    final ownedProfile = profile != null && profile.id == user?.id
        ? profile
        : null;
    return BookingPatientPrefill(
      fullName: _firstPresent(ownedProfile?.fullName, user?.fullName),
      phone: _firstPresent(ownedProfile?.phone, user?.phone),
      email: _firstPresent(ownedProfile?.email, user?.email),
      dateOfBirth: _present(ownedProfile?.dateOfBirth),
      gender: ownedProfile?.gender?.apiValue,
      cccd: _present(ownedProfile?.cccd),
      address: _present(ownedProfile?.address),
      hasBhyt: ownedProfile?.hasBhyt ?? false,
      healthInsuranceCode: _present(ownedProfile?.healthInsuranceCode),
      registeredHospital: _present(ownedProfile?.registeredHospital),
      fromProfile: ownedProfile != null,
    );
  }

  final String? fullName;
  final String? phone;
  final String? email;
  final String? dateOfBirth;
  final String? gender;
  final String? cccd;
  final String? address;
  final bool hasBhyt;
  final String? healthInsuranceCode;
  final String? registeredHospital;
  final bool fromProfile;
}

String? _firstPresent(String? preferred, String? fallback) =>
    _present(preferred) ?? _present(fallback);

String? _present(String? value) {
  final normalized = value?.trim();
  return normalized == null || normalized.isEmpty ? null : normalized;
}
