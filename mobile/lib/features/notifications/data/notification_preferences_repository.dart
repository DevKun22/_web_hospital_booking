import 'package:dio/dio.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/network/api_contract.dart';
import 'package:hospital_booking_mobile/features/notifications/domain/notification_preferences.dart';

class NotificationPreferencesRepository {
  NotificationPreferencesRepository(this._dio);

  final Dio _dio;

  Future<NotificationPreferences> get() async {
    try {
      final response = await _dio.get<dynamic>('/me/notifications/preferences');
      return NotificationPreferences.fromJson(requireDataMap(response.data));
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<NotificationPreferences> update(
    NotificationPreferenceKind kind,
    bool enabled,
  ) async {
    try {
      final response = await _dio.patch<dynamic>(
        '/me/notifications/preferences',
        data: {kind.apiKey: enabled},
      );
      return NotificationPreferences.fromJson(requireDataMap(response.data));
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }
}
