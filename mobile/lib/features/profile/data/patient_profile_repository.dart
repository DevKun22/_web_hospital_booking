import 'package:dio/dio.dart';
import 'package:hospital_booking_mobile/core/network/api_contract.dart';
import 'package:hospital_booking_mobile/features/profile/domain/patient_profile.dart';

import 'package:hospital_booking_mobile/core/network/api_guard.dart';

class PatientProfileRepository {
  PatientProfileRepository(this._dio);

  final Dio _dio;

  Future<PatientProfile> getProfile() async {
    return guardApi(() async {
      final response = await _dio.get<dynamic>('/me');
      return PatientProfile.fromJson(requireDataMap(response.data));
    });
  }

  Future<PatientProfile> updateProfile(PatientProfileDraft draft) async {
    return guardApi(() async {
      final response = await _dio.patch<dynamic>(
        '/me',
        data: draft.toRequestJson(),
      );
      return PatientProfile.fromJson(requireDataMap(response.data));
    });
  }
}
