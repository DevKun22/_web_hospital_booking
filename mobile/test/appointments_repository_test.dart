import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/features/appointments/data/appointments_repository.dart';
import 'package:hospital_booking_mobile/features/appointments/domain/patient_appointment.dart';

Map<String, dynamic> _appointmentJson({
  String id = 'appointment-1',
  String status = 'CONFIRMED',
}) => {
  'id': id,
  'bookingCode': 'HB-1001',
  'appointmentDate': '2030-01-02T00:00:00.000Z',
  'startTime': '09:00:00',
  'endTime': '09:30:00',
  'status': status,
  'estimatedPrice': 250000,
  'serviceFee': 10000,
  'bhytDiscount': 20000,
  'finalAmount': 240000,
  'doctor': {
    'id': 'doctor-1',
    'title': 'BS. CKI',
    'specialization': 'Tim mạch can thiệp',
    'user': {
      'fullName': 'BS. CKI Trần Minh',
      'avatar': 'https://example.test/avatar.jpg',
    },
  },
  'department': {'id': 'department-1', 'name': 'Tim mạch'},
  'package': null,
};

void main() {
  test('uses authenticated patient appointment API contract', () async {
    final requests = <RequestOptions>[];
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test/api/v1'));
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          requests.add(options);
          final data = switch ((options.method, options.path)) {
            ('GET', '/me/appointments') => {
              'success': true,
              'data': [_appointmentJson()],
              'meta': {
                'page': 2,
                'limit': 20,
                'total': 21,
                'totalPages': 2,
                'hasNextPage': false,
              },
            },
            ('GET', '/me/appointments/appointment-1') => {
              'success': true,
              'data': _appointmentJson(),
            },
            ('POST', '/me/appointments/appointment-1/cancel') => {
              'success': true,
              'data': _appointmentJson(status: 'CANCELLED_BY_PATIENT'),
            },
            _ => throw StateError(
              'Unexpected request ${options.method} ${options.path}',
            ),
          };
          handler.resolve(
            Response<dynamic>(
              requestOptions: options,
              statusCode: 200,
              data: data,
            ),
          );
        },
      ),
    );
    final repository = AppointmentsRepository(dio);

    final page = await repository.list(page: 2);
    final detail = await repository.getById('appointment-1');
    final cancelled = await repository.cancel(
      id: 'appointment-1',
      reason: '  Có việc đột xuất  ',
    );

    expect(page.page, 2);
    expect(page.total, 21);
    expect(page.hasNextPage, isFalse);
    expect(page.items.single.doctorName, 'BS. CKI Trần Minh');
    expect(detail.departmentName, 'Tim mạch');
    expect(cancelled.status, PatientAppointmentStatus.cancelledByPatient);
    expect(requests.first.queryParameters, {'page': 2, 'limit': 20});
    expect(Map<String, dynamic>.from(requests.last.data as Map), {
      'reason': 'Có việc đột xuất',
    });

    dio.close(force: true);
  });
}
