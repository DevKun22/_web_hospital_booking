import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/features/home/data/home_content_cache.dart';
import 'package:hospital_booking_mobile/features/home/data/home_repository.dart';

void main() {
  test(
    'loads all home sections through the v1 base URL and caches them',
    () async {
      final requestedPaths = <String>[];
      final dio = Dio(BaseOptions(baseUrl: 'https://example.test/api/v1'));
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            requestedPaths.add(options.path);
            final data = switch (options.path) {
              '/banners' => {
                'success': true,
                'data': {
                  'items': [
                    {
                      'id': 'banner-1',
                      'title': 'Chăm sóc toàn diện',
                      'image': 'https://example.test/banner.jpg',
                    },
                  ],
                },
              },
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
                    'user': {
                      'fullName': 'BS. CKI Nguyễn Văn An',
                      'avatar': null,
                    },
                    'department': {'name': 'Tim mạch'},
                  },
                ],
              },
              '/packages' => {
                'success': true,
                'data': [
                  {
                    'id': 'package-1',
                    'name': 'Khám tổng quát',
                    'finalPrice': 1850000,
                    'isPopular': true,
                    'isBHYTSupport': false,
                  },
                ],
              },
              '/faqs' => {
                'success': true,
                'data': {
                  'items': [
                    {
                      'id': 'faq-1',
                      'question': 'Cần chuẩn bị gì?',
                      'answer': 'Mang theo giấy tờ tùy thân.',
                    },
                  ],
                },
              },
              '/site-settings' => {
                'success': true,
                'data': {
                  'hospitalName': 'Bệnh viện kiểm thử',
                  'emergencyHotline': '1900 1080',
                },
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
      final cache = MemoryHomeContentCache();
      final repository = HomeRepository(dio: dio, cache: cache);

      final content = await repository.fetchAndCache();

      expect(requestedPaths.toSet(), {
        '/banners',
        '/departments',
        '/doctors',
        '/packages',
        '/faqs',
        '/site-settings',
      });
      expect(content.banners.single.title, 'Chăm sóc toàn diện');
      expect(content.departments.single.name, 'Tim mạch');
      expect(content.doctors.single.displayName, 'BS. CKI Nguyễn Văn An');
      expect(content.packages.single.finalPrice, 1850000);
      expect(content.faqs.single.question, 'Cần chuẩn bị gì?');
      expect(content.siteSettings.hospitalName, 'Bệnh viện kiểm thử');
      expect((await cache.read())?.doctors.single.id, 'doctor-1');

      dio.close(force: true);
    },
  );
}
