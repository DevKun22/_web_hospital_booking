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
    final bannersFuture = _loadSection(
      'banner',
      () => _dio.get<dynamic>(
        '/banners',
        queryParameters: {'position': 'HOME_HERO'},
      ),
      (body) => _items(body).map(HomeBanner.fromJson).toList(growable: false),
    );
    final departmentsFuture = _loadSection(
      'chuyên khoa',
      () => _dio.get<dynamic>('/departments'),
      (body) => requireDataList(
        body,
      ).map(HomeDepartment.fromJson).toList(growable: false),
    );
    final doctorsFuture = _loadSection(
      'bác sĩ',
      () => _dio.get<dynamic>('/doctors'),
      (body) => requireDataList(
        body,
      ).map(HomeDoctor.fromJson).toList(growable: false),
    );
    final packagesFuture = _loadSection(
      'gói khám',
      () => _dio.get<dynamic>('/packages'),
      (body) => requireDataList(
        body,
      ).map(HomeMedicalPackage.fromJson).toList(growable: false),
    );
    final faqsFuture = _loadSection(
      'hỏi đáp',
      () => _dio.get<dynamic>('/faqs'),
      (body) => _items(body).map(HomeFaq.fromJson).toList(growable: false),
    );
    final settingsFuture = _loadSection(
      'thông tin bệnh viện',
      () => _dio.get<dynamic>('/site-settings'),
      (body) => HomeSiteSettings.fromJson(requireDataMap(body)),
    );

    final banners = await bannersFuture;
    final departments = await departmentsFuture;
    final doctors = await doctorsFuture;
    final packages = await packagesFuture;
    final faqs = await faqsFuture;
    final settings = await settingsFuture;
    final sections = [banners, departments, doctors, packages, faqs, settings];
    final failures = sections
        .where((section) => section.error != null)
        .toList();
    final successCount = sections.length - failures.length;

    if (successCount == 0 && fallback == null) {
      throw failures.first.error!;
    }

    final warning = failures.isEmpty
        ? null
        : ApiException(
            kind: failures.first.error!.kind,
            code: 'HOME_PARTIAL_CONTENT',
            requestId: failures.first.error!.requestId,
            message: successCount == 0
                ? 'Không thể cập nhật Trang chủ. Ứng dụng đang dùng nội dung đã lưu.'
                : 'Một số nội dung Trang chủ chưa cập nhật được: ${failures.map((item) => item.label).join(', ')}.',
          );
    final content = successCount == 0
        ? fallback!
        : HomeContent(
            banners: banners.value ?? fallback?.banners ?? const <HomeBanner>[],
            departments:
                departments.value ??
                fallback?.departments ??
                const <HomeDepartment>[],
            doctors: doctors.value ?? fallback?.doctors ?? const <HomeDoctor>[],
            packages:
                packages.value ??
                fallback?.packages ??
                const <HomeMedicalPackage>[],
            faqs: faqs.value ?? fallback?.faqs ?? const <HomeFaq>[],
            siteSettings:
                settings.value ??
                fallback?.siteSettings ??
                const HomeSiteSettings(),
            fetchedAt: DateTime.now(),
          );

    if (successCount > 0) {
      try {
        await _cache.write(content);
      } catch (_) {
        // Fresh server data remains usable even when device storage is full or
        // temporarily unavailable.
      }
    }
    return HomeFetchResult(
      content: content,
      warning: warning,
      usedFallback: fallback != null && failures.isNotEmpty,
    );
  }

  Future<_HomeSection<T>> _loadSection<T>(
    String label,
    Future<Response<dynamic>> Function() request,
    T Function(dynamic body) parse,
  ) async {
    try {
      final response = await request();
      return _HomeSection(label: label, value: parse(response.data));
    } on DioException catch (error) {
      return _HomeSection(label: label, error: ApiException.fromDio(error));
    } on ApiException catch (error) {
      return _HomeSection(label: label, error: error);
    } catch (_) {
      return _HomeSection(
        label: label,
        error: const ApiException(
          kind: ApiErrorKind.unknown,
          code: 'INVALID_API_CONTRACT',
          message: 'Phản hồi máy chủ không đúng định dạng.',
        ),
      );
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

class _HomeSection<T> {
  const _HomeSection({required this.label, this.value, this.error});

  final String label;
  final T? value;
  final ApiException? error;
}
