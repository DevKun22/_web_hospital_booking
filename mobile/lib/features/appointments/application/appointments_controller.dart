import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/providers/app_providers.dart';
import 'package:hospital_booking_mobile/features/appointments/data/appointments_repository.dart';
import 'package:hospital_booking_mobile/features/appointments/domain/patient_appointment.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';

import 'package:hospital_booking_mobile/core/state/patient_list_controller.dart';
import 'package:hospital_booking_mobile/core/state/patient_list_page.dart';

final appointmentsRepositoryProvider = Provider<AppointmentsRepository>(
  (ref) => AppointmentsRepository(ref.watch(authenticatedDioProvider)),
);

final appointmentsControllerProvider =
    NotifierProvider<AppointmentsController, AppointmentsState>(
      AppointmentsController.new,
    );

final appointmentDetailProvider = FutureProvider.autoDispose
    .family<PatientAppointment, String>((ref, appointmentId) async {
      ref.watch(authControllerProvider.select((state) => state.user?.id));
      return ref.watch(appointmentsRepositoryProvider).getById(appointmentId);
    });

typedef AppointmentsState = PatientListState<PatientAppointment>;

class AppointmentsController extends PatientListController<PatientAppointment> {
  // Đổi tài khoản thì mọi yêu cầu của người trước bị bỏ (xem PatientListController), dữ liệu không lẫn giữa phiên.
  @override
  String? watchPatientId() =>
      ref.watch(authControllerProvider.select((state) => state.user?.id));

  @override
  Future<PatientListPage<PatientAppointment>> fetchPage({
    required int page,
    required int limit,
  }) => ref.read(appointmentsRepositoryProvider).list(page: page, limit: limit);

  @override
  String idOf(PatientAppointment item) => item.id;

  Future<bool> cancel({required String id, required String reason}) async {
    if (patientId == null || state.busyItemId != null) return false;
    final version = requestVersion;
    final owner = patientId;
    state = state.copyWith(busyItemId: id, clearError: true);
    try {
      final updated = await ref
          .read(appointmentsRepositoryProvider)
          .cancel(id: id, reason: reason);
      if (!isCurrent(version, owner)) {
        return false;
      }
      state = state.copyWith(
        items: [
          for (final item in state.items)
            if (item.id == id) updated else item,
        ],
        clearBusyItemId: true,
      );
      ref.invalidate(appointmentDetailProvider(id));
      return true;
    } on ApiException catch (error) {
      if (!isCurrent(version, owner)) {
        return false;
      }
      state = state.copyWith(clearBusyItemId: true, error: error);
      return false;
    }
  }
}
