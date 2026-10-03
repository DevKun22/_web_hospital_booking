import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/features/booking/data/booking_submission_repository.dart';
import 'package:hospital_booking_mobile/features/booking/domain/booking_catalog.dart';
import 'package:hospital_booking_mobile/features/booking/domain/booking_submission.dart';

void main() {
  test(
    'create, resend and verify use the versioned appointment contract',
    () async {
      final requests = <RequestOptions>[];
      final dio = Dio(BaseOptions(baseUrl: 'https://example.test/api/v1'));
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            requests.add(options);
            final data = switch (options.path) {
              '/appointments' => {
                'success': true,
                'data': {
                  'appointmentId': 'appointment-1',
                  'bookingCode': 'HB-1001',
                  'patientPhone': '0912345678',
                  'expiresIn': 300,
                  'holdExpiresAt': '2030-01-02T03:10:00.000Z',
                  'otpDeliveryStatus': 'SENT',
                  'debugOtp': '123456',
                },
              },
              '/appointments/appointment-1/resend-otp' => {
                'success': true,
                'data': {
                  'expiresIn': 300,
                  'holdExpiresAt': '2030-01-02T03:10:00.000Z',
                  'otpDeliveryStatus': 'SENT',
                  'debugOtp': '654321',
                },
              },
              '/appointments/appointment-1/verify-otp' => {
                'success': true,
                'data': {
                  'id': 'appointment-1',
                  'bookingCode': 'HB-1001',
                  'status': 'PENDING_CONFIRM',
                  'patientName': 'Nguyễn Văn An',
                  'patientPhone': '0912345678',
                  'appointmentDate': '2030-01-02T00:00:00.000Z',
                  'startTime': '09:00',
                  'endTime': '09:30',
                  'finalAmount': 250000,
                  'doctor': {
                    'title': 'BS. CKI',
                    'user': {'fullName': 'BS. CKI Trần Minh'},
                  },
                  'department': {'name': 'Tim mạch'},
                },
              },
              _ => throw StateError('Unexpected path ${options.path}'),
            };
            handler.resolve(
              Response<dynamic>(
                requestOptions: options,
                statusCode: options.path == '/appointments' ? 201 : 200,
                data: data,
              ),
            );
          },
        ),
      );
      final repository = BookingSubmissionRepository(dio);
      const selection = BookingSelection(
        departmentId: 'department-1',
        doctorId: 'doctor-1',
        date: '2030-01-02',
        slotId: 'slot-1',
      );
      const patient = BookingPatientDraft(
        patientName: 'Nguyễn Văn An',
        patientPhone: '0912345678',
        patientEmail: 'an@example.test',
        otpChannel: BookingOtpChannel.email,
      );

      final pending = await repository.create(
        selection: selection,
        patient: patient,
      );
      final resent = await repository.resend(pending);
      final appointment = await repository.verify(
        pending: resent,
        otp: '654321',
      );

      final createBody = Map<String, dynamic>.from(requests.first.data as Map);
      expect(createBody['departmentId'], 'department-1');
      expect(createBody['timeSlotId'], 'slot-1');
      expect(createBody['otpChannel'], 'EMAIL');
      expect(pending.otpTarget, 'an@example.test');
      expect(resent.debugOtp, '654321');
      expect(appointment.status, 'PENDING_CONFIRM');
      expect(appointment.doctorName, 'BS. CKI Trần Minh');
      expect(requests.map((request) => request.path), [
        '/appointments',
        '/appointments/appointment-1/resend-otp',
        '/appointments/appointment-1/verify-otp',
      ]);

      dio.close(force: true);
    },
  );
}
