import 'package:dio/dio.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/network/api_contract.dart';
import 'package:hospital_booking_mobile/features/catalog/domain/catalog_page.dart';
import 'package:hospital_booking_mobile/features/booking/domain/booking_catalog.dart';
import 'package:hospital_booking_mobile/features/home/domain/home_content.dart';
import 'package:hospital_booking_mobile/features/packages/domain/medical_package.dart';

class CatalogRepository {
  CatalogRepository(this._dio);

  final Dio _dio;

  Future<List<BookingDepartment>> fetchDepartments() async {
    try {
      final response = await _dio.get<dynamic>('/departments');
      return requireDataList(
        response.data,
      ).map(BookingDepartment.fromJson).toList(growable: false);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<CatalogPage<HomeDoctor>> fetchDoctors({
    String? search,
    String? departmentId,
    int page = 1,
    int limit = 10,
  }) async {
    try {
      final response = await _dio.get<dynamic>(
        '/doctors/catalog',
        queryParameters: {
          'search': ?_nonEmpty(search),
          'departmentId': ?_nonEmpty(departmentId),
          'page': page,
          'limit': limit,
        },
      );
      return _decodePage(response.data, HomeDoctor.fromJson);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<CatalogPage<MedicalPackage>> fetchPackages({
    String? search,
    String? departmentId,
    bool? isPopular,
    bool? isBhytSupport,
    int page = 1,
    int limit = 10,
  }) async {
    try {
      final response = await _dio.get<dynamic>(
        '/packages/catalog',
        queryParameters: {
          'search': ?_nonEmpty(search),
          'departmentId': ?_nonEmpty(departmentId),
          'isPopular': ?isPopular,
          'isBHYTSupport': ?isBhytSupport,
          'page': page,
          'limit': limit,
        },
      );
      return _decodePage(response.data, MedicalPackage.fromJson);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  CatalogPage<T> _decodePage<T>(
    dynamic body,
    T Function(Map<String, dynamic>) decode,
  ) {
    final data = requireDataMap(body);
    final rawItems = data['items'];
    final pagination = data['pagination'];
    if (rawItems is! List || pagination is! Map) {
      throw const ApiException(
        kind: ApiErrorKind.unknown,
        code: 'INVALID_API_CONTRACT',
        message: 'Phản hồi danh mục không đúng định dạng.',
      );
    }
    final meta = Map<String, dynamic>.from(pagination);
    return CatalogPage<T>(
      items: rawItems
          .whereType<Map>()
          .map((item) => decode(Map<String, dynamic>.from(item)))
          .toList(growable: false),
      page: _integer(meta['page'], fallback: 1),
      limit: _integer(meta['limit'], fallback: 10),
      total: _integer(meta['total']),
      totalPages: _integer(meta['totalPages']),
    );
  }
}

String? _nonEmpty(String? value) {
  final normalized = value?.trim();
  return normalized == null || normalized.isEmpty ? null : normalized;
}

int _integer(dynamic value, {int fallback = 0}) => value is num
    ? value.toInt()
    : int.tryParse(value?.toString() ?? '') ?? fallback;
