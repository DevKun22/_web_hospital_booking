import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_state.dart';
import 'package:hospital_booking_mobile/features/auth/domain/patient_user.dart';
import 'package:hospital_booking_mobile/features/invoices/application/invoices_controller.dart';
import 'package:hospital_booking_mobile/features/invoices/data/invoices_repository.dart';
import 'package:hospital_booking_mobile/features/invoices/domain/patient_invoice.dart';

const _patient = PatientUser(
  id: 'patient-1',
  fullName: 'Nguyễn Văn An',
  phone: '0912345678',
  isPhoneVerified: true,
);

PatientInvoice _invoice(String id) => PatientInvoice(
  id: id,
  invoiceCode: 'INV-$id',
  totalAmount: 250000,
  bhytDiscount: 0,
  finalAmount: 250000,
  insuranceEligibleAmount: 0,
  insuranceCoverageRate: 0,
  insuranceDiscountAmount: 0,
  status: PatientInvoiceStatus.unpaid,
  appointmentId: 'appointment-$id',
  bookingCode: 'HB-$id',
  appointmentDate: '2030-01-02',
  startTime: '09:00',
  endTime: '09:30',
  doctorName: 'BS. Nguyễn Văn Minh',
  departmentName: 'Nội khoa',
);

class _AuthenticatedController extends AuthController {
  @override
  AuthState build() =>
      const AuthState(status: AuthStatus.authenticated, user: _patient);

  void becomeGuest() => state = const AuthState.unauthenticated();
}

class _PagedRepository extends InvoicesRepository {
  _PagedRepository()
    : super(Dio(BaseOptions(baseUrl: 'https://example.test/api/v1')));

  @override
  Future<InvoicePage> list({int page = 1, int limit = 20}) async => InvoicePage(
    items: [_invoice(page.toString())],
    page: page,
    total: 2,
    hasNextPage: page == 1,
  );
}

class _DelayedRepository extends InvoicesRepository {
  _DelayedRepository()
    : super(Dio(BaseOptions(baseUrl: 'https://example.test/api/v1')));

  final gate = Completer<InvoicePage>();

  @override
  Future<InvoicePage> list({int page = 1, int limit = 20}) => gate.future;
}

void main() {
  test('loads invoices with pagination', () async {
    final container = ProviderContainer(
      overrides: [
        authControllerProvider.overrideWith(_AuthenticatedController.new),
        invoicesRepositoryProvider.overrideWithValue(_PagedRepository()),
      ],
    );
    addTearDown(container.dispose);

    container.read(invoicesControllerProvider);
    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);
    var state = container.read(invoicesControllerProvider);
    expect(state.items.map((item) => item.id), ['1']);
    expect(state.hasNextPage, isTrue);

    await container.read(invoicesControllerProvider.notifier).loadMore();
    state = container.read(invoicesControllerProvider);
    expect(state.items.map((item) => item.id), ['1', '2']);
    expect(state.hasNextPage, isFalse);
  });

  test('discards financial data that arrives after logout', () async {
    final repository = _DelayedRepository();
    final auth = _AuthenticatedController();
    final container = ProviderContainer(
      overrides: [
        authControllerProvider.overrideWith(() => auth),
        invoicesRepositoryProvider.overrideWithValue(repository),
      ],
    );
    addTearDown(container.dispose);

    container.read(invoicesControllerProvider);
    await Future<void>.delayed(Duration.zero);
    auth.becomeGuest();
    await Future<void>.delayed(Duration.zero);

    repository.gate.complete(
      InvoicePage(
        items: [_invoice('private')],
        page: 1,
        total: 1,
        hasNextPage: false,
      ),
    );
    await Future<void>.delayed(Duration.zero);

    final state = container.read(invoicesControllerProvider);
    expect(state.items, isEmpty);
    expect(state.isInitialLoading, isFalse);
  });
}
