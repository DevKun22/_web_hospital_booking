import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/features/packages/data/package_repository.dart';

void main() {
  test('loads a public package detail by slug', () async {
    final requested = <Uri>[];
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test/api/v1'));
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          requested.add(options.uri);
          handler.resolve(
            Response<dynamic>(
              requestOptions: options,
              statusCode: 200,
              data: {
                'success': true,
                'data': {
                  'id': 'package-1',
                  'name': 'Gói tim mạch',
                  'slug': 'goi-tim-mach',
                  'description': 'Tầm soát tim mạch toàn diện.',
                  'department': {'id': 'department-1', 'name': 'Tim mạch'},
                  'basePrice': 800000,
                  'serviceFee': 50000,
                  'includedItemsTotal': 800000,
                  'finalPrice': 850000,
                  'isPopular': true,
                  'isBHYTSupport': true,
                  'items': [
                    {
                      'id': 'item-1',
                      'name': 'Điện tim',
                      'price': 200000,
                      'included': true,
                      'order': 1,
                    },
                  ],
                },
              },
            ),
          );
        },
      ),
    );

    final packageItem = await PackageRepository(
      dio,
    ).fetchBySlug('goi-tim-mach');

    expect(requested.single.path, '/api/v1/packages/goi-tim-mach');
    expect(packageItem.departmentId, 'department-1');
    expect(packageItem.finalPrice, 850000);
    expect(packageItem.items.single.name, 'Điện tim');
    expect(packageItem.items.single.included, isTrue);

    dio.close(force: true);
  });
}
