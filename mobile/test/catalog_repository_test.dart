import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/features/catalog/data/catalog_repository.dart';

void main() {
  test('doctor catalog sends filters and decodes pagination', () async {
    RequestOptions? captured;
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test/api/v1'));
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          captured = options;
          handler.resolve(
            Response<dynamic>(
              requestOptions: options,
              statusCode: 200,
              data: {
                'success': true,
                'data': {
                  'items': [
                    {
                      'id': 'doctor-1',
                      'title': 'BS. CKI',
                      'consultationFee': 250000,
                      'user': {'fullName': 'Nguyễn Văn An'},
                      'department': {'name': 'Tim mạch'},
                      'reviewSummary': {'averageRating': 4.9, 'count': 12},
                      'todayAvailableSlots': [
                        {'startTime': '09:00', 'endTime': '09:30'},
                      ],
                    },
                  ],
                  'pagination': {
                    'page': 2,
                    'limit': 10,
                    'total': 21,
                    'totalPages': 3,
                  },
                },
              },
            ),
          );
        },
      ),
    );

    final result = await CatalogRepository(
      dio,
    ).fetchDoctors(search: 'tim', departmentId: 'department-1', page: 2);

    expect(captured?.path, '/doctors/catalog');
    expect(captured?.queryParameters['search'], 'tim');
    expect(captured?.queryParameters['departmentId'], 'department-1');
    expect(captured?.queryParameters['page'], 2);
    expect(result.total, 21);
    expect(result.hasNextPage, isTrue);
    expect(result.items.single.displayName, 'BS. CKI Nguyễn Văn An');
    expect(result.items.single.todayAvailableSlots.single.startTime, '09:00');
    dio.close(force: true);
  });

  test('package catalog only sends active optional filters', () async {
    RequestOptions? captured;
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test/api/v1'));
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          captured = options;
          handler.resolve(
            Response<dynamic>(
              requestOptions: options,
              statusCode: 200,
              data: {
                'success': true,
                'data': {
                  'items': [
                    {
                      'id': 'package-1',
                      'name': 'Gói tổng quát',
                      'slug': 'goi-tong-quat',
                      'basePrice': 1000000,
                      'serviceFee': 0,
                      'includedItemsTotal': 1000000,
                      'finalPrice': 1000000,
                      'isPopular': true,
                      'isBHYTSupport': true,
                    },
                  ],
                  'pagination': {
                    'page': 1,
                    'limit': 10,
                    'total': 1,
                    'totalPages': 1,
                  },
                },
              },
            ),
          );
        },
      ),
    );

    final result = await CatalogRepository(
      dio,
    ).fetchPackages(isBhytSupport: true);

    expect(captured?.path, '/packages/catalog');
    expect(captured?.queryParameters['isBHYTSupport'], isTrue);
    expect(captured?.queryParameters.containsKey('isPopular'), isFalse);
    expect(captured?.queryParameters.containsKey('search'), isFalse);
    expect(result.items.single.name, 'Gói tổng quát');
    expect(result.hasNextPage, isFalse);
    dio.close(force: true);
  });
}
