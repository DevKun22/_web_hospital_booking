import 'package:add_2_calendar/add_2_calendar.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/features/appointments/domain/patient_appointment.dart';
import 'package:hospital_booking_mobile/features/booking/domain/booking_submission.dart';

final appointmentDeviceActionsProvider = Provider<AppointmentDeviceActions>(
  (ref) => const AppointmentDeviceActions(),
);

class AppointmentDeviceActions {
  const AppointmentDeviceActions();

  Future<bool> addToCalendar(PatientAppointment appointment) async {
    final start = appointment.scheduledStart;
    final end = appointment.scheduledEnd;
    if (start == null || end == null) return false;

    return Add2Calendar.addEvent2Cal(
      Event(
        title: 'Lịch khám ${appointment.bookingCode}',
        description:
            'Người khám: ${appointment.patientName}\nBác sĩ: ${appointment.doctorName}\nMã lịch: ${appointment.bookingCode}',
        location: appointment.departmentName,
        startDate: start,
        endDate: end,
      ),
    );
  }

  /// Thêm lịch vừa đặt xong (chưa có bản ghi đầy đủ) vào lịch trên điện thoại.
  Future<bool> addBookedToCalendar(BookedAppointment appointment) async {
    final start = _combine(appointment.appointmentDate, appointment.startTime);
    final end = _combine(appointment.appointmentDate, appointment.endTime);
    if (start == null || end == null) return false;
    return Add2Calendar.addEvent2Cal(
      Event(
        title: 'Lịch khám ${appointment.bookingCode}',
        description:
            'Người khám: ${appointment.patientName}\nBác sĩ: ${appointment.doctorName}\nMã lịch: ${appointment.bookingCode}',
        location: appointment.departmentName,
        startDate: start,
        endDate: end,
      ),
    );
  }

  DateTime? _combine(String date, String time) {
    final day = DateTime.tryParse(date);
    final parts = time.split(':');
    if (day == null || parts.length < 2) return null;
    final hour = int.tryParse(parts[0]);
    final minute = int.tryParse(parts[1]);
    if (hour == null || minute == null) return null;
    return DateTime(day.year, day.month, day.day, hour, minute);
  }

  /// Nội dung QR vé khám: chỉ mã đặt lịch. Máy quét ở quầy (kiểu bàn phím) gõ thẳng mã vào ô tìm kiếm Lịch hẹn
  /// của khu quản trị; không chứa tên, bác sĩ hay mã nội bộ của lịch.
  String qrPayload(PatientAppointment appointment) => appointment.bookingCode;
}
