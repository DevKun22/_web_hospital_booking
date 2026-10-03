import 'package:dio/dio.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/network/api_contract.dart';
import 'package:hospital_booking_mobile/features/home/data/home_content_cache.dart';
import 'package:hospital_booking_mobile/features/home/domain/home_content.dart';

class HomeRepository {
  HomeRepository({required Dio dio, required HomeContentCache cache})
    : _dio = dio,
      _cache = cache;

  final Dio _dio;
  final HomeContentCache _cache;

  Future<HomeContent?> readCached() => _cache.read();

  Future<HomeContent> fetchAndCache() async {
    try {
      final responses = await Future.wait<Response<dynamic>>([
        _dio.get<dynamic>(
          '/banners',
          queryParameters: {'position': 'HOME_HERO'},
        ),
        _dio.get<dynamic>('/departments'),
        _dio.get<dynamic>('/doctors'),
        _dio.get<dynamic>('/packages'),
        _dio.get<dynamic>('/faqs'),
        _dio.get<dynamic>('/site-settings'),
      ]);

      final content = HomeContent(
        banners: _items(
          responses[0].data,
        ).map(HomeBanner.fromJson).toList(growable: false),
        departments: requireDataList(
          responses[1].data,
        ).map(HomeDepartment.fromJson).toList(growable: false),
        doctors: requireDataList(
          responses[2].data,
        ).map(HomeDoctor.fromJson).toList(growable: false),
        packages: requireDataList(
          responses[3].data,
        ).map(HomeMedicalPackage.fromJson).toList(growable: false),
        faqs: _items(
          responses[4].data,
        ).map(HomeFaq.fromJson).toList(growable: false),
        siteSettings: HomeSiteSettings.fromJson(
          requireDataMap(responses[5].data),
        ),
        fetchedAt: DateTime.now(),
      );

      try {
        await _cache.write(content);
      } catch (_) {
        // Fresh server data remains usable even when device storage is full or
        // temporarily unavailable.
      }
      return content;
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  List<Map<String, dynamic>> _items(dynamic body) {
    final data = requireDataMap(body);
    final items = data['items'];
    if (items is! List) {
      throw const ApiException(
        kind: ApiErrorKind.unknown,
        code: 'INVALID_API_CONTRACT',
        message: 'Phản hồi máy chủ không đúng định dạng.',
      );
    }
    return items
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList(growable: false);
  }
}
