import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/core/formatters/professional_name_formatter.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';

enum PatientAppointmentStatus {
  pendingOtp('PENDING_OTP'),
  pendingConfirm('PENDING_CONFIRM'),
  confirmed('CONFIRMED'),
  checkedIn('CHECKED_IN'),
  inProgress('IN_PROGRESS'),
  completed('COMPLETED'),
  rescheduled('RESCHEDULED'),
  cancelledByPatient('CANCELLED_BY_PATIENT'),
  cancelledByDoctor('CANCELLED_BY_DOCTOR'),
  cancelledByAdmin('CANCELLED_BY_ADMIN'),
  noShow('NO_SHOW'),
  unknown('UNKNOWN');

  const PatientAppointmentStatus(this.apiValue);

  factory PatientAppointmentStatus.fromApi(dynamic value) {
    final normalized = value?.toString().toUpperCase();
    return PatientAppointmentStatus.values.firstWhere(
      (status) => status.apiValue == normalized,
      orElse: () => PatientAppointmentStatus.unknown,
    );
  }

  final String apiValue;

  String get label => switch (this) {
    PatientAppointmentStatus.pendingOtp => 'Chờ xác thực OTP',
    PatientAppointmentStatus.pendingConfirm => 'Chờ bệnh viện xác nhận',
    PatientAppointmentStatus.confirmed => 'Đã xác nhận',
    PatientAppointmentStatus.checkedIn => 'Đã check-in',
    PatientAppointmentStatus.inProgress => 'Đang khám',
    PatientAppointmentStatus.completed => 'Hoàn tất',
    PatientAppointmentStatus.rescheduled => 'Đã đổi lịch',
    PatientAppointmentStatus.cancelledByPatient => 'Bạn đã hủy',
    PatientAppointmentStatus.cancelledByDoctor => 'Bác sĩ đã hủy',
    PatientAppointmentStatus.cancelledByAdmin => 'Bệnh viện đã hủy',
    PatientAppointmentStatus.noShow => 'Không đến khám',
    PatientAppointmentStatus.unknown => 'Đang cập nhật',
  };

  String get guidance => switch (this) {
    PatientAppointmentStatus.pendingOtp =>
      'Lịch chưa hoàn tất xác thực OTP và có thể tự hết hạn.',
    PatientAppointmentStatus.pendingConfirm =>
      'Bệnh viện đang kiểm tra và sẽ xác nhận lịch của bạn.',
    PatientAppointmentStatus.confirmed =>
      'Vui lòng đến sớm khoảng 15 phút để làm thủ tục.',
    PatientAppointmentStatus.checkedIn =>
      'Bạn đã check-in. Vui lòng chờ hướng dẫn tại bệnh viện.',
    PatientAppointmentStatus.inProgress => 'Buổi khám đang được thực hiện.',
    PatientAppointmentStatus.completed =>
      'Buổi khám đã hoàn tất. Kết quả sẽ xuất hiện khi được công bố.',
    PatientAppointmentStatus.rescheduled =>
      'Lịch đã được điều chỉnh. Vui lòng kiểm tra lại thời gian.',
    PatientAppointmentStatus.cancelledByPatient =>
      'Lịch đã được hủy theo yêu cầu của bạn.',
    PatientAppointmentStatus.cancelledByDoctor =>
      'Bác sĩ đã hủy lịch. Vui lòng đặt lịch khác hoặc liên hệ bệnh viện.',
    PatientAppointmentStatus.cancelledByAdmin =>
      'Bệnh viện đã hủy lịch. Vui lòng liên hệ để được hỗ trợ.',
    PatientAppointmentStatus.noShow => 'Lịch được ghi nhận là không đến khám.',
    PatientAppointmentStatus.unknown =>
      'Trạng thái đang được đồng bộ từ bệnh viện.',
  };

  AppStatusTone get tone => switch (this) {
    PatientAppointmentStatus.confirmed ||
    PatientAppointmentStatus.checkedIn ||
    PatientAppointmentStatus.inProgress => AppStatusTone.success,
    PatientAppointmentStatus.pendingOtp ||
    PatientAppointmentStatus.pendingConfirm ||
    PatientAppointmentStatus.rescheduled => AppStatusTone.warning,
    PatientAppointmentStatus.cancelledByPatient ||
    PatientAppointmentStatus.cancelledByDoctor ||
    PatientAppointmentStatus.cancelledByAdmin ||
    PatientAppointmentStatus.noShow => AppStatusTone.danger,
    PatientAppointmentStatus.completed ||
    PatientAppointmentStatus.unknown => AppStatusTone.info,
  };

  IconData get icon => switch (this) {
    PatientAppointmentStatus.confirmed => Icons.verified_outlined,
    PatientAppointmentStatus.checkedIn => Icons.how_to_reg_outlined,
    PatientAppointmentStatus.inProgress => Icons.medical_services_outlined,
    PatientAppointmentStatus.completed => Icons.task_alt_outlined,
    PatientAppointmentStatus.cancelledByPatient ||
    PatientAppointmentStatus.cancelledByDoctor ||
    PatientAppointmentStatus.cancelledByAdmin => Icons.cancel_outlined,
    PatientAppointmentStatus.noShow => Icons.person_off_outlined,
    PatientAppointmentStatus.rescheduled => Icons.update_outlined,
    PatientAppointmentStatus.pendingOtp ||
    PatientAppointmentStatus.pendingConfirm => Icons.schedule_outlined,
    PatientAppointmentStatus.unknown => Icons.info_outline,
  };

  bool get canCancel =>
      this == PatientAppointmentStatus.pendingConfirm ||
      this == PatientAppointmentStatus.confirmed;

  bool get isHistory => switch (this) {
    PatientAppointmentStatus.completed ||
    PatientAppointmentStatus.cancelledByPatient ||
    PatientAppointmentStatus.cancelledByDoctor ||
    PatientAppointmentStatus.cancelledByAdmin ||
    PatientAppointmentStatus.noShow => true,
    _ => false,
  };
}

class PatientAppointment {
  const PatientAppointment({
    required this.id,
    required this.bookingCode,
    required this.appointmentDate,
    required this.startTime,
    required this.endTime,
    required this.status,
    required this.doctorName,
    required this.departmentName,
    required this.finalAmount,
    this.doctorId,
    this.doctorAvatar,
    this.specialization,
    this.departmentId,
    this.packageName,
    this.reason,
    this.estimatedPrice = 0,
    this.serviceFee = 0,
    this.bhytDiscount = 0,
    this.confirmedAt,
    this.cancelledAt,
    this.cancelledReason,
    this.completedAt,
    this.createdAt,
  });

  factory PatientAppointment.fromJson(Map<String, dynamic> json) {
    final doctor = _map(json['doctor']);
    final doctorUser = _map(doctor['user']);
    final department = _map(json['department']);
    final package = _map(json['package']);
    return PatientAppointment(
      id: _string(json['id']),
      bookingCode: _string(json['bookingCode']),
      appointmentDate: _dateOnly(_string(json['appointmentDate'])),
      startTime: _string(json['startTime']),
      endTime: _string(json['endTime']),
      status: PatientAppointmentStatus.fromApi(json['status']),
      doctorId: _nullableString(doctor['id']),
      doctorName: formatProfessionalName(
        title: _nullableString(doctor['title']),
        fullName: _string(doctorUser['fullName']),
      ),
      doctorAvatar: _nullableString(doctorUser['avatar']),
      specialization: _nullableString(doctor['specialization']),
      departmentId: _nullableString(department['id']),
      departmentName: _nullableString(department['name']) ?? '',
      packageName: _nullableString(package['name']),
      reason: _nullableString(json['reason']),
      estimatedPrice: _number(json['estimatedPrice']),
      serviceFee: _number(json['serviceFee']),
      bhytDiscount: _number(json['bhytDiscount']),
      finalAmount: _number(json['finalAmount']),
      confirmedAt: _dateTime(json['confirmedAt']),
      cancelledAt: _dateTime(json['cancelledAt']),
      cancelledReason: _nullableString(json['cancelledReason']),
      completedAt: _dateTime(json['completedAt']),
      createdAt: _dateTime(json['createdAt']),
    );
  }

  final String id;
  final String bookingCode;
  final String appointmentDate;
  final String startTime;
  final String endTime;
  final PatientAppointmentStatus status;
  final String? doctorId;
  final String doctorName;
  final String? doctorAvatar;
  final String? specialization;
  final String? departmentId;
  final String departmentName;
  final String? packageName;
  final String? reason;
  final double estimatedPrice;
  final double serviceFee;
  final double bhytDiscount;
  final double finalAmount;
  final DateTime? confirmedAt;
  final DateTime? cancelledAt;
  final String? cancelledReason;
  final DateTime? completedAt;
  final DateTime? createdAt;

  bool get canCancel => canCancelAt(DateTime.now());

  bool canCancelAt(DateTime now) {
    if (!status.canCancel) return false;
    final scheduledStart = _scheduledStart;
    return scheduledStart != null && scheduledStart.isAfter(now);
  }

  bool get isHistory {
    if (status.isHistory) return true;
    if (status == PatientAppointmentStatus.checkedIn ||
        status == PatientAppointmentStatus.inProgress) {
      return false;
    }
    final scheduledEnd = _scheduledEnd;
    return scheduledEnd != null && scheduledEnd.isBefore(DateTime.now());
  }

  DateTime? get _scheduledStart => _scheduledDateTime(startTime);

  DateTime? get _scheduledEnd => _scheduledDateTime(endTime);

  DateTime? _scheduledDateTime(String time) {
    final date = DateTime.tryParse(appointmentDate);
    final timeParts = time.split(':');
    if (date == null || timeParts.length < 2) return null;
    final hour = int.tryParse(timeParts[0]);
    final minute = int.tryParse(timeParts[1]);
    if (hour == null || minute == null) return null;
    return DateTime(date.year, date.month, date.day, hour, minute);
  }

  String get careUnit => packageName ?? departmentName;
}

class AppointmentPage {
  const AppointmentPage({
    required this.items,
    required this.page,
    required this.total,
    required this.hasNextPage,
  });

  final List<PatientAppointment> items;
  final int page;
  final int total;
  final bool hasNextPage;
}

Map<String, dynamic> _map(dynamic value) =>
    value is Map ? Map<String, dynamic>.from(value) : <String, dynamic>{};

String _string(dynamic value) => value?.toString() ?? '';

String? _nullableString(dynamic value) {
  final result = value?.toString().trim();
  return result == null || result.isEmpty ? null : result;
}

double _number(dynamic value) => value is num
    ? value.toDouble()
    : double.tryParse(value?.toString() ?? '') ?? 0;

DateTime? _dateTime(dynamic value) =>
    DateTime.tryParse(value?.toString() ?? '');

String _dateOnly(String value) =>
    RegExp(r'^\d{4}-\d{2}-\d{2}').firstMatch(value)?.group(0) ?? value;
