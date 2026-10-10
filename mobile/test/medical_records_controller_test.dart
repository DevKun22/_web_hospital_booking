import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_state.dart';
import 'package:hospital_booking_mobile/features/auth/domain/patient_user.dart';
import 'package:hospital_booking_mobile/features/medical_records/application/medical_records_controller.dart';
import 'package:hospital_booking_mobile/features/medical_records/data/medical_records_repository.dart';
import 'package:hospital_booking_mobile/features/medical_records/domain/patient_medical_record.dart';

const _patient = PatientUser(
  id: 'patient-1',
  fullName: 'Nguyễn Văn An',
  phone: '0912345678',
  isPhoneVerified: true,
);

PatientMedicalRecord _record(String id) => PatientMedicalRecord(
  id: id,
  recordCode: 'MR-$id',
  status: 'PUBLISHED',
  appointmentId: 'appointment-$id',
  bookingCode: 'HB-$id',
  appointmentDate: '2030-01-02',
  startTime: '09:00',
  endTime: '09:30',
  doctorName: 'BS. Nguyễn Văn Minh',
  labResults: const [],
  resultFile: const MedicalFileAvailability(available: false),
);

class _AuthenticatedController extends AuthController {
  @override
  AuthState build() =>
      const AuthState(status: AuthStatus.authenticated, user: _patient);

  void becomeGuest() => state = const AuthState.unauthenticated();
}

class _PagedRepository extends MedicalRecordsRepository {
  _PagedRepository()
    : super(Dio(BaseOptions(baseUrl: 'https://example.test/api/v1')));

  @override
  Future<MedicalRecordPage> list({int page = 1, int limit = 20}) async =>
      MedicalRecordPage(
        items: [_record(page.toString())],
        page: page,
        total: 2,
        hasNextPage: page == 1,
      );
}

class _DelayedRepository extends MedicalRecordsRepository {
  _DelayedRepository()
    : super(Dio(BaseOptions(baseUrl: 'https://example.test/api/v1')));

  final gate = Completer<MedicalRecordPage>();

  @override
  Future<MedicalRecordPage> list({int page = 1, int limit = 20}) => gate.future;
}

void main() {
  test('loads paginated published medical records', () async {
    final container = ProviderContainer(
      overrides: [
        authControllerProvider.overrideWith(_AuthenticatedController.new),
        medicalRecordsRepositoryProvider.overrideWithValue(_PagedRepository()),
      ],
    );
    addTearDown(container.dispose);

    container.read(medicalRecordsControllerProvider);
    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);
    var state = container.read(medicalRecordsControllerProvider);
    expect(state.items.map((item) => item.id), ['1']);
    expect(state.hasNextPage, isTrue);

    await container.read(medicalRecordsControllerProvider.notifier).loadMore();
    state = container.read(medicalRecordsControllerProvider);
    expect(state.items.map((item) => item.id), ['1', '2']);
    expect(state.hasNextPage, isFalse);
  });

  test('discards medical data that arrives after logout', () async {
    final repository = _DelayedRepository();
    final auth = _AuthenticatedController();
    final container = ProviderContainer(
      overrides: [
        authControllerProvider.overrideWith(() => auth),
        medicalRecordsRepositoryProvider.overrideWithValue(repository),
      ],
    );
    addTearDown(container.dispose);

    container.read(medicalRecordsControllerProvider);
    await Future<void>.delayed(Duration.zero);
    auth.becomeGuest();
    await Future<void>.delayed(Duration.zero);

    repository.gate.complete(
      MedicalRecordPage(
        items: [_record('private')],
        page: 1,
        total: 1,
        hasNextPage: false,
      ),
    );
    await Future<void>.delayed(Duration.zero);

    final state = container.read(medicalRecordsControllerProvider);
    expect(state.items, isEmpty);
    expect(state.isInitialLoading, isFalse);
  });
}
