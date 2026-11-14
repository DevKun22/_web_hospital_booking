import 'package:hospital_booking_mobile/core/formatters/professional_name_formatter.dart';

import 'package:hospital_booking_mobile/core/network/json_readers.dart';

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
        id: jsonText(json['id']),
        medicineName: jsonText(
          json['medicineName'],
          fallback: 'Thuốc chưa cập nhật tên',
        ),
        dosage: jsonNullableString(json['dosage']),
        frequency: jsonNullableString(json['frequency']),
        duration: jsonNullableString(json['duration']),
        quantity: _nullableInteger(json['quantity']),
        unit: jsonNullableString(json['unit']),
        instruction: jsonNullableString(json['instruction']),
        sortOrder: jsonInt(json['sortOrder']),
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
    this.patientName,
    this.dependentProfileId,
  });

  factory PatientPrescription.fromJson(Map<String, dynamic> json) {
    final appointment = jsonMap(json['appointment']);
    final doctor = jsonMap(json['doctor']);
    final doctorUser = jsonMap(doctor['user']);
    final rawItems = json['items'];
    return PatientPrescription(
      id: jsonText(json['id']),
      prescriptionCode: jsonText(json['prescriptionCode']),
      status: jsonText(json['status']),
      note: jsonNullableString(json['note']),
      issuedAt: jsonDateTime(json['issuedAt']),
      createdAt: jsonDateTime(json['createdAt']),
      appointmentId: jsonText(appointment['id']),
      bookingCode: jsonText(appointment['bookingCode']),
      patientName: jsonNullableString(appointment['patientName']),
      dependentProfileId: jsonNullableString(appointment['dependentProfileId']),
      appointmentDate: jsonDateOnly(appointment['appointmentDate']),
      startTime: jsonText(appointment['startTime']),
      endTime: jsonText(appointment['endTime']),
      doctorId: jsonNullableString(doctor['id']),
      doctorName: formatProfessionalName(
        title: jsonNullableString(doctor['title']),
        fullName: jsonText(doctorUser['fullName']),
      ),
      doctorAvatar: jsonNullableString(doctorUser['avatar']),
      specialization: jsonNullableString(doctor['specialization']),
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
  final String? patientName;
  final String? dependentProfileId;
  final String appointmentDate;
  final String startTime;
  final String endTime;
  final String? doctorId;
  final String doctorName;
  final String? doctorAvatar;
  final String? specialization;
  final List<PrescriptionMedicine> items;

  bool get isDependentPrescription => dependentProfileId != null;
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

int? _nullableInteger(dynamic value) => value == null
    ? null
    : value is num
    ? value.toInt()
    : int.tryParse(value.toString());
