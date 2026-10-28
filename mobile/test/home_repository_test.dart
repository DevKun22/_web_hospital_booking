import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/features/home/data/home_content_cache.dart';
import 'package:hospital_booking_mobile/features/home/data/home_repository.dart';
import 'package:hospital_booking_mobile/features/home/domain/home_content.dart';

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
            if (options.path != '/public/bootstrap') {
              throw StateError('Unexpected path ${options.path}');
            }
            final data = {
              'success': true,
              'data': {
                'banners': [
                  {
                    'id': 'banner-1',
                    'title': 'Chăm sóc toàn diện',
                    'image': 'https://example.test/banner.jpg',
                  },
                ],
                'departments': [
                  {'id': 'department-1', 'name': 'Tim mạch'},
                ],
                'doctors': [
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
                'packages': [
                  {
                    'id': 'package-1',
                    'name': 'Khám tổng quát',
                    'finalPrice': 1850000,
                    'isPopular': true,
                    'isBHYTSupport': false,
                  },
                ],
                'faqs': [
                  {
                    'id': 'faq-1',
                    'question': 'Cần chuẩn bị gì?',
                    'answer': 'Mang theo giấy tờ tùy thân.',
                  },
                ],
                'siteSettings': {
                  'hospitalName': 'Bệnh viện kiểm thử',
                  'emergencyHotline': '1900 1080',
                },
              },
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

      final result = await repository.fetchAndCache();
      final content = result.content;

      expect(requestedPaths, ['/public/bootstrap']);
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

  test('uses cached home content when bootstrap request fails', () async {
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test/api/v1'));
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          handler.reject(
            DioException(
              requestOptions: options,
              type: DioExceptionType.connectionError,
            ),
          );
        },
      ),
    );
    final fallback = HomeContent(
      banners: const [],
      departments: const [],
      doctors: const [
        HomeDoctor(
          id: 'cached-doctor',
          fullName: 'Bác sĩ đã lưu',
          departmentName: 'Nội khoa',
          consultationFee: 100000,
        ),
      ],
      packages: const [],
      faqs: const [],
      siteSettings: const HomeSiteSettings(hospitalName: 'Bệnh viện cũ'),
      fetchedAt: DateTime(2029),
    );
    final repository = HomeRepository(
      dio: dio,
      cache: MemoryHomeContentCache(fallback),
    );

    final result = await repository.fetchAndCache(fallback: fallback);

    expect(result.content.banners, isEmpty);
    expect(result.content.doctors.single.id, 'cached-doctor');
    expect(result.content.siteSettings.hospitalName, 'Bệnh viện cũ');
    expect(result.warning?.code, 'HOME_FALLBACK_CONTENT');
    expect(result.usedFallback, isTrue);
    dio.close(force: true);
  });
}
