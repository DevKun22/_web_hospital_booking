import 'package:dio/dio.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/network/api_contract.dart';
import 'package:hospital_booking_mobile/features/notifications/domain/patient_notification.dart';

class NotificationsRepository {
  NotificationsRepository(this._dio);

  final Dio _dio;

  Future<NotificationPage> list({
    int page = 1,
    int limit = 20,
    bool unreadOnly = false,
  }) async {
    try {
      final response = await _dio.get<dynamic>(
        '/me/notifications',
        queryParameters: {
          'page': page,
          'limit': limit,
          if (unreadOnly) 'unread': true,
        },
      );
      final items = requireDataList(
        response.data,
      ).map(PatientNotification.fromJson).toList(growable: false);
      final body = response.data;
      final meta = body is Map ? _map(body['meta']) : const <String, dynamic>{};
      return NotificationPage(
        items: items,
        page: _integer(meta['page'], fallback: page),
        total: _integer(meta['total'], fallback: items.length),
        unreadCount: _integer(meta['unreadCount'], fallback: 0),
        hasNextPage: meta['hasNextPage'] == true,
      );
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<int> unreadCount() async {
    try {
      final response = await _dio.get<dynamic>(
        '/me/notifications/unread-count',
      );
      final data = requireDataMap(response.data);
      return _integer(data['unreadCount'], fallback: 0);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<PatientNotification> markRead(String id) async {
    try {
      final response = await _dio.patch<dynamic>(
        '/me/notifications/${Uri.encodeComponent(id)}/read',
      );
      return PatientNotification.fromJson(requireDataMap(response.data));
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<int> markAllRead() async {
    try {
      final response = await _dio.patch<dynamic>('/me/notifications/read-all');
      final data = requireDataMap(response.data);
      return _integer(data['updatedCount'], fallback: 0);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }
}

Map<String, dynamic> _map(dynamic value) =>
    value is Map ? Map<String, dynamic>.from(value) : <String, dynamic>{};

int _integer(dynamic value, {required int fallback}) => value is num
    ? value.toInt()
    : int.tryParse(value?.toString() ?? '') ?? fallback;
