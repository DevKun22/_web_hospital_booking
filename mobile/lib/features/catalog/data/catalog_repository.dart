import 'package:dio/dio.dart';
import 'package:hospital_booking_mobile/features/catalog/domain/catalog_entities.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/network/api_contract.dart';
import 'package:hospital_booking_mobile/features/catalog/domain/catalog_page.dart';
import 'package:hospital_booking_mobile/features/booking/domain/booking_catalog.dart';
import 'package:hospital_booking_mobile/features/packages/domain/medical_package.dart';

import 'package:hospital_booking_mobile/core/network/json_readers.dart';

import 'package:hospital_booking_mobile/core/network/api_guard.dart';

class CatalogRepository {
  CatalogRepository(this._dio);

  final Dio _dio;

  Future<List<BookingDepartment>> fetchDepartments() async {
    return guardApi(() async {
      final response = await _dio.get<dynamic>('/departments');
      return requireDataList(
        response.data,
      ).map(BookingDepartment.fromJson).toList(growable: false);
    });
  }

  Future<CatalogPage<CatalogDoctor>> fetchDoctors({
    String? search,
    String? departmentId,
    int page = 1,
    int limit = 10,
  }) async {
    return guardApi(() async {
      final response = await _dio.get<dynamic>(
        '/doctors/catalog',
        queryParameters: {
          'search': ?_nonEmpty(search),
          'departmentId': ?_nonEmpty(departmentId),
          'page': page,
          'limit': limit,
        },
      );
      return _decodePage(response.data, CatalogDoctor.fromJson);
    });
  }

  Future<CatalogPage<MedicalPackage>> fetchPackages({
    String? search,
    String? departmentId,
    bool? isPopular,
    bool? isBhytSupport,
    int page = 1,
    int limit = 10,
  }) async {
    return guardApi(() async {
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
    });
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
      page: jsonInt(meta['page'], fallback: 1),
      limit: jsonInt(meta['limit'], fallback: 10),
      total: jsonInt(meta['total']),
      totalPages: jsonInt(meta['totalPages']),
    );
  }
}

String? _nonEmpty(String? value) {
  final normalized = value?.trim();
  return normalized == null || normalized.isEmpty ? null : normalized;
}
