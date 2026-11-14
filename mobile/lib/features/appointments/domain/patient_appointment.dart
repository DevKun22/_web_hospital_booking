import 'package:hospital_booking_mobile/core/formatters/professional_name_formatter.dart';

import 'package:hospital_booking_mobile/core/network/json_readers.dart';

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
    PatientAppointmentStatus.pendingConfirm => 'Chờ cơ sở khám xác nhận',
    PatientAppointmentStatus.confirmed => 'Đã xác nhận',
    PatientAppointmentStatus.checkedIn => 'Đã check-in',
    PatientAppointmentStatus.inProgress => 'Đang khám',
    PatientAppointmentStatus.completed => 'Hoàn tất',
    PatientAppointmentStatus.rescheduled => 'Đã đổi lịch',
    PatientAppointmentStatus.cancelledByPatient => 'Bạn đã hủy',
    PatientAppointmentStatus.cancelledByDoctor => 'Bác sĩ đã hủy',
    PatientAppointmentStatus.cancelledByAdmin => 'Cơ sở khám đã hủy',
    PatientAppointmentStatus.noShow => 'Không đến khám',
    PatientAppointmentStatus.unknown => 'Đang cập nhật',
  };

  String get guidance => switch (this) {
    PatientAppointmentStatus.pendingOtp =>
      'Lịch chưa hoàn tất xác thực OTP và có thể tự hết hạn.',
    PatientAppointmentStatus.pendingConfirm =>
      'Cơ sở khám đang kiểm tra và sẽ xác nhận lịch của bạn.',
    PatientAppointmentStatus.confirmed =>
      'Vui lòng đến sớm khoảng 15 phút để làm thủ tục.',
    PatientAppointmentStatus.checkedIn =>
      'Bạn đã check-in. Vui lòng chờ hướng dẫn tại cơ sở khám.',
    PatientAppointmentStatus.inProgress => 'Buổi khám đang được thực hiện.',
    PatientAppointmentStatus.completed =>
      'Buổi khám đã hoàn tất. Kết quả sẽ xuất hiện khi được công bố.',
    PatientAppointmentStatus.rescheduled =>
      'Lịch đã được điều chỉnh. Vui lòng kiểm tra lại thời gian.',
    PatientAppointmentStatus.cancelledByPatient =>
      'Lịch đã được hủy theo yêu cầu của bạn.',
    PatientAppointmentStatus.cancelledByDoctor =>
      'Bác sĩ đã hủy lịch. Vui lòng đặt lịch khác hoặc liên hệ cơ sở khám.',
    PatientAppointmentStatus.cancelledByAdmin =>
      'Cơ sở khám đã hủy lịch. Vui lòng liên hệ để được hỗ trợ.',
    PatientAppointmentStatus.noShow => 'Lịch được ghi nhận là không đến khám.',
    PatientAppointmentStatus.unknown =>
      'Trạng thái đang được đồng bộ từ cơ sở khám.',
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
    this.patientName = '',
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
    this.hasBhyt = false,
    this.bhytDiscount = 0,
    this.confirmedAt,
    this.cancelledAt,
    this.cancelledReason,
    this.completedAt,
    this.createdAt,
    this.dependentProfileId,
  });

  factory PatientAppointment.fromJson(Map<String, dynamic> json) {
    final doctor = jsonMap(json['doctor']);
    final doctorUser = jsonMap(doctor['user']);
    final department = jsonMap(json['department']);
    final package = jsonMap(json['package']);
    return PatientAppointment(
      id: jsonString(json['id']),
      bookingCode: jsonString(json['bookingCode']),
      appointmentDate: jsonDateOnly(jsonString(json['appointmentDate'])),
      startTime: jsonString(json['startTime']),
      endTime: jsonString(json['endTime']),
      status: PatientAppointmentStatus.fromApi(json['status']),
      patientName: jsonString(json['patientName']),
      dependentProfileId: jsonNullableString(json['dependentProfileId']),
      doctorId: jsonNullableString(doctor['id']),
      doctorName: formatProfessionalName(
        title: jsonNullableString(doctor['title']),
        fullName: jsonString(doctorUser['fullName']),
      ),
      doctorAvatar: jsonNullableString(doctorUser['avatar']),
      specialization: jsonNullableString(doctor['specialization']),
      departmentId: jsonNullableString(department['id']),
      departmentName: jsonNullableString(department['name']) ?? '',
      packageName: jsonNullableString(package['name']),
      reason: jsonNullableString(json['reason']),
      estimatedPrice: jsonNumber(json['estimatedPrice']),
      serviceFee: jsonNumber(json['serviceFee']),
      hasBhyt: json['hasBHYT'] == true,
      bhytDiscount: jsonNumber(json['bhytDiscount']),
      finalAmount: jsonNumber(json['finalAmount']),
      confirmedAt: jsonDateTime(json['confirmedAt']),
      cancelledAt: jsonDateTime(json['cancelledAt']),
      cancelledReason: jsonNullableString(json['cancelledReason']),
      completedAt: jsonDateTime(json['completedAt']),
      createdAt: jsonDateTime(json['createdAt']),
    );
  }

  final String id;
  final String bookingCode;
  final String appointmentDate;
  final String startTime;
  final String endTime;
  final PatientAppointmentStatus status;
  final String patientName;
  final String? dependentProfileId;
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
  final bool hasBhyt;
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
    final scheduledStart = this.scheduledStart;
    return scheduledStart != null && scheduledStart.isAfter(now);
  }

  bool get isHistory {
    if (status.isHistory) return true;
    if (status == PatientAppointmentStatus.checkedIn ||
        status == PatientAppointmentStatus.inProgress) {
      return false;
    }
    final scheduledEnd = this.scheduledEnd;
    return scheduledEnd != null && scheduledEnd.isBefore(DateTime.now());
  }

  DateTime? get scheduledStart => _scheduledDateTime(startTime);

  DateTime? get scheduledEnd => _scheduledDateTime(endTime);

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
  bool get isDependentBooking => dependentProfileId != null;
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
