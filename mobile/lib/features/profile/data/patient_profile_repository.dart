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

  /// Gửi riêng những trường vừa sửa (máy chủ chỉ cập nhật trường có trong yêu cầu; null là xóa).
  Future<PatientProfile> updateProfile(Map<String, Object?> fields) async {
    return guardApi(() async {
      final response = await _dio.patch<dynamic>('/me', data: fields);
      return PatientProfile.fromJson(requireDataMap(response.data));
    });
  }
}
