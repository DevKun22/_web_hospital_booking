import 'package:hospital_booking_mobile/core/formatters/professional_name_formatter.dart';

class PrescriptionMedicine {
  const PrescriptionMedicine({
    required this.id,
    required this.medicineName,
    required this.sortOrder,
    this.dosage,
    this.frequency,
    this.duration,
    this.quantity,
    this.unit,
    this.instruction,
  });

  factory PrescriptionMedicine.fromJson(Map<String, dynamic> json) =>
      PrescriptionMedicine(
        id: _string(json['id']),
        medicineName: _string(
          json['medicineName'],
          fallback: 'Thuốc chưa cập nhật tên',
        ),
        dosage: _nullableString(json['dosage']),
        frequency: _nullableString(json['frequency']),
        duration: _nullableString(json['duration']),
        quantity: _nullableInteger(json['quantity']),
        unit: _nullableString(json['unit']),
        instruction: _nullableString(json['instruction']),
        sortOrder: _integer(json['sortOrder']),
      );

  final String id;
  final String medicineName;
  final String? dosage;
  final String? frequency;
  final String? duration;
  final int? quantity;
  final String? unit;
  final String? instruction;
  final int sortOrder;

  String? get quantityLabel {
    if (quantity == null) return null;
    return unit == null ? '$quantity' : '$quantity $unit';
  }

  String? get usageSummary {
    final parts = [dosage, frequency, duration].whereType<String>().toList();
    return parts.isEmpty ? null : parts.join(' · ');
  }
}

class PatientPrescription {
  const PatientPrescription({
    required this.id,
    required this.prescriptionCode,
    required this.status,
    required this.appointmentId,
    required this.bookingCode,
    required this.appointmentDate,
    required this.startTime,
    required this.endTime,
    required this.doctorName,
    required this.items,
    this.note,
    this.issuedAt,
    this.createdAt,
    this.doctorId,
    this.doctorAvatar,
    this.specialization,
  });

  factory PatientPrescription.fromJson(Map<String, dynamic> json) {
    final appointment = _map(json['appointment']);
    final doctor = _map(json['doctor']);
    final doctorUser = _map(doctor['user']);
    final rawItems = json['items'];
    return PatientPrescription(
      id: _string(json['id']),
      prescriptionCode: _string(json['prescriptionCode']),
      status: _string(json['status']),
      note: _nullableString(json['note']),
      issuedAt: _dateTime(json['issuedAt']),
      createdAt: _dateTime(json['createdAt']),
      appointmentId: _string(appointment['id']),
      bookingCode: _string(appointment['bookingCode']),
      appointmentDate: _dateOnly(appointment['appointmentDate']),
      startTime: _string(appointment['startTime']),
      endTime: _string(appointment['endTime']),
      doctorId: _nullableString(doctor['id']),
      doctorName: formatProfessionalName(
        title: _nullableString(doctor['title']),
        fullName: _string(doctorUser['fullName']),
      ),
      doctorAvatar: _nullableString(doctorUser['avatar']),
      specialization: _nullableString(doctor['specialization']),
      items: rawItems is List
          ? rawItems
                .whereType<Map>()
                .map(
                  (item) => PrescriptionMedicine.fromJson(
                    Map<String, dynamic>.from(item),
                  ),
                )
                .toList(growable: false)
          : const [],
    );
  }

  final String id;
  final String prescriptionCode;
  final String status;
  final String? note;
  final DateTime? issuedAt;
  final DateTime? createdAt;
  final String appointmentId;
  final String bookingCode;
  final String appointmentDate;
  final String startTime;
  final String endTime;
  final String? doctorId;
  final String doctorName;
  final String? doctorAvatar;
  final String? specialization;
  final List<PrescriptionMedicine> items;
}

class PrescriptionPage {
  const PrescriptionPage({
    required this.items,
    required this.page,
    required this.total,
    required this.hasNextPage,
  });

  final List<PatientPrescription> items;
  final int page;
  final int total;
  final bool hasNextPage;
}

Map<String, dynamic> _map(dynamic value) =>
    value is Map ? Map<String, dynamic>.from(value) : <String, dynamic>{};

String _string(dynamic value, {String fallback = ''}) {
  final result = value?.toString().trim();
  return result == null || result.isEmpty ? fallback : result;
}

String? _nullableString(dynamic value) {
  final result = value?.toString().trim();
  return result == null || result.isEmpty ? null : result;
}

String _dateOnly(dynamic value) {
  final raw = _string(value);
  return RegExp(r'^\d{4}-\d{2}-\d{2}').firstMatch(raw)?.group(0) ?? raw;
}

DateTime? _dateTime(dynamic value) =>
    DateTime.tryParse(value?.toString() ?? '');

int _integer(dynamic value) =>
    value is num ? value.toInt() : int.tryParse(value?.toString() ?? '') ?? 0;

int? _nullableInteger(dynamic value) => value == null
    ? null
    : value is num
    ? value.toInt()
    : int.tryParse(value.toString());
