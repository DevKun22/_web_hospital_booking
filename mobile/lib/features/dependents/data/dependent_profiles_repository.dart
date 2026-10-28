import 'package:dio/dio.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/network/api_contract.dart';
import 'package:hospital_booking_mobile/features/dependents/domain/dependent_profile.dart';

class DependentProfilesRepository {
  DependentProfilesRepository(this._dio);

  final Dio _dio;

  Future<List<DependentProfile>> list() async {
    try {
      final response = await _dio.get<dynamic>('/me/dependents');
      return requireDataList(
        response.data,
      ).map(DependentProfile.fromJson).toList(growable: false);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<DependentProfile> create(DependentProfileDraft draft) async {
    try {
      final response = await _dio.post<dynamic>(
        '/me/dependents',
        data: draft.toRequestJson(includeConsent: true),
      );
      return DependentProfile.fromJson(requireDataMap(response.data));
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<DependentProfile> update(
    String id,
    DependentProfileDraft draft,
  ) async {
    try {
      final response = await _dio.patch<dynamic>(
        '/me/dependents/$id',
        data: draft.toRequestJson(),
      );
      return DependentProfile.fromJson(requireDataMap(response.data));
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<void> archive(String id) async {
    try {
      await _dio.delete<dynamic>('/me/dependents/$id');
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }
}
