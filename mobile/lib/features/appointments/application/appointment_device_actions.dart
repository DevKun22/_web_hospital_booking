import 'package:add_2_calendar/add_2_calendar.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/features/appointments/domain/patient_appointment.dart';

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
        iosParams: const IOSParams(reminder: Duration(minutes: 30)),
      ),
    );
  }

  String qrPayload(PatientAppointment appointment) =>
      'hospitalbooking://app/appointments/${Uri.encodeComponent(appointment.id)}'
      '?code=${Uri.encodeQueryComponent(appointment.bookingCode)}';
}
