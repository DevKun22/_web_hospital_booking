import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/core/config/app_config.dart';
import 'package:hospital_booking_mobile/core/providers/app_providers.dart';
import 'package:hospital_booking_mobile/features/booking/application/booking_submission_controller.dart';
import 'package:hospital_booking_mobile/features/booking/domain/booking_submission.dart';
import 'package:hospital_booking_mobile/features/booking/presentation/booking_success_screen.dart';
import 'package:hospital_booking_mobile/features/booking/presentation/booking_verify_otp_screen.dart';

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

class _SuccessfulSubmissionController extends BookingSubmissionController {
  @override
  BookingSubmissionState build() => const BookingSubmissionState(
    status: BookingSubmissionStatus.success,
    appointment: _appointment,
  );
}

class _FailedDeliveryController extends BookingSubmissionController {
  @override
  BookingSubmissionState build() => BookingSubmissionState(
    status: BookingSubmissionStatus.awaitingOtp,
    pending: PendingBooking(
      appointmentId: 'appointment-1',
      bookingCode: 'HB-1001',
      patientPhone: '0912345678',
      expiresIn: 300,
      holdExpiresAt: DateTime.now().add(const Duration(minutes: 5)),
      otpDeliveryStatus: 'FAILED',
      otpTarget: '0912345678',
    ),
  );
}

void main() {
  testWidgets('success screen explains that hospital confirmation is pending', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          bookingSubmissionControllerProvider.overrideWith(
            _SuccessfulSubmissionController.new,
          ),
        ],
        child: const MaterialApp(home: BookingSuccessScreen()),
      ),
    );

    expect(find.text('Đã tiếp nhận lịch khám'), findsOneWidget);
    expect(find.text('CHỜ BỆNH VIỆN XÁC NHẬN'), findsOneWidget);
    expect(find.text('HB-1001'), findsOneWidget);
    expect(find.text('250.000 đ'), findsOneWidget);
  });

  testWidgets(
    'OTP screen reports a failed delivery instead of staying silent',
    (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            appConfigProvider.overrideWithValue(
              AppConfig(
                environment: AppEnvironment.development,
                apiBaseUrl: 'https://example.test/api/v1',
                connectTimeout: const Duration(seconds: 10),
                receiveTimeout: const Duration(seconds: 15),
                enableNetworkLogs: false,
              ),
            ),
            bookingSubmissionControllerProvider.overrideWith(
              _FailedDeliveryController.new,
            ),
          ],
          child: const MaterialApp(home: BookingVerifyOtpScreen()),
        ),
      );

      expect(find.text('Nhập mã OTP'), findsOneWidget);
      expect(find.textContaining('Máy chủ chưa gửi được OTP'), findsOneWidget);
      expect(find.textContaining('Gửi lại mã sau'), findsOneWidget);
    },
  );
}
