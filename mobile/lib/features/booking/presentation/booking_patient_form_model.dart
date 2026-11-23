import 'package:flutter/widgets.dart';
import 'package:hospital_booking_mobile/features/booking/application/booking_patient_prefill.dart';
import 'package:hospital_booking_mobile/features/booking/domain/booking_submission.dart';
import 'package:hospital_booking_mobile/features/dependents/domain/dependent_profile.dart';

/// Các ô văn bản của biểu mẫu thông tin người khám; dùng để nhớ ô nào người dùng đã tự sửa.
enum BookingPatientField {
  fullName,
  phone,
  email,
  dateOfBirth,
  cccd,
  address,
  healthInsuranceCode,
  registeredHospital,
}

/// Dữ liệu và quy tắc điền sẵn của biểu mẫu thông tin người khám, tách khỏi màn hình để màn chỉ lo giao diện.
/// Điền sẵn từ tài khoản, hồ sơ hoặc hồ sơ người thân không ghi đè ô người dùng đã tự sửa.
class BookingPatientFormModel {
  BookingPatientFormModel() {
    _byField = {
      BookingPatientField.fullName: name,
      BookingPatientField.phone: phone,
      BookingPatientField.email: email,
      BookingPatientField.dateOfBirth: dateOfBirth,
      BookingPatientField.cccd: cccd,
      BookingPatientField.address: address,
      BookingPatientField.healthInsuranceCode: insuranceCode,
      BookingPatientField.registeredHospital: registeredHospital,
    };
    for (final entry in _byField.entries) {
      entry.value.addListener(() {
        if (!_applying) _edited.add(entry.key);
      });
    }
  }

  final name = TextEditingController();
  final phone = TextEditingController();
  final email = TextEditingController();
  final reason = TextEditingController();
  final dateOfBirth = TextEditingController();
  final cccd = TextEditingController();
  final address = TextEditingController();
  final insuranceCode = TextEditingController();
  final registeredHospital = TextEditingController();

  String? gender;
  bool hasBhyt = false;
  bool genderEdited = false;
  bool bhytEdited = false;
  bool profilePrefillApplied = false;

  late final Map<BookingPatientField, TextEditingController> _byField;
  final Set<BookingPatientField> _edited = {};
  bool _applying = false;

  /// Điền sẵn các ô chưa bị sửa. Trả về true khi có trạng thái ngoài ô văn bản đổi (giới tính, BHYT, nguồn hồ sơ).
  bool applyPrefill(BookingPatientPrefill prefill) {
    var stateChanged = false;
    _applying = true;
    try {
      _setText(BookingPatientField.fullName, prefill.fullName);
      _setText(BookingPatientField.phone, prefill.phone);
      _setText(BookingPatientField.email, prefill.email);
      _setText(BookingPatientField.dateOfBirth, prefill.dateOfBirth);
      _setText(BookingPatientField.cccd, prefill.cccd);
      _setText(BookingPatientField.address, prefill.address);
      _setText(
        BookingPatientField.healthInsuranceCode,
        prefill.healthInsuranceCode,
      );
      _setText(
        BookingPatientField.registeredHospital,
        prefill.registeredHospital,
      );
      if (!genderEdited && prefill.gender != null && gender != prefill.gender) {
        gender = prefill.gender;
        stateChanged = true;
      }
      if (!bhytEdited && hasBhyt != prefill.hasBhyt) {
        hasBhyt = prefill.hasBhyt;
        stateChanged = true;
      }
      if (prefill.fromProfile && !profilePrefillApplied) {
        profilePrefillApplied = true;
        stateChanged = true;
      }
    } finally {
      _applying = false;
    }
    return stateChanged;
  }

  void _setText(BookingPatientField field, String? value) {
    if (value == null || _edited.contains(field)) return;
    final controller = _byField[field]!;
    if (controller.text != value) controller.text = value;
  }

  /// Điền cả biểu mẫu từ hồ sơ người thân; liên hệ (số điện thoại, email) vẫn là của chủ tài khoản.
  void applyDependent(DependentProfile dependent, BookingPatientPrefill owner) {
    _applying = true;
    try {
      name.text = dependent.fullName;
      phone.text = owner.phone ?? '';
      email.text = owner.email ?? '';
      dateOfBirth.text = dependent.dateOfBirth ?? '';
      cccd.text = dependent.cccd ?? '';
      address.text = dependent.address ?? '';
      insuranceCode.text = dependent.healthInsuranceCode ?? '';
      registeredHospital.text = dependent.registeredHospital ?? '';
    } finally {
      _applying = false;
    }
    _edited.addAll(BookingPatientField.values);
    gender = dependent.gender;
    hasBhyt = dependent.hasBhyt;
    genderEdited = true;
    bhytEdited = true;
    profilePrefillApplied = true;
  }

  /// Xóa dữ liệu người khám đang điền (không đụng đến lý do khám) trước khi đổi sang người khác.
  void clearSnapshot() {
    _applying = true;
    try {
      for (final controller in _byField.values) {
        controller.clear();
      }
    } finally {
      _applying = false;
    }
    gender = null;
    hasBhyt = false;
  }

  /// Quay lại đặt cho bản thân: xóa dữ liệu cũ và cho phép điền sẵn lại từ tài khoản.
  void resetForSelf() {
    clearSnapshot();
    genderEdited = false;
    bhytEdited = false;
    profilePrefillApplied = false;
    _edited.clear();
  }

  BookingPatientDraft toDraft({String? dependentProfileId}) =>
      BookingPatientDraft(
        dependentProfileId: dependentProfileId,
        patientName: name.text,
        patientPhone: phone.text,
        patientEmail: email.text,
        reason: reason.text,
        gender: gender,
        dateOfBirth: dateOfBirth.text,
        cccd: cccd.text,
        address: address.text,
        hasBhyt: hasBhyt,
        healthInsuranceCode: insuranceCode.text,
        registeredHospital: registeredHospital.text,
      );

  void dispose() {
    for (final controller in [
      name,
      phone,
      email,
      reason,
      dateOfBirth,
      cccd,
      address,
      insuranceCode,
      registeredHospital,
    ]) {
      controller.dispose();
    }
  }
}
