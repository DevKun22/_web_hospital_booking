import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/providers/app_providers.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/prescriptions/data/prescriptions_repository.dart';
import 'package:hospital_booking_mobile/features/prescriptions/domain/patient_prescription.dart';

import 'package:hospital_booking_mobile/core/state/patient_list_controller.dart';
import 'package:hospital_booking_mobile/core/state/patient_list_page.dart';

final prescriptionsRepositoryProvider = Provider<PrescriptionsRepository>(
  (ref) => PrescriptionsRepository(ref.watch(authenticatedDioProvider)),
);

final prescriptionsControllerProvider =
    NotifierProvider<PrescriptionsController, PrescriptionsState>(
      PrescriptionsController.new,
    );

final prescriptionDetailProvider = FutureProvider.autoDispose
    .family<PatientPrescription, String>((ref, prescriptionId) async {
      ref.watch(authControllerProvider.select((state) => state.user?.id));
      return ref.watch(prescriptionsRepositoryProvider).getById(prescriptionId);
    });

typedef PrescriptionsState = PatientListState<PatientPrescription>;

class PrescriptionsController
    extends PatientListController<PatientPrescription> {
  @override
  String? watchPatientId() =>
      ref.watch(authControllerProvider.select((state) => state.user?.id));

  @override
  Future<PatientListPage<PatientPrescription>> fetchPage({
    required int page,
    required int limit,
  }) =>
      ref.read(prescriptionsRepositoryProvider).list(page: page, limit: limit);

  @override
  String idOf(PatientPrescription item) => item.id;
}
