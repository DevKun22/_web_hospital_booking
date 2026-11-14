import 'package:hospital_booking_mobile/core/formatters/professional_name_formatter.dart';
import 'package:hospital_booking_mobile/features/booking/domain/booking_catalog.dart';

import 'package:hospital_booking_mobile/core/network/json_readers.dart';

enum BookingOtpChannel { sms, email }

extension BookingOtpChannelValue on BookingOtpChannel {
  String get apiValue => this == BookingOtpChannel.email ? 'EMAIL' : 'SMS';
}

class BookingPatientDraft {
  const BookingPatientDraft({
    required this.patientName,
    required this.patientPhone,
    required this.otpChannel,
    this.patientEmail,
    this.reason,
    this.gender,
    this.dateOfBirth,
    this.cccd,
    this.address,
    this.hasBhyt = false,
    this.healthInsuranceCode,
    this.registeredHospital,
    this.dependentProfileId,
  });

  final String patientName;
  final String patientPhone;
  final String? patientEmail;
  final BookingOtpChannel otpChannel;
  final String? reason;
  final String? gender;
  final String? dateOfBirth;
  final String? cccd;
  final String? address;
  final bool hasBhyt;
  final String? healthInsuranceCode;
  final String? registeredHospital;
  final String? dependentProfileId;

  Map<String, dynamic> toRequestJson(BookingSelection selection) => {
    'dependentProfileId': jsonNullableString(dependentProfileId),
    'packageId': selection.serviceMode == BookingServiceMode.package
        ? selection.packageId
        : null,
    'departmentId': selection.departmentId,
    'doctorId': selection.doctorId,
    'timeSlotId': selection.slotId,
    'patientName': patientName.trim(),
    'patientPhone': patientPhone.trim(),
    'patientEmail': jsonNullableString(patientEmail),
    'otpChannel': otpChannel.apiValue,
    'reason': jsonNullableString(reason),
    'gender': jsonNullableString(gender),
    'dateOfBirth': jsonNullableString(dateOfBirth),
    'cccd': jsonNullableString(cccd),
    'address': jsonNullableString(address),
    'hasBHYT': hasBhyt,
    'healthInsuranceCode': hasBhyt
        ? jsonNullableString(healthInsuranceCode)
        : null,
    'registeredHospital': hasBhyt
        ? jsonNullableString(registeredHospital)
        : null,
  };
}

class PendingBooking {
  const PendingBooking({
    required this.appointmentId,
    required this.bookingCode,
    required this.patientPhone,
    required this.expiresIn,
    this.holdExpiresAt,
    this.holdReleaseToken,
    this.otpDeliveryStatus,
    this.debugOtp,
    this.otpChannel = BookingOtpChannel.sms,
    this.otpTarget,
  });

  factory PendingBooking.fromJson(Map<String, dynamic> json) => PendingBooking(
    appointmentId: json['appointmentId']?.toString() ?? '',
    bookingCode: json['bookingCode']?.toString() ?? '',
    patientPhone: json['patientPhone']?.toString() ?? '',
    expiresIn: jsonInt(json['expiresIn']),
    holdExpiresAt: DateTime.tryParse(json['holdExpiresAt']?.toString() ?? ''),
    holdReleaseToken: jsonNullableString(json['holdReleaseToken']),
    otpDeliveryStatus: json['otpDeliveryStatus']?.toString(),
    debugOtp: json['debugOtp']?.toString(),
    otpChannel: json['otpChannel']?.toString().toUpperCase() == 'EMAIL'
        ? BookingOtpChannel.email
        : BookingOtpChannel.sms,
    otpTarget: json['otpTarget']?.toString(),
  );

  final String appointmentId;
  final String bookingCode;
  final String patientPhone;
  final int expiresIn;
  final DateTime? holdExpiresAt;
  final String? holdReleaseToken;
  final String? otpDeliveryStatus;
  final String? debugOtp;
  final BookingOtpChannel otpChannel;
  final String? otpTarget;

  bool get holdExpired =>
      holdExpiresAt != null && !holdExpiresAt!.isAfter(DateTime.now());

  PendingBooking copyWith({
    int? expiresIn,
    DateTime? holdExpiresAt,
    String? holdReleaseToken,
    String? otpDeliveryStatus,
    String? debugOtp,
    BookingOtpChannel? otpChannel,
    String? otpTarget,
  }) => PendingBooking(
    appointmentId: appointmentId,
    bookingCode: bookingCode,
    patientPhone: patientPhone,
    expiresIn: expiresIn ?? this.expiresIn,
    holdExpiresAt: holdExpiresAt ?? this.holdExpiresAt,
    holdReleaseToken: holdReleaseToken ?? this.holdReleaseToken,
    otpDeliveryStatus: otpDeliveryStatus ?? this.otpDeliveryStatus,
    debugOtp: debugOtp ?? this.debugOtp,
    otpChannel: otpChannel ?? this.otpChannel,
    otpTarget: otpTarget ?? this.otpTarget,
  );

  Map<String, dynamic> toSecureJson() => {
    'appointmentId': appointmentId,
    'bookingCode': bookingCode,
    'patientPhone': patientPhone,
    'expiresIn': expiresIn,
    'holdExpiresAt': holdExpiresAt?.toIso8601String(),
    'holdReleaseToken': holdReleaseToken,
    'otpDeliveryStatus': otpDeliveryStatus,
    'otpChannel': otpChannel.apiValue,
    'otpTarget': otpTarget,
  };
}

class BookedAppointment {
  const BookedAppointment({
    required this.id,
    required this.bookingCode,
    required this.status,
    required this.patientName,
    required this.patientPhone,
    required this.appointmentDate,
    required this.startTime,
    required this.endTime,
    required this.doctorName,
    required this.departmentName,
    required this.finalAmount,
    this.packageName,
  });

  factory BookedAppointment.fromJson(Map<String, dynamic> json) {
    final doctor = jsonMap(json['doctor']);
    final doctorUser = jsonMap(doctor['user']);
    final department = jsonMap(json['department']);
    final packageItem = jsonMap(json['package']);
    return BookedAppointment(
      id: json['id']?.toString() ?? '',
      bookingCode: json['bookingCode']?.toString() ?? '',
      status: json['status']?.toString() ?? '',
      patientName: json['patientName']?.toString() ?? '',
      patientPhone: json['patientPhone']?.toString() ?? '',
      appointmentDate: jsonDateOnly(json['appointmentDate']?.toString() ?? ''),
      startTime: json['startTime']?.toString() ?? '',
      endTime: json['endTime']?.toString() ?? '',
      doctorName: formatProfessionalName(
        title: jsonNullableString(doctor['title']),
        fullName: jsonNullableString(doctorUser['fullName']) ?? '',
      ),
      departmentName: department['name']?.toString() ?? '',
      packageName: jsonNullableString(packageItem['name']),
      finalAmount: jsonNumber(json['finalAmount']),
    );
  }

  final String id;
  final String bookingCode;
  final String status;
  final String patientName;
  final String patientPhone;
  final String appointmentDate;
  final String startTime;
  final String endTime;
  final String doctorName;
  final String departmentName;
  final String? packageName;
  final double finalAmount;
}
