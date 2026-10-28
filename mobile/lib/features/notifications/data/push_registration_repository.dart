import 'package:dio/dio.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';

class PushRegistrationRepository {
  PushRegistrationRepository(this._dio);

  final Dio _dio;

  Future<void> register({
    required String token,
    required String platform,
    String? appVersion,
  }) async {
    try {
      await _dio.put<dynamic>(
        '/auth/push-token',
        data: {
          'pushToken': token,
          'platform': platform,
          if (appVersion != null && appVersion.trim().isNotEmpty)
            'appVersion': appVersion.trim(),
        },
      );
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<void> disable() async {
    try {
      await _dio.delete<dynamic>('/auth/push-token');
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }
}
