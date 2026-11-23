import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/features/appointments/application/appointments_controller.dart';
import 'package:hospital_booking_mobile/features/appointments/data/appointments_repository.dart';
import 'package:hospital_booking_mobile/features/appointments/domain/patient_appointment.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_state.dart';
import 'package:hospital_booking_mobile/features/auth/domain/patient_user.dart';

const _patient = PatientUser(
  id: 'patient-1',
  fullName: 'Nguyễn Văn An',
  phone: '0912345678',
  isEmailVerified: true,
);

PatientAppointment _appointment(
  String id, {
  PatientAppointmentStatus status = PatientAppointmentStatus.confirmed,
  String appointmentDate = '2030-01-02',
}) => PatientAppointment(
  id: id,
  bookingCode: 'HB-$id',
  appointmentDate: appointmentDate,
  startTime: '09:00',
  endTime: '09:30',
  status: status,
  doctorName: 'BS. Nguyễn Văn Minh',
  departmentName: 'Tim mạch',
  finalAmount: 250000,
);

class _AuthenticatedController extends AuthController {
  @override
  AuthState build() =>
      const AuthState(status: AuthStatus.authenticated, user: _patient);

  void becomeGuest() => state = const AuthState.unauthenticated();
}

class _FakeAppointmentsRepository extends AppointmentsRepository {
  _FakeAppointmentsRepository()
    : super(Dio(BaseOptions(baseUrl: 'https://example.test/api/v1')));

  int cancelCalls = 0;
  int listCalls = 0;
  Completer<PatientAppointment>? cancelGate;

  @override
  Future<AppointmentPage> list({int page = 1, int limit = 20}) async {
    listCalls += 1;
    return AppointmentPage(
      items: page == 1 ? [_appointment('1')] : [_appointment('2')],
      page: page,
      total: 2,
      hasNextPage: page == 1,
    );
  }

  @override
  Future<PatientAppointment> cancel({
    required String id,
    required String reason,
  }) {
    cancelCalls += 1;
    return (cancelGate ??= Completer<PatientAppointment>()).future;
  }
}

class _DelayedAppointmentsRepository extends AppointmentsRepository {
  _DelayedAppointmentsRepository()
    : super(Dio(BaseOptions(baseUrl: 'https://example.test/api/v1')));

  final gate = Completer<AppointmentPage>();

  @override
  Future<AppointmentPage> list({int page = 1, int limit = 20}) => gate.future;
}

void main() {
  test('classifies stale active statuses by their scheduled time', () {
    expect(
      _appointment('past', appointmentDate: '2020-01-02').isHistory,
      isTrue,
    );
    expect(_appointment('future').isHistory, isFalse);
    final today = DateTime.now().toUtc().add(const Duration(hours: 7));
    final todayText =
        '${today.year.toString().padLeft(4, '0')}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';
    expect(
      _appointment(
        'ongoing',
        status: PatientAppointmentStatus.inProgress,
        appointmentDate: todayText,
      ).isHistory,
      isFalse,
      reason: 'A visit in progress today stays actionable even after its slot.',
    );
    expect(
      _appointment(
        'stale-check-in',
        status: PatientAppointmentStatus.checkedIn,
        appointmentDate: '2020-01-02',
      ).isHistory,
      isTrue,
      reason: 'A check-in from a previous day that nobody closed is history.',
    );
  });

  test('only allows cancellation before a cancellable appointment starts', () {
    final now = DateTime(2030, 1, 2, 8, 59);
    final appointment = _appointment('future');

    expect(appointment.canCancelAt(now), isTrue);
    expect(
      appointment.canCancelAt(DateTime(2030, 1, 2, 9)),
      isFalse,
      reason: 'Cancellation closes as soon as the visit starts.',
    );
    expect(
      _appointment(
        'completed',
        status: PatientAppointmentStatus.completed,
      ).canCancelAt(now),
      isFalse,
    );
  });

  test(
    'uses the server cancel deadline instead of guessing from the start time',
    () {
      final appointment = PatientAppointment.fromJson({
        'id': 'a1',
        'bookingCode': 'BK1',
        'appointmentDate': '2030-01-02',
        'startTime': '09:00',
        'endTime': '09:30',
        'status': 'CONFIRMED',
        // Chính sách khóa hủy 2 giờ: mốc là 07:00 theo giờ địa phương của máy chủ trả về.
        'cancelDeadline': DateTime(2030, 1, 2, 7).toUtc().toIso8601String(),
      });

      expect(appointment.canCancelAt(DateTime(2030, 1, 2, 6, 59)), isTrue);
      expect(
        appointment.canCancelAt(DateTime(2030, 1, 2, 7, 1)),
        isFalse,
        reason: 'Within the cutoff the server rejects cancellation.',
      );
    },
  );

  test(
    'loads pages without duplicates and prevents duplicate cancellation',
    () async {
      final repository = _FakeAppointmentsRepository();
      final container = ProviderContainer(
        overrides: [
          authControllerProvider.overrideWith(_AuthenticatedController.new),
          appointmentsRepositoryProvider.overrideWithValue(repository),
        ],
      );
      addTearDown(container.dispose);

      container.read(appointmentsControllerProvider);
      await Future<void>.delayed(Duration.zero);
      await Future<void>.delayed(Duration.zero);

      var state = container.read(appointmentsControllerProvider);
      expect(state.items.map((item) => item.id), ['1']);
      expect(state.hasNextPage, isTrue);

      await container.read(appointmentsControllerProvider.notifier).loadMore();
      state = container.read(appointmentsControllerProvider);
      expect(state.items.map((item) => item.id), ['1', '2']);
      expect(state.hasNextPage, isFalse);

      final controller = container.read(
        appointmentsControllerProvider.notifier,
      );
      final firstCancellation = controller.cancel(
        id: '1',
        reason: 'Có việc đột xuất',
      );
      await Future<void>.delayed(Duration.zero);
      final duplicateResult = await controller.cancel(
        id: '1',
        reason: 'Bấm lần hai',
      );

      expect(duplicateResult, isFalse);
      expect(repository.cancelCalls, 1);

      repository.cancelGate!.complete(
        _appointment('1', status: PatientAppointmentStatus.cancelledByPatient),
      );
      expect(await firstCancellation, isTrue);
      expect(
        container.read(appointmentsControllerProvider).items.first.status,
        PatientAppointmentStatus.cancelledByPatient,
      );
    },
  );

  test('refreshes only after the appointment snapshot becomes stale', () async {
    final repository = _FakeAppointmentsRepository();
    final container = ProviderContainer(
      overrides: [
        authControllerProvider.overrideWith(_AuthenticatedController.new),
        appointmentsRepositoryProvider.overrideWithValue(repository),
      ],
    );
    addTearDown(container.dispose);

    container.read(appointmentsControllerProvider);
    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);
    expect(repository.listCalls, 1);

    final controller = container.read(appointmentsControllerProvider.notifier);
    await controller.refreshIfStale(maxAge: const Duration(hours: 1));
    expect(repository.listCalls, 1);

    await controller.refreshIfStale(maxAge: Duration.zero);
    expect(repository.listCalls, 2);
    expect(
      container.read(appointmentsControllerProvider).lastSyncedAt,
      isNotNull,
    );
  });

  test('discards protected results that arrive after logout', () async {
    final repository = _DelayedAppointmentsRepository();
    final auth = _AuthenticatedController();
    final container = ProviderContainer(
      overrides: [
        authControllerProvider.overrideWith(() => auth),
        appointmentsRepositoryProvider.overrideWithValue(repository),
      ],
    );
    addTearDown(container.dispose);

    container.read(appointmentsControllerProvider);
    await Future<void>.delayed(Duration.zero);
    auth.becomeGuest();
    await Future<void>.delayed(Duration.zero);

    repository.gate.complete(
      AppointmentPage(
        items: [_appointment('private')],
        page: 1,
        total: 1,
        hasNextPage: false,
      ),
    );
    await Future<void>.delayed(Duration.zero);

    final state = container.read(appointmentsControllerProvider);
    expect(state.items, isEmpty);
    expect(state.isInitialLoading, isFalse);
  });
}
