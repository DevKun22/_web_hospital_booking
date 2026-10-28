import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/providers/app_providers.dart';
import 'package:hospital_booking_mobile/features/invoices/data/patient_payment_repository.dart';
import 'package:hospital_booking_mobile/features/invoices/domain/patient_payment.dart';

final patientPaymentRepositoryProvider = Provider<PatientPaymentRepository>(
  (ref) => PatientPaymentRepository(ref.watch(authenticatedDioProvider)),
);

final patientPaymentCapabilitiesProvider = FutureProvider.autoDispose(
  (ref) => ref.watch(patientPaymentRepositoryProvider).getCapabilities(),
);

final patientPaymentControllerProvider = Provider<PatientPaymentController>(
  (ref) => PatientPaymentController(ref.watch(patientPaymentRepositoryProvider)),
);

class PatientPaymentController {
  const PatientPaymentController(this._repository);

  final PatientPaymentRepository _repository;

  Future<PatientPaymentTransaction> create({
    required String invoiceId,
    required String provider,
    required String idempotencyKey,
  }) => _repository.create(
    invoiceId: invoiceId,
    provider: provider,
    idempotencyKey: idempotencyKey,
  );

  Future<PatientPaymentTransaction> refresh(String paymentId) =>
      _repository.getById(paymentId);
}
