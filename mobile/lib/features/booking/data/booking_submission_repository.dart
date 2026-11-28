import 'package:dio/dio.dart';
import 'package:hospital_booking_mobile/core/config/client_platform.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/network/api_contract.dart';
import 'package:hospital_booking_mobile/features/booking/domain/booking_catalog.dart';
import 'package:hospital_booking_mobile/features/auth/domain/auth_session.dart';
import 'package:hospital_booking_mobile/features/booking/domain/booking_submission.dart';

import 'package:hospital_booking_mobile/core/network/json_readers.dart';

import 'package:hospital_booking_mobile/core/network/api_guard.dart';

class BookingSubmissionRepository {
  BookingSubmissionRepository(
    this._publicDio, [
    Dio? authenticatedDio,
    Future<String?> Function()? readDeviceId,
  ]) : _authenticatedDio = authenticatedDio ?? _publicDio,
       _readDeviceId = readDeviceId;

  final Dio _publicDio;
  final Dio _authenticatedDio;

  /// Mã thiết bị gửi kèm khi xin phiên, giống đăng nhập thường, để danh sách thiết bị nhận đúng máy này.
  final Future<String?> Function()? _readDeviceId;

  /// [authenticated]: đã đăng nhập, gửi kèm phiên để máy chủ nhận ra chủ tài khoản
  /// (đặt cho chính mình thì không cần OTP). Đặt cho người thân luôn cần phiên.
  Future<BookingCreation> create({
    required BookingSelection selection,
    required BookingPatientDraft patient,
    bool authenticated = false,
    String? termsVersion,
  }) async {
    return guardApi(() async {
      final dio = authenticated || patient.dependentProfileId != null
          ? _authenticatedDio
          : _publicDio;
      final response = await dio.post<dynamic>(
        '/appointments',
        data: {
          ...patient.toRequestJson(selection),
          // Khách chưa đăng nhập đã đồng ý điều khoản (nếu cơ sở khám đã soạn).
          if (termsVersion != null) ...{
            'termsAccepted': true,
            'termsVersion': termsVersion,
          },
        },
      );
      final data = requireDataMap(response.data);
      if (data['otpRequired'] == false) {
        final confirmed = BookedAppointment.fromJson(
          jsonMap(data['appointment']),
        );
        if (confirmed.id.isEmpty || confirmed.bookingCode.isEmpty) {
          throw const ApiException(
            kind: ApiErrorKind.unknown,
            code: 'INVALID_API_CONTRACT',
            message: 'Phản hồi tạo lịch không đúng định dạng.',
          );
        }
        return BookingCreation.confirmed(confirmed);
      }
      final pending = PendingBooking.fromJson(
        data,
      ).copyWith(otpTarget: patient.patientEmail.trim());
      if (pending.appointmentId.isEmpty ||
          pending.bookingCode.isEmpty ||
          pending.holdReleaseToken == null) {
        throw const ApiException(
          kind: ApiErrorKind.unknown,
          code: 'INVALID_API_CONTRACT',
          message: 'Phản hồi tạo lịch không đúng định dạng.',
        );
      }
      return BookingCreation.awaitingOtp(pending);
    });
  }

  Future<PendingBooking> resend(PendingBooking pending) async {
    return guardApi(() async {
      final response = await _publicDio.post<dynamic>(
        '/appointments/${pending.appointmentId}/resend-otp',
      );
      final data = requireDataMap(response.data);
      return PendingBooking(
        appointmentId: pending.appointmentId,
        bookingCode: pending.bookingCode,
        patientPhone: pending.patientPhone,
        expiresIn: jsonInt(data['expiresIn']),
        holdExpiresAt:
            DateTime.tryParse(data['holdExpiresAt']?.toString() ?? '') ??
            pending.holdExpiresAt,
        holdReleaseToken: pending.holdReleaseToken,
        otpDeliveryStatus: data['otpDeliveryStatus']?.toString(),
        debugOtp: data['debugOtp']?.toString(),
        otpTarget: pending.otpTarget,
      );
    });
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
    return guardApi(() async {
      await _publicDio.delete<dynamic>(
        '/appointments/${pending.appointmentId}/pending',
        data: {'holdReleaseToken': releaseToken},
      );
    });
  }

  /// Xác thực OTP đặt lịch. [issueSession]: xin luôn phiên người khám ([VerifiedBooking.session]) để khỏi nhập OTP lần hai;
  /// chỉ dùng khi app chưa đăng nhập, để không thay phiên của tài khoản đang dùng.
  Future<VerifiedBooking> verify({
    required PendingBooking pending,
    required String otp,
    bool issueSession = true,
  }) async {
    return guardApi(() async {
      final deviceId = issueSession ? await _readDeviceId?.call() : null;
      final response = await _publicDio.post<dynamic>(
        '/appointments/${pending.appointmentId}/verify-otp',
        data: {
          'otp': otp.trim(),
          'issueSession': issueSession,
          if (issueSession) ...{
            'platform': clientPlatform,
            'deviceName': clientDeviceName,
            'deviceId': ?deviceId,
          },
        },
      );
      final data = requireDataMap(response.data);
      final appointment = BookedAppointment.fromJson(data);
      if (appointment.id.isEmpty || appointment.bookingCode.isEmpty) {
        throw const ApiException(
          kind: ApiErrorKind.unknown,
          code: 'INVALID_API_CONTRACT',
          message: 'Phản hồi xác nhận lịch không đúng định dạng.',
        );
      }
      final rawSession = data['session'];
      final session = rawSession is Map
          ? AuthSession.fromJson(Map<String, dynamic>.from(rawSession))
          : null;
      return VerifiedBooking(
        appointment: appointment,
        session: session != null && session.isValid ? session : null,
      );
    });
  }
}

class VerifiedBooking {
  const VerifiedBooking({required this.appointment, this.session});

  final BookedAppointment appointment;
  final AuthSession? session;
}
