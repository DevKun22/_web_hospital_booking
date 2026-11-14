import 'package:dio/dio.dart';
import 'package:hospital_booking_mobile/core/network/api_contract.dart';
import 'package:hospital_booking_mobile/features/dependents/domain/dependent_profile.dart';

import 'package:hospital_booking_mobile/core/network/api_guard.dart';

class DependentProfilesRepository {
  DependentProfilesRepository(this._dio);

  final Dio _dio;

  Future<List<DependentProfile>> list() async {
    return guardApi(() async {
      final response = await _dio.get<dynamic>('/me/dependents');
      return requireDataList(
        response.data,
      ).map(DependentProfile.fromJson).toList(growable: false);
    });
  }

  Future<DependentProfile> create(DependentProfileDraft draft) async {
    return guardApi(() async {
      final response = await _dio.post<dynamic>(
        '/me/dependents',
        data: draft.toRequestJson(includeConsent: true),
      );
      return DependentProfile.fromJson(requireDataMap(response.data));
    });
  }

  Future<DependentProfile> update(
    String id,
    DependentProfileDraft draft,
  ) async {
    return guardApi(() async {
      final response = await _dio.patch<dynamic>(
        '/me/dependents/$id',
        data: draft.toRequestJson(),
      );
      return DependentProfile.fromJson(requireDataMap(response.data));
    });
  }

  Future<void> archive(String id) async {
    return guardApi(() async {
      await _dio.delete<dynamic>('/me/dependents/$id');
    });
  }
}
