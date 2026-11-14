import 'dart:typed_data';

import 'package:hospital_booking_mobile/core/formatters/professional_name_formatter.dart';

import 'package:hospital_booking_mobile/core/network/json_readers.dart';

class MedicalFileAvailability {
  const MedicalFileAvailability({required this.available});

  factory MedicalFileAvailability.fromJson(dynamic value) {
    final json = jsonMap(value);
    return MedicalFileAvailability(available: json['available'] == true);
  }

  final bool available;
}

class PatientLabResult {
  const PatientLabResult({
    required this.id,
    required this.testName,
    required this.file,
    this.resultValue,
    this.unit,
    this.referenceRange,
    this.conclusion,
    this.createdAt,
  });

  factory PatientLabResult.fromJson(Map<String, dynamic> json) =>
      PatientLabResult(
        id: jsonText(json['id']),
        testName: jsonText(json['testName'], fallback: 'Xét nghiệm'),
        resultValue: jsonNullableString(json['resultValue']),
        unit: jsonNullableString(json['unit']),
        referenceRange: jsonNullableString(json['referenceRange']),
        conclusion: jsonNullableString(json['conclusion']),
        createdAt: jsonDateTime(json['createdAt']),
        file: MedicalFileAvailability.fromJson(json['file']),
      );

  final String id;
  final String testName;
  final String? resultValue;
  final String? unit;
  final String? referenceRange;
  final String? conclusion;
  final DateTime? createdAt;
  final MedicalFileAvailability file;

  String? get displayResult {
    if (resultValue == null) return null;
    return unit == null ? resultValue : '$resultValue $unit';
  }
}

class PatientMedicalRecord {
  const PatientMedicalRecord({
    required this.id,
    required this.recordCode,
    required this.status,
    required this.appointmentId,
    required this.bookingCode,
    required this.appointmentDate,
    required this.startTime,
    required this.endTime,
    required this.doctorName,
    required this.labResults,
    required this.resultFile,
    this.symptoms,
    this.diagnosis,
    this.treatment,
    this.prescription,
    this.doctorId,
    this.doctorAvatar,
    this.specialization,
    this.departmentName,
    this.publishedAt,
    this.createdAt,
    this.patientName,
    this.dependentProfileId,
  });

  factory PatientMedicalRecord.fromJson(Map<String, dynamic> json) {
    final appointment = jsonMap(json['appointment']);
    final doctor = jsonMap(json['doctor']);
    final doctorUser = jsonMap(doctor['user']);
    final department = jsonMap(doctor['department']);
    final rawLabs = json['labResults'];
    return PatientMedicalRecord(
      id: jsonText(json['id']),
      recordCode: jsonText(json['recordCode']),
      symptoms: jsonNullableString(json['symptoms']),
      diagnosis: jsonNullableString(json['diagnosis']),
      treatment: jsonNullableString(json['treatment']),
      prescription: jsonNullableString(json['prescription']),
      status: jsonText(json['status']),
      publishedAt: jsonDateTime(json['publishedAt']),
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
      departmentName: jsonNullableString(department['name']),
      labResults: rawLabs is List
          ? rawLabs
                .whereType<Map>()
                .map(
                  (item) => PatientLabResult.fromJson(
                    Map<String, dynamic>.from(item),
                  ),
                )
                .toList(growable: false)
          : const [],
      resultFile: MedicalFileAvailability.fromJson(json['resultFile']),
    );
  }

  final String id;
  final String recordCode;
  final String? symptoms;
  final String? diagnosis;
  final String? treatment;
  final String? prescription;
  final String status;
  final DateTime? publishedAt;
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
  final String? departmentName;
  final List<PatientLabResult> labResults;
  final MedicalFileAvailability resultFile;

  String get careUnit => departmentName ?? specialization ?? '';
  bool get isDependentRecord => dependentProfileId != null;
}

class MedicalRecordPage {
  const MedicalRecordPage({
    required this.items,
    required this.page,
    required this.total,
    required this.hasNextPage,
  });

  final List<PatientMedicalRecord> items;
  final int page;
  final int total;
  final bool hasNextPage;
}

class MedicalDocument {
  const MedicalDocument({
    required this.bytes,
    required this.contentType,
    required this.fileName,
  });

  final Uint8List bytes;
  final String contentType;
  final String fileName;

  bool get isPdf =>
      contentType.toLowerCase().contains('pdf') ||
      (bytes.length >= 4 &&
          bytes[0] == 0x25 &&
          bytes[1] == 0x50 &&
          bytes[2] == 0x44 &&
          bytes[3] == 0x46);

  bool get isImage => contentType.toLowerCase().startsWith('image/');
}

class MedicalDocumentRequest {
  const MedicalDocumentRequest({required this.recordId, this.labResultId});

  final String recordId;
  final String? labResultId;

  @override
  bool operator ==(Object other) =>
      other is MedicalDocumentRequest &&
      other.recordId == recordId &&
      other.labResultId == labResultId;

  @override
  int get hashCode => Object.hash(recordId, labResultId);
}
