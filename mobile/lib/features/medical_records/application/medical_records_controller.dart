import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/providers/app_providers.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/medical_records/data/medical_records_repository.dart';
import 'package:hospital_booking_mobile/features/medical_records/domain/patient_medical_record.dart';

import 'package:hospital_booking_mobile/core/state/patient_list_controller.dart';
import 'package:hospital_booking_mobile/core/state/patient_list_page.dart';

final medicalRecordsRepositoryProvider = Provider<MedicalRecordsRepository>(
  (ref) => MedicalRecordsRepository(ref.watch(authenticatedDioProvider)),
);

final medicalRecordsControllerProvider =
    NotifierProvider<MedicalRecordsController, MedicalRecordsState>(
      MedicalRecordsController.new,
    );

final medicalRecordDetailProvider = FutureProvider.autoDispose
    .family<PatientMedicalRecord, String>((ref, recordId) async {
      ref.watch(authControllerProvider.select((state) => state.user?.id));
      return ref.watch(medicalRecordsRepositoryProvider).getById(recordId);
    });

final medicalDocumentProvider = FutureProvider.autoDispose
    .family<MedicalDocument, MedicalDocumentRequest>((ref, request) async {
      ref.watch(authControllerProvider.select((state) => state.user?.id));
      return ref.watch(medicalRecordsRepositoryProvider).getDocument(request);
    });

typedef MedicalRecordsState = PatientListState<PatientMedicalRecord>;

class MedicalRecordsController
    extends PatientListController<PatientMedicalRecord> {
  @override
  String? watchPatientId() =>
      ref.watch(authControllerProvider.select((state) => state.user?.id));

  @override
  Future<PatientListPage<PatientMedicalRecord>> fetchPage({
    required int page,
    required int limit,
  }) =>
      ref.read(medicalRecordsRepositoryProvider).list(page: page, limit: limit);

  @override
  String idOf(PatientMedicalRecord item) => item.id;
}
