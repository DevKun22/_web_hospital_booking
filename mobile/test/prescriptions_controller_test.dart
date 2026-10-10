import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_state.dart';
import 'package:hospital_booking_mobile/features/auth/domain/patient_user.dart';
import 'package:hospital_booking_mobile/features/prescriptions/application/prescriptions_controller.dart';
import 'package:hospital_booking_mobile/features/prescriptions/data/prescriptions_repository.dart';
import 'package:hospital_booking_mobile/features/prescriptions/domain/patient_prescription.dart';

const _patient = PatientUser(
  id: 'patient-1',
  fullName: 'Nguyễn Văn An',
  phone: '0912345678',
  isPhoneVerified: true,
);

PatientPrescription _prescription(String id) => PatientPrescription(
  id: id,
  prescriptionCode: 'RX-$id',
  status: 'ISSUED',
  appointmentId: 'appointment-$id',
  bookingCode: 'HB-$id',
  appointmentDate: '2030-01-02',
  startTime: '09:00',
  endTime: '09:30',
  doctorName: 'BS. Nguyễn Văn Minh',
  items: const [],
);

class _AuthenticatedController extends AuthController {
  @override
  AuthState build() =>
      const AuthState(status: AuthStatus.authenticated, user: _patient);

  void becomeGuest() => state = const AuthState.unauthenticated();
}

class _PagedRepository extends PrescriptionsRepository {
  _PagedRepository()
    : super(Dio(BaseOptions(baseUrl: 'https://example.test/api/v1')));

  @override
  Future<PrescriptionPage> list({int page = 1, int limit = 20}) async =>
      PrescriptionPage(
        items: [_prescription(page.toString())],
        page: page,
        total: 2,
        hasNextPage: page == 1,
      );
}

class _DelayedRepository extends PrescriptionsRepository {
  _DelayedRepository()
    : super(Dio(BaseOptions(baseUrl: 'https://example.test/api/v1')));

  final gate = Completer<PrescriptionPage>();

  @override
  Future<PrescriptionPage> list({int page = 1, int limit = 20}) => gate.future;
}

void main() {
  test('loads issued prescriptions with pagination', () async {
    final container = ProviderContainer(
      overrides: [
        authControllerProvider.overrideWith(_AuthenticatedController.new),
        prescriptionsRepositoryProvider.overrideWithValue(_PagedRepository()),
      ],
    );
    addTearDown(container.dispose);

    container.read(prescriptionsControllerProvider);
    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);
    var state = container.read(prescriptionsControllerProvider);
    expect(state.items.map((item) => item.id), ['1']);
    expect(state.hasNextPage, isTrue);

    await container.read(prescriptionsControllerProvider.notifier).loadMore();
    state = container.read(prescriptionsControllerProvider);
    expect(state.items.map((item) => item.id), ['1', '2']);
    expect(state.hasNextPage, isFalse);
  });

  test('discards prescription data that arrives after logout', () async {
    final repository = _DelayedRepository();
    final auth = _AuthenticatedController();
    final container = ProviderContainer(
      overrides: [
        authControllerProvider.overrideWith(() => auth),
        prescriptionsRepositoryProvider.overrideWithValue(repository),
      ],
    );
    addTearDown(container.dispose);

    container.read(prescriptionsControllerProvider);
    await Future<void>.delayed(Duration.zero);
    auth.becomeGuest();
    await Future<void>.delayed(Duration.zero);

    repository.gate.complete(
      PrescriptionPage(
        items: [_prescription('private')],
        page: 1,
        total: 1,
        hasNextPage: false,
      ),
    );
    await Future<void>.delayed(Duration.zero);

    final state = container.read(prescriptionsControllerProvider);
    expect(state.items, isEmpty);
    expect(state.isInitialLoading, isFalse);
  });
}
