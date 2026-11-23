import 'package:hospital_booking_mobile/core/network/json_readers.dart';

enum BookingServiceMode { doctor, package }

extension BookingServiceModeValue on BookingServiceMode {
  String get apiValue =>
      this == BookingServiceMode.package ? 'PACKAGE' : 'DOCTOR_ONLY';
}

class BookingSlot {
  const BookingSlot({
    required this.id,
    required this.date,
    required this.startTime,
    required this.endTime,
  });

  factory BookingSlot.fromJson(Map<String, dynamic> json) => BookingSlot(
    id: json['id']?.toString() ?? '',
    date: jsonDateOnly(json['date']?.toString() ?? ''),
    startTime: json['startTime']?.toString() ?? '',
    endTime: json['endTime']?.toString() ?? '',
  );

  final String id;
  final String date;
  final String startTime;
  final String endTime;
}

class BookingSelection {
  const BookingSelection({
    this.serviceMode = BookingServiceMode.doctor,
    this.packageId,
    this.departmentId,
    this.doctorId,
    this.date,
    this.slotId,
  });

  factory BookingSelection.fromJson(Map<String, dynamic> json) =>
      BookingSelection(
        serviceMode:
            json['serviceMode']?.toString().toUpperCase() == 'PACKAGE' ||
                jsonNullableString(json['packageId']) != null
            ? BookingServiceMode.package
            : BookingServiceMode.doctor,
        packageId: jsonNullableString(json['packageId']),
        departmentId: jsonNullableString(json['departmentId']),
        doctorId: jsonNullableString(json['doctorId']),
        date: jsonNullableString(json['date']),
        slotId: jsonNullableString(json['slotId']),
      );

  final BookingServiceMode serviceMode;
  final String? packageId;
  final String? departmentId;
  final String? doctorId;
  final String? date;
  final String? slotId;

  bool get isComplete =>
      (serviceMode != BookingServiceMode.package || packageId != null) &&
      departmentId != null &&
      doctorId != null &&
      date != null &&
      slotId != null;

  Map<String, dynamic> toJson() => {
    'serviceMode': serviceMode.apiValue,
    'packageId': packageId,
    'departmentId': departmentId,
    'doctorId': doctorId,
    'date': date,
    'slotId': slotId,
  };
}
