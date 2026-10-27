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

  Future<HomeFetchResult> fetchAndCache({HomeContent? fallback}) async {
    try {
      final response = await _dio.get<dynamic>(
        '/public/bootstrap',
        queryParameters: {'view': 'featured'},
      );
      final data = requireDataMap(response.data);
      final content = HomeContent(
        banners: _decodeItems(data['banners'], HomeBanner.fromJson),
        departments: _decodeItems(data['departments'], HomeDepartment.fromJson),
        doctors: _decodeItems(data['doctors'], HomeDoctor.fromJson),
        packages: _decodeItems(data['packages'], HomeMedicalPackage.fromJson),
        faqs: _decodeItems(data['faqs'], HomeFaq.fromJson),
        siteSettings: HomeSiteSettings.fromJson(
          Map<String, dynamic>.from(data['siteSettings'] as Map? ?? const {}),
        ),
        fetchedAt: DateTime.now(),
      );

      try {
        await _cache.write(content);
      } catch (_) {
        // Fresh server data remains usable even when device storage is full or
        // temporarily unavailable.
      }
      return HomeFetchResult(content: content, usedFallback: false);
    } on DioException catch (error) {
      return _fallbackOrThrow(ApiException.fromDio(error), fallback);
    } on ApiException catch (error) {
      return _fallbackOrThrow(error, fallback);
    } catch (_) {
      return _fallbackOrThrow(
        const ApiException(
          kind: ApiErrorKind.unknown,
          code: 'INVALID_API_CONTRACT',
          message: 'Phản hồi máy chủ không đúng định dạng.',
        ),
        fallback,
      );
    }
  }

  HomeFetchResult _fallbackOrThrow(ApiException error, HomeContent? fallback) {
    if (fallback == null) throw error;

    return HomeFetchResult(
      content: fallback,
      warning: ApiException(
        kind: error.kind,
        code: 'HOME_FALLBACK_CONTENT',
        requestId: error.requestId,
        message:
            'Không thể cập nhật Trang chủ. Ứng dụng đang dùng nội dung đã lưu.',
      ),
      usedFallback: true,
    );
  }

  List<T> _decodeItems<T>(
    dynamic value,
    T Function(Map<String, dynamic>) parse,
  ) {
    if (value is! List) {
      throw const ApiException(
        kind: ApiErrorKind.unknown,
        code: 'INVALID_API_CONTRACT',
        message: 'Phản hồi máy chủ không đúng định dạng.',
      );
    }

    return value
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .map(parse)
        .toList(growable: false);
  }
}

class HomeFetchResult {
  const HomeFetchResult({
    required this.content,
    required this.usedFallback,
    this.warning,
  });

  final HomeContent content;
  final ApiException? warning;
  final bool usedFallback;
}
