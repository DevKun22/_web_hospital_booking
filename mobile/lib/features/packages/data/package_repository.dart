import 'package:dio/dio.dart';
import 'package:hospital_booking_mobile/core/network/api_contract.dart';
import 'package:hospital_booking_mobile/features/packages/domain/medical_package.dart';

import 'package:hospital_booking_mobile/core/network/api_guard.dart';

class PackageRepository {
  PackageRepository(this._dio);

  final Dio _dio;

  Future<MedicalPackage> fetchBySlug(String slug) async {
    return guardApi(() async {
      final response = await _dio.get<dynamic>(
        '/packages/${Uri.encodeComponent(slug)}',
      );
      return MedicalPackage.fromJson(requireDataMap(response.data));
    });
  }
}
