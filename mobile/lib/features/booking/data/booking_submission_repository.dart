import 'package:dio/dio.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/network/api_contract.dart';
import 'package:hospital_booking_mobile/features/booking/domain/booking_catalog.dart';
import 'package:hospital_booking_mobile/features/booking/domain/booking_submission.dart';

class BookingSubmissionRepository {
  BookingSubmissionRepository(this._publicDio, [Dio? authenticatedDio])
    : _authenticatedDio = authenticatedDio ?? _publicDio;

  final Dio _publicDio;
  final Dio _authenticatedDio;

  Future<PendingBooking> create({
    required BookingSelection selection,
    required BookingPatientDraft patient,
  }) async {
    try {
      final dio = patient.dependentProfileId == null
          ? _publicDio
          : _authenticatedDio;
      final response = await dio.post<dynamic>(
        '/appointments',
        data: patient.toRequestJson(selection),
      );
      final pending = PendingBooking.fromJson(requireDataMap(response.data))
          .copyWith(
            otpChannel: patient.otpChannel,
            otpTarget: patient.otpChannel == BookingOtpChannel.email
                ? patient.patientEmail?.trim()
                : patient.patientPhone.trim(),
          );
      if (pending.appointmentId.isEmpty ||
          pending.bookingCode.isEmpty ||
          pending.holdReleaseToken == null) {
        throw const ApiException(
          kind: ApiErrorKind.unknown,
          code: 'INVALID_API_CONTRACT',
          message: 'Phản hồi tạo lịch không đúng định dạng.',
        );
      }
      return pending;
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<PendingBooking> resend(PendingBooking pending) async {
    try {
      final response = await _publicDio.post<dynamic>(
        '/appointments/${pending.appointmentId}/resend-otp',
      );
      final data = requireDataMap(response.data);
      return PendingBooking(
        appointmentId: pending.appointmentId,
        bookingCode: pending.bookingCode,
        patientPhone: pending.patientPhone,
        expiresIn: _integer(data['expiresIn']),
        holdExpiresAt:
            DateTime.tryParse(data['holdExpiresAt']?.toString() ?? '') ??
            pending.holdExpiresAt,
        holdReleaseToken: pending.holdReleaseToken,
        otpDeliveryStatus: data['otpDeliveryStatus']?.toString(),
        debugOtp: data['debugOtp']?.toString(),
        otpChannel: pending.otpChannel,
        otpTarget: pending.otpTarget,
      );
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<void> abandon(PendingBooking pending) async {
    final releaseToken = pending.holdReleaseToken;
    if (releaseToken == null || releaseToken.isEmpty) {
      throw const ApiException(
        kind: ApiErrorKind.unknown,
        code: 'BOOKING_HOLD_GRANT_MISSING',
        message:
            'Lịch giữ chỗ này được tạo từ phiên bản cũ và không thể hủy ngay. Lịch sẽ tự giải phóng khi hết thời gian giữ.',
      );
    }
    try {
      await _publicDio.delete<dynamic>(
        '/appointments/${pending.appointmentId}/pending',
        data: {'holdReleaseToken': releaseToken},
      );
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<BookedAppointment> verify({
    required PendingBooking pending,
    required String otp,
  }) async {
    try {
      final response = await _publicDio.post<dynamic>(
        '/appointments/${pending.appointmentId}/verify-otp',
        data: {'otp': otp.trim()},
      );
      final appointment = BookedAppointment.fromJson(
        requireDataMap(response.data),
      );
      if (appointment.id.isEmpty || appointment.bookingCode.isEmpty) {
        throw const ApiException(
          kind: ApiErrorKind.unknown,
          code: 'INVALID_API_CONTRACT',
          message: 'Phản hồi xác nhận lịch không đúng định dạng.',
        );
      }
      return appointment;
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }
}

int _integer(dynamic value) =>
    value is num ? value.toInt() : int.tryParse(value?.toString() ?? '') ?? 0;
