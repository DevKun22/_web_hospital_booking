import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/features/booking/application/booking_submission_controller.dart';
import 'package:hospital_booking_mobile/features/booking/data/booking_submission_repository.dart';
import 'package:hospital_booking_mobile/features/booking/data/pending_booking_store.dart';
import 'package:hospital_booking_mobile/features/booking/domain/booking_catalog.dart';
import 'package:hospital_booking_mobile/features/booking/domain/booking_submission.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';

const _selection = BookingSelection(
  departmentId: 'department-1',
  doctorId: 'doctor-1',
  date: '2030-01-02',
  slotId: 'slot-1',
);

const _patient = BookingPatientDraft(
  patientName: 'Nguyễn Văn An',
  patientPhone: '0912345678',
  otpChannel: BookingOtpChannel.sms,
);

PendingBooking _pending({DateTime? expiresAt}) => PendingBooking(
  appointmentId: 'appointment-1',
  bookingCode: 'HB-1001',
  patientPhone: '0912345678',
  expiresIn: 300,
  holdExpiresAt: expiresAt ?? DateTime.now().add(const Duration(minutes: 5)),
  holdReleaseToken: 'release-token-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
);

const _appointment = BookedAppointment(
  id: 'appointment-1',
  bookingCode: 'HB-1001',
  status: 'PENDING_CONFIRM',
  patientName: 'Nguyễn Văn An',
  patientPhone: '0912345678',
  appointmentDate: '2030-01-02',
  startTime: '09:00',
  endTime: '09:30',
  doctorName: 'BS. CKI Trần Minh',
  departmentName: 'Tim mạch',
  finalAmount: 250000,
);

class _FakeSubmissionRepository extends BookingSubmissionRepository {
  _FakeSubmissionRepository({this.createGate, this.abandonError})
    : super(Dio());

  final Completer<PendingBooking>? createGate;
  final ApiException? abandonError;
  int createCalls = 0;
  int abandonCalls = 0;

  @override
  Future<PendingBooking> create({
    required BookingSelection selection,
    required BookingPatientDraft patient,
  }) async {
    createCalls += 1;
    return createGate == null ? _pending() : createGate!.future;
  }

  @override
  Future<BookedAppointment> verify({
    required PendingBooking pending,
    required String otp,
  }) async => _appointment;

  @override
  Future<void> abandon(PendingBooking pending) async {
    abandonCalls += 1;
    if (abandonError != null) throw abandonError!;
  }
}

Future<void> _waitUntil(bool Function() condition) async {
  for (var attempt = 0; attempt < 100; attempt += 1) {
    if (condition()) return;
    await Future<void>.delayed(const Duration(milliseconds: 2));
  }
  fail('Timed out waiting for submission state');
}

ProviderContainer _container({
  required MemoryPendingBookingStore store,
  required BookingSubmissionRepository repository,
}) => ProviderContainer(
  overrides: [
    pendingBookingStoreProvider.overrideWithValue(store),
    bookingSubmissionRepositoryProvider.overrideWithValue(repository),
  ],
);

void main() {
  test('duplicate taps can create only one pending appointment', () async {
    final gate = Completer<PendingBooking>();
    final repository = _FakeSubmissionRepository(createGate: gate);
    final store = MemoryPendingBookingStore();
    final container = _container(store: store, repository: repository);
    addTearDown(container.dispose);

    container.read(bookingSubmissionControllerProvider);
    await _waitUntil(
      () =>
          container.read(bookingSubmissionControllerProvider).status ==
          BookingSubmissionStatus.idle,
    );
    final controller = container.read(
      bookingSubmissionControllerProvider.notifier,
    );

    final first = controller.submit(selection: _selection, patient: _patient);
    final second = await controller.submit(
      selection: _selection,
      patient: _patient,
    );

    expect(second, isFalse);
    expect(repository.createCalls, 1);
    gate.complete(_pending());
    expect(await first, isTrue);
    expect(store.pending?.bookingCode, 'HB-1001');
  });

  test('expired restored hold is cleared before it can be resumed', () async {
    final store = MemoryPendingBookingStore(
      _pending(expiresAt: DateTime.now().subtract(const Duration(seconds: 1))),
    );
    final container = _container(
      store: store,
      repository: _FakeSubmissionRepository(),
    );
    addTearDown(container.dispose);

    container.read(bookingSubmissionControllerProvider);
    await _waitUntil(
      () =>
          container.read(bookingSubmissionControllerProvider).status ==
          BookingSubmissionStatus.expired,
    );

    expect(store.pending, isNull);
    expect(
      container.read(bookingSubmissionControllerProvider).error?.code,
      'BOOKING_HOLD_EXPIRED',
    );
  });

  test('successful OTP verification clears the secure pending state', () async {
    final store = MemoryPendingBookingStore(_pending());
    final container = _container(
      store: store,
      repository: _FakeSubmissionRepository(),
    );
    addTearDown(container.dispose);

    container.read(bookingSubmissionControllerProvider);
    await _waitUntil(
      () =>
          container.read(bookingSubmissionControllerProvider).status ==
          BookingSubmissionStatus.awaitingOtp,
    );

    final verified = await container
        .read(bookingSubmissionControllerProvider.notifier)
        .verifyOtp('123456');

    expect(verified, isTrue);
    expect(store.pending, isNull);
    expect(
      container.read(bookingSubmissionControllerProvider).appointment?.status,
      'PENDING_CONFIRM',
    );
  });

  test(
    'discard releases the server hold before clearing secure state',
    () async {
      final store = MemoryPendingBookingStore(_pending());
      final repository = _FakeSubmissionRepository();
      final container = _container(store: store, repository: repository);
      addTearDown(container.dispose);

      container.read(bookingSubmissionControllerProvider);
      await _waitUntil(
        () =>
            container.read(bookingSubmissionControllerProvider).status ==
            BookingSubmissionStatus.awaitingOtp,
      );

      final discarded = await container
          .read(bookingSubmissionControllerProvider.notifier)
          .discardPending();

      expect(discarded, isTrue);
      expect(repository.abandonCalls, 1);
      expect(store.pending, isNull);
      expect(
        container.read(bookingSubmissionControllerProvider).status,
        BookingSubmissionStatus.idle,
      );
    },
  );

  test('failed server release keeps the resumable pending hold', () async {
    final store = MemoryPendingBookingStore(_pending());
    final repository = _FakeSubmissionRepository(
      abandonError: const ApiException(
        kind: ApiErrorKind.network,
        message: 'Không thể kết nối máy chủ.',
      ),
    );
    final container = _container(store: store, repository: repository);
    addTearDown(container.dispose);

    container.read(bookingSubmissionControllerProvider);
    await _waitUntil(
      () =>
          container.read(bookingSubmissionControllerProvider).status ==
          BookingSubmissionStatus.awaitingOtp,
    );

    final discarded = await container
        .read(bookingSubmissionControllerProvider.notifier)
        .discardPending();

    expect(discarded, isFalse);
    expect(store.pending, isNotNull);
    expect(
      container.read(bookingSubmissionControllerProvider).error?.kind,
      ApiErrorKind.network,
    );
  });
}
