import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/features/appointments/data/appointment_preparation_store.dart';

final appointmentPreparationStoreProvider =
    Provider<AppointmentPreparationStore>((ref) {
      try {
        return SharedAppointmentPreparationStore();
      } catch (_) {
        return MemoryAppointmentPreparationStore();
      }
    });

final appointmentPreparationControllerProvider =
    Provider<AppointmentPreparationController>(
      (ref) => AppointmentPreparationController(
        ref.watch(appointmentPreparationStoreProvider),
      ),
    );

class AppointmentPreparationController {
  const AppointmentPreparationController(this._store);

  final AppointmentPreparationStore _store;

  Future<Set<String>> load({
    required String userId,
    required String appointmentId,
  }) => _store.read(_scope(userId, appointmentId));

  Future<void> save({
    required String userId,
    required String appointmentId,
    required Set<String> completedItemIds,
  }) => _store.write(_scope(userId, appointmentId), completedItemIds);

  String _scope(String userId, String appointmentId) =>
      '${userId.trim()}:${appointmentId.trim()}';
}
