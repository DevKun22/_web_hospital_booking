import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/providers/app_providers.dart';
import 'package:hospital_booking_mobile/features/booking/data/booking_submission_repository.dart';
import 'package:hospital_booking_mobile/features/booking/data/pending_booking_store.dart';
import 'package:hospital_booking_mobile/features/booking/domain/booking_catalog.dart';
import 'package:hospital_booking_mobile/features/booking/domain/booking_submission.dart';

final pendingBookingStoreProvider = Provider<PendingBookingStore>(
  (ref) => SecurePendingBookingStore(),
);

final bookingSubmissionRepositoryProvider =
    Provider<BookingSubmissionRepository>(
      (ref) => BookingSubmissionRepository(ref.watch(authDioProvider)),
    );

final bookingSubmissionControllerProvider =
    NotifierProvider<BookingSubmissionController, BookingSubmissionState>(
      BookingSubmissionController.new,
    );

enum BookingSubmissionStatus {
  restoring,
  idle,
  submitting,
  awaitingOtp,
  resendingOtp,
  verifyingOtp,
  success,
  expired,
}

class BookingSubmissionState {
  const BookingSubmissionState({
    required this.status,
    this.pending,
    this.appointment,
    this.error,
  });

  const BookingSubmissionState.idle()
    : this(status: BookingSubmissionStatus.idle);

  final BookingSubmissionStatus status;
  final PendingBooking? pending;
  final BookedAppointment? appointment;
  final ApiException? error;

  bool get isBusy =>
      status == BookingSubmissionStatus.submitting ||
      status == BookingSubmissionStatus.resendingOtp ||
      status == BookingSubmissionStatus.verifyingOtp;
}

class BookingSubmissionController extends Notifier<BookingSubmissionState> {
  bool _createInFlight = false;
  Completer<void>? _restoreCompleter;

  @override
  BookingSubmissionState build() {
    _restoreCompleter = Completer<void>();
    Future<void>.microtask(_restorePending);
    return const BookingSubmissionState(
      status: BookingSubmissionStatus.restoring,
    );
  }

  Future<void> waitUntilRestored() =>
      _restoreCompleter?.future ?? Future<void>.value();

  Future<bool> submit({
    required BookingSelection selection,
    required BookingPatientDraft patient,
  }) async {
    if (_createInFlight ||
        state.isBusy ||
        state.status == BookingSubmissionStatus.restoring ||
        state.pending != null ||
        !selection.isComplete) {
      return false;
    }
    _createInFlight = true;
    state = const BookingSubmissionState(
      status: BookingSubmissionStatus.submitting,
    );
    try {
      final pending = await ref
          .read(bookingSubmissionRepositoryProvider)
          .create(selection: selection, patient: patient);
      await _savePendingSafely(pending);
      state = BookingSubmissionState(
        status: BookingSubmissionStatus.awaitingOtp,
        pending: pending,
      );
      return true;
    } on ApiException catch (error) {
      state = BookingSubmissionState(
        status: BookingSubmissionStatus.idle,
        error: error,
      );
      return false;
    } finally {
      _createInFlight = false;
    }
  }

  Future<bool> verifyOtp(String otp) async {
    final pending = state.pending;
    if (pending == null || state.isBusy) return false;
    state = BookingSubmissionState(
      status: BookingSubmissionStatus.verifyingOtp,
      pending: pending,
    );
    try {
      final appointment = await ref
          .read(bookingSubmissionRepositoryProvider)
          .verify(pending: pending, otp: otp);
      await _clearPendingSafely();
      state = BookingSubmissionState(
        status: BookingSubmissionStatus.success,
        appointment: appointment,
      );
      return true;
    } on ApiException catch (error) {
      if (error.code == 'BOOKING_HOLD_EXPIRED' || error.statusCode == 410) {
        await _clearPendingSafely();
        state = BookingSubmissionState(
          status: BookingSubmissionStatus.expired,
          error: error,
        );
      } else {
        state = BookingSubmissionState(
          status: BookingSubmissionStatus.awaitingOtp,
          pending: pending,
          error: error,
        );
      }
      return false;
    }
  }

  Future<bool> resendOtp() async {
    final pending = state.pending;
    if (pending == null || state.isBusy) return false;
    state = BookingSubmissionState(
      status: BookingSubmissionStatus.resendingOtp,
      pending: pending,
    );
    try {
      final refreshed = await ref
          .read(bookingSubmissionRepositoryProvider)
          .resend(pending);
      await _savePendingSafely(refreshed);
      state = BookingSubmissionState(
        status: BookingSubmissionStatus.awaitingOtp,
        pending: refreshed,
      );
      return true;
    } on ApiException catch (error) {
      if (error.code == 'BOOKING_HOLD_EXPIRED' || error.statusCode == 410) {
        await _clearPendingSafely();
        state = BookingSubmissionState(
          status: BookingSubmissionStatus.expired,
          error: error,
        );
      } else {
        state = BookingSubmissionState(
          status: BookingSubmissionStatus.awaitingOtp,
          pending: pending,
          error: error,
        );
      }
      return false;
    }
  }

  Future<void> reset() async {
    await _clearPendingSafely();
    state = const BookingSubmissionState.idle();
  }

  Future<void> expirePending() async {
    final pending = state.pending;
    if (pending == null || !pending.holdExpired) return;
    await _clearPendingSafely();
    state = const BookingSubmissionState(
      status: BookingSubmissionStatus.expired,
      error: ApiException(
        kind: ApiErrorKind.conflict,
        code: 'BOOKING_HOLD_EXPIRED',
        message: 'Thời gian giữ lịch đã hết. Vui lòng chọn lại giờ khám.',
      ),
    );
  }

  void dismissError() {
    final pending = state.pending;
    state = BookingSubmissionState(
      status: pending == null
          ? BookingSubmissionStatus.idle
          : BookingSubmissionStatus.awaitingOtp,
      pending: pending,
      appointment: state.appointment,
    );
  }

  Future<void> _restorePending() async {
    try {
      final pending = await ref.read(pendingBookingStoreProvider).read();
      if (pending == null) {
        state = const BookingSubmissionState.idle();
      } else if (pending.holdExpired) {
        await _clearPendingSafely();
        state = const BookingSubmissionState(
          status: BookingSubmissionStatus.expired,
          error: ApiException(
            kind: ApiErrorKind.conflict,
            code: 'BOOKING_HOLD_EXPIRED',
            message: 'Thời gian giữ lịch đã hết. Vui lòng chọn lại giờ khám.',
          ),
        );
      } else {
        state = BookingSubmissionState(
          status: BookingSubmissionStatus.awaitingOtp,
          pending: pending,
        );
      }
    } catch (_) {
      state = const BookingSubmissionState.idle();
    } finally {
      final completer = _restoreCompleter;
      if (completer != null && !completer.isCompleted) completer.complete();
    }
  }

  Future<void> _savePendingSafely(PendingBooking pending) async {
    try {
      await ref.read(pendingBookingStoreProvider).write(pending);
    } catch (_) {
      // The server result remains authoritative for the active app session.
    }
  }

  Future<void> _clearPendingSafely() async {
    try {
      await ref.read(pendingBookingStoreProvider).clear();
    } catch (_) {
      // The in-memory state must still advance after a storage failure.
    }
  }
}
