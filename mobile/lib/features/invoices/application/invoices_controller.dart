import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/providers/app_providers.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/invoices/data/invoices_repository.dart';
import 'package:hospital_booking_mobile/features/invoices/domain/patient_invoice.dart';

import 'package:hospital_booking_mobile/core/state/patient_list_controller.dart';
import 'package:hospital_booking_mobile/core/state/patient_list_page.dart';

final invoicesRepositoryProvider = Provider<InvoicesRepository>(
  (ref) => InvoicesRepository(ref.watch(authenticatedDioProvider)),
);

final invoicesControllerProvider =
    NotifierProvider<InvoicesController, InvoicesState>(InvoicesController.new);

final invoiceDetailProvider = FutureProvider.autoDispose
    .family<PatientInvoice, String>((ref, invoiceId) async {
      ref.watch(authControllerProvider.select((state) => state.user?.id));
      return ref.watch(invoicesRepositoryProvider).getById(invoiceId);
    });

typedef InvoicesState = PatientListState<PatientInvoice>;

class InvoicesController extends PatientListController<PatientInvoice> {
  @override
  String? watchPatientId() =>
      ref.watch(authControllerProvider.select((state) => state.user?.id));

  @override
  Future<PatientListPage<PatientInvoice>> fetchPage({
    required int page,
    required int limit,
  }) => ref.read(invoicesRepositoryProvider).list(page: page, limit: limit);

  @override
  String idOf(PatientInvoice item) => item.id;
}
