import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/features/prescriptions/data/prescriptions_repository.dart';

Map<String, dynamic> _prescriptionJson({String id = 'prescription-1'}) => {
  'id': id,
  'prescriptionCode': 'RX-1001',
  'status': 'ISSUED',
  'note': 'Tái khám nếu triệu chứng không giảm.',
  'issuedAt': '2030-01-02T10:00:00.000Z',
  'createdAt': '2030-01-02T09:30:00.000Z',
  'appointment': {
    'id': 'appointment-1',
    'bookingCode': 'HB-1001',
    'appointmentDate': '2030-01-02T00:00:00.000Z',
    'startTime': '09:00:00',
    'endTime': '09:30:00',
  },
  'doctor': {
    'id': 'doctor-1',
    'title': 'BS. CKI',
    'specialization': 'Nội tổng quát',
    'user': {'fullName': 'Trần Minh', 'avatar': null},
  },
  'items': [
    {
      'id': 'item-1',
      'medicineName': 'Paracetamol 500mg',
      'dosage': '1 viên',
      'frequency': 'Khi sốt hoặc đau',
      'duration': '3 ngày',
      'quantity': 10,
      'unit': 'viên',
      'instruction': 'Không dùng quá 4g/ngày.',
      'sortOrder': 1,
    },
    {
      'id': 'item-2',
      'medicineName': 'Vitamin C',
      'dosage': '1 viên',
      'frequency': 'Sau ăn sáng',
      'duration': '7 ngày',
      'quantity': 7,
      'unit': 'viên',
      'instruction': 'Uống nhiều nước.',
      'sortOrder': 2,
    },
  ],
};

void main() {
  test('uses issued patient prescription API contract', () async {
    final requests = <RequestOptions>[];
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test/api/v1'));
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          requests.add(options);
          final data = switch ((options.method, options.path)) {
            ('GET', '/me/prescriptions') => {
              'success': true,
              'data': [_prescriptionJson()],
              'meta': {
                'page': 1,
                'limit': 20,
                'total': 1,
                'totalPages': 1,
                'hasNextPage': false,
              },
            },
            ('GET', '/me/prescriptions/prescription-1') => {
              'success': true,
              'data': _prescriptionJson(),
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
    final repository = PrescriptionsRepository(dio);

    final page = await repository.list();
    final detail = await repository.getById('prescription-1');

    expect(page.total, 1);
    expect(page.hasNextPage, isFalse);
    expect(detail.doctorName, 'BS. CKI Trần Minh');
    expect(detail.appointmentDate, '2030-01-02');
    expect(detail.items.map((item) => item.medicineName), [
      'Paracetamol 500mg',
      'Vitamin C',
    ]);
    expect(
      detail.items.first.usageSummary,
      '1 viên · Khi sốt hoặc đau · 3 ngày',
    );
    expect(detail.items.first.quantityLabel, '10 viên');
    expect(requests.first.queryParameters, {'page': 1, 'limit': 20});

    dio.close(force: true);
  });
}
