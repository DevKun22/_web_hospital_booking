import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/features/booking/data/booking_catalog_repository.dart';

void main() {
  test('catalog and available slots use versioned public endpoints', () async {
    final requested = <Uri>[];
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test/api/v1'));
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          requested.add(options.uri);
          final data = switch (options.path) {
            '/departments' => {
              'success': true,
              'data': [
                {'id': 'department-1', 'name': 'Tim mạch'},
              ],
            },
            '/doctors' => {
              'success': true,
              'data': [
                {
                  'id': 'doctor-1',
                  'title': 'BS. CKI',
                  'consultationFee': 250000,
                  'user': {'fullName': 'BS. CKI Nguyễn Văn An'},
                  'department': {'id': 'department-1', 'name': 'Tim mạch'},
                },
              ],
            },
            '/packages' => {
              'success': true,
              'data': [
                {
                  'id': 'package-1',
                  'name': 'Gói tim mạch',
                  'slug': 'goi-tim-mach',
                  'department': {'id': 'department-1', 'name': 'Tim mạch'},
                  'basePrice': 800000,
                  'serviceFee': 50000,
                  'includedItemsTotal': 800000,
                  'finalPrice': 850000,
                  'isPopular': true,
                  'isBHYTSupport': true,
                  'items': [],
                },
              ],
            },
            '/doctors/doctor-1' => {
              'success': true,
              'data': {
                'id': 'doctor-1',
                'title': 'BS. CKI',
                'bio': 'Chuyên gia tim mạch.',
                'experience': 12,
                'consultationFee': 250000,
                'user': {'fullName': 'BS. CKI Nguyễn Văn An'},
                'department': {'id': 'department-1', 'name': 'Tim mạch'},
              },
            },
            '/doctors/doctor-1/available-slots' => {
              'success': true,
              'data': [
                {
                  'id': 'slot-1',
                  'date': '2030-01-02T00:00:00.000Z',
                  'startTime': '09:00',
                  'endTime': '09:30',
                },
              ],
            },
            _ => throw StateError('Unexpected path ${options.path}'),
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
    final repository = BookingCatalogRepository(dio);

    final catalog = await repository.fetchCatalog();
    final doctor = await repository.fetchDoctor('doctor-1');
    final slots = await repository.fetchAvailableSlots(
      doctorId: 'doctor-1',
      date: '2030-01-02',
    );

    expect(catalog.departments.single.name, 'Tim mạch');
    expect(catalog.doctors.single.displayName, 'BS. CKI Nguyễn Văn An');
    expect(catalog.packages.single.name, 'Gói tim mạch');
    expect(catalog.packages.single.departmentId, 'department-1');
    expect(doctor.bio, 'Chuyên gia tim mạch.');
    expect(doctor.experience, 12);
    expect(slots.single.date, '2030-01-02');
    expect(requested.last.queryParameters, {'date': '2030-01-02'});

    dio.close(force: true);
  });
}
