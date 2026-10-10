import 'package:dio/dio.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/network/api_contract.dart';
import 'package:hospital_booking_mobile/features/profile/domain/patient_profile.dart';

class PatientProfileRepository {
  PatientProfileRepository(this._dio);

  final Dio _dio;

  Future<PatientProfile> getProfile() async {
    try {
      final response = await _dio.get<dynamic>('/me');
      return PatientProfile.fromJson(requireDataMap(response.data));
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<PatientProfile> updateProfile(PatientProfileDraft draft) async {
    try {
      final response = await _dio.patch<dynamic>(
        '/me',
        data: draft.toRequestJson(),
      );
      return PatientProfile.fromJson(requireDataMap(response.data));
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }
}
