import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/features/appointments/application/appointments_controller.dart';
import 'package:hospital_booking_mobile/features/appointments/domain/patient_appointment.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_state.dart';
import 'package:hospital_booking_mobile/features/auth/domain/patient_user.dart';
import 'package:hospital_booking_mobile/features/notifications/application/notifications_controller.dart';

/// Presentation-only projection for the personalized area of the home screen.
///
/// Keeping this derivation outside the widget makes the priority rules testable
/// and prevents the home screen from owning another copy of appointment logic.
final homeDashboardViewStateProvider = Provider<HomeDashboardViewState>((ref) {
  final auth = ref.watch(authControllerProvider);
  final appointments = ref.watch(appointmentsControllerProvider);
  final unreadCount = auth.isAuthenticated
      ? ref.watch(
          notificationsControllerProvider.select((state) => state.unreadCount),
        )
      : 0;

  return HomeDashboardViewState.fromSources(
    auth: auth,
    appointments: appointments.items,
    unreadNotificationCount: unreadCount,
  );
});

class HomeDashboardViewState {
  const HomeDashboardViewState({
    required this.isAuthenticated,
    required this.isOfflineBrowsing,
    required this.unreadNotificationCount,
    this.user,
    this.nextAppointment,
  });

  factory HomeDashboardViewState.fromSources({
    required AuthState auth,
    required List<PatientAppointment> appointments,
    required int unreadNotificationCount,
    DateTime? now,
  }) {
    final authenticated = auth.isAuthenticated;
    return HomeDashboardViewState(
      isAuthenticated: authenticated,
      isOfflineBrowsing: auth.status == AuthStatus.offlineBrowsing,
      user: authenticated ? auth.user : null,
      nextAppointment: authenticated
          ? selectNextActionableAppointment(appointments, now: now)
          : null,
      unreadNotificationCount: authenticated ? unreadNotificationCount : 0,
    );
  }

  final bool isAuthenticated;
  final bool isOfflineBrowsing;
  final PatientUser? user;
  final PatientAppointment? nextAppointment;
  final int unreadNotificationCount;
}

PatientAppointment? selectNextActionableAppointment(
  List<PatientAppointment> items, {
  DateTime? now,
}) {
  final reference = now ?? DateTime.now();
  final actionable =
      items
          .where((item) {
            if (item.status.isHistory ||
                item.status == PatientAppointmentStatus.pendingOtp) {
              return false;
            }
            final end = item.scheduledEnd;
            return end == null || !end.isBefore(reference);
          })
          .toList(growable: false)
        ..sort((left, right) {
          final leftStart = left.scheduledStart;
          final rightStart = right.scheduledStart;
          if (leftStart == null) return 1;
          if (rightStart == null) return -1;
          return leftStart.compareTo(rightStart);
        });
  return actionable.isEmpty ? null : actionable.first;
}
