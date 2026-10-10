import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/features/medical_records/data/medical_records_repository.dart';
import 'package:hospital_booking_mobile/features/medical_records/domain/patient_medical_record.dart';

Map<String, dynamic> _recordJson({String id = 'record-1'}) => {
  'id': id,
  'recordCode': 'MR-1001',
  'symptoms': 'Đau đầu',
  'diagnosis': 'Đau đầu do căng thẳng',
  'treatment': 'Nghỉ ngơi',
  'prescription': null,
  'status': 'PUBLISHED',
  'publishedAt': '2030-01-02T10:00:00.000Z',
  'createdAt': '2030-01-02T09:00:00.000Z',
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
    'department': {
      'id': 'department-1',
      'name': 'Nội khoa',
      'slug': 'noi-khoa',
    },
  },
  'labResults': [
    {
      'id': 'lab-1',
      'testName': 'Đường huyết',
      'resultValue': '5.2',
      'unit': 'mmol/L',
      'referenceRange': '3.9 - 6.4',
      'conclusion': 'Bình thường',
      'createdAt': '2030-01-02T09:30:00.000Z',
      'file': {
        'available': true,
        'downloadUrl':
            '/api/v1/me/medical-records/record-1/lab-results/lab-1/file',
      },
    },
  ],
  'resultFile': {
    'available': true,
    'downloadUrl': '/api/v1/me/medical-records/record-1/file',
  },
};

void main() {
  test('uses patient medical-record and protected file contracts', () async {
    final requests = <RequestOptions>[];
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test/api/v1'));
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          requests.add(options);
          if (options.path == '/me/medical-records/record-1/file') {
            handler.resolve(
              Response<List<int>>(
                requestOptions: options,
                statusCode: 200,
                data: const [0x25, 0x50, 0x44, 0x46],
                headers: Headers.fromMap({
                  Headers.contentTypeHeader: ['application/pdf'],
                  'content-disposition': ['inline; filename="MR-1001.pdf"'],
                }),
              ),
            );
            return;
          }
          final data = switch ((options.method, options.path)) {
            ('GET', '/me/medical-records') => {
              'success': true,
              'data': [_recordJson()],
              'meta': {
                'page': 1,
                'limit': 20,
                'total': 1,
                'totalPages': 1,
                'hasNextPage': false,
              },
            },
            ('GET', '/me/medical-records/record-1') => {
              'success': true,
              'data': _recordJson(),
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
    final repository = MedicalRecordsRepository(dio);

    final page = await repository.list();
    final detail = await repository.getById('record-1');
    final document = await repository.getDocument(
      const MedicalDocumentRequest(recordId: 'record-1'),
    );

    expect(page.total, 1);
    expect(page.hasNextPage, isFalse);
    expect(detail.doctorName, 'BS. CKI Trần Minh');
    expect(detail.departmentName, 'Nội khoa');
    expect(detail.labResults.single.displayResult, '5.2 mmol/L');
    expect(detail.labResults.single.file.available, isTrue);
    expect(document.isPdf, isTrue);
    expect(document.fileName, 'MR-1001.pdf');
    expect(requests.first.queryParameters, {'page': 1, 'limit': 20});
    expect(requests.last.responseType, ResponseType.bytes);

    dio.close(force: true);
  });
}
