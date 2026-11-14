import 'package:dio/dio.dart';

import 'package:hospital_booking_mobile/core/network/api_guard.dart';

class PushRegistrationRepository {
  PushRegistrationRepository(this._dio);

  final Dio _dio;

  Future<void> register({
    required String token,
    required String platform,
    String? appVersion,
  }) async {
    return guardApi(() async {
      await _dio.put<dynamic>(
        '/auth/push-token',
        data: {
          'pushToken': token,
          'platform': platform,
          if (appVersion != null && appVersion.trim().isNotEmpty)
            'appVersion': appVersion.trim(),
        },
      );
    });
  }

  Future<void> disable() async {
    return guardApi(() async {
      await _dio.delete<dynamic>('/auth/push-token');
    });
  }
}
