import 'dart:typed_data';

import 'package:hospital_booking_mobile/core/formatters/professional_name_formatter.dart';

class MedicalFileAvailability {
  const MedicalFileAvailability({required this.available});

  factory MedicalFileAvailability.fromJson(dynamic value) {
    final json = _map(value);
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
        id: _string(json['id']),
        testName: _string(json['testName'], fallback: 'Xét nghiệm'),
        resultValue: _nullableString(json['resultValue']),
        unit: _nullableString(json['unit']),
        referenceRange: _nullableString(json['referenceRange']),
        conclusion: _nullableString(json['conclusion']),
        createdAt: _dateTime(json['createdAt']),
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
  });

  factory PatientMedicalRecord.fromJson(Map<String, dynamic> json) {
    final appointment = _map(json['appointment']);
    final doctor = _map(json['doctor']);
    final doctorUser = _map(doctor['user']);
    final department = _map(doctor['department']);
    final rawLabs = json['labResults'];
    return PatientMedicalRecord(
      id: _string(json['id']),
      recordCode: _string(json['recordCode']),
      symptoms: _nullableString(json['symptoms']),
      diagnosis: _nullableString(json['diagnosis']),
      treatment: _nullableString(json['treatment']),
      prescription: _nullableString(json['prescription']),
      status: _string(json['status']),
      publishedAt: _dateTime(json['publishedAt']),
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
      departmentName: _nullableString(department['name']),
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
