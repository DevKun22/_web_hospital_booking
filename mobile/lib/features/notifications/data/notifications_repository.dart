import 'package:dio/dio.dart';
import 'package:hospital_booking_mobile/core/network/api_contract.dart';
import 'package:hospital_booking_mobile/features/notifications/domain/patient_notification.dart';

import 'package:hospital_booking_mobile/core/network/json_readers.dart';

import 'package:hospital_booking_mobile/core/network/api_guard.dart';

class NotificationsRepository {
  NotificationsRepository(this._dio);

  final Dio _dio;

  Future<NotificationPage> list({
    int page = 1,
    int limit = 20,
    bool unreadOnly = false,
  }) async {
    return guardApi(() async {
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
      final meta = body is Map
          ? jsonMap(body['meta'])
          : const <String, dynamic>{};
      return NotificationPage(
        items: items,
        page: jsonInt(meta['page'], fallback: page),
        total: jsonInt(meta['total'], fallback: items.length),
        unreadCount: jsonInt(meta['unreadCount'], fallback: 0),
        hasNextPage: meta['hasNextPage'] == true,
      );
    });
  }

  Future<int> unreadCount() async {
    return guardApi(() async {
      final response = await _dio.get<dynamic>(
        '/me/notifications/unread-count',
      );
      final data = requireDataMap(response.data);
      return jsonInt(data['unreadCount'], fallback: 0);
    });
  }

  Future<PatientNotification> markRead(String id) async {
    return guardApi(() async {
      final response = await _dio.patch<dynamic>(
        '/me/notifications/${Uri.encodeComponent(id)}/read',
      );
      return PatientNotification.fromJson(requireDataMap(response.data));
    });
  }

  Future<int> markAllRead() async {
    return guardApi(() async {
      final response = await _dio.patch<dynamic>('/me/notifications/read-all');
      final data = requireDataMap(response.data);
      return jsonInt(data['updatedCount'], fallback: 0);
    });
  }
}
