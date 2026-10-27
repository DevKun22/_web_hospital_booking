import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/features/notifications/data/notifications_repository.dart';
import 'package:hospital_booking_mobile/features/notifications/domain/patient_notification.dart';

Map<String, dynamic> _notificationJson({
  String id = 'notification-1',
  String type = 'APPOINTMENT_CONFIRMED',
  bool isRead = false,
}) => {
  'id': id,
  'type': type,
  'title': 'Lịch khám đã được xác nhận',
  'body': 'Bạn có cập nhật mới về lịch khám.',
  'entityType': 'APPOINTMENT',
  'entityId': 'appointment-1',
  'publishedAt': '2030-01-02T09:00:00.000Z',
  'readAt': isRead ? '2030-01-02T09:01:00.000Z' : null,
  'isRead': isRead,
  'createdAt': '2030-01-02T09:00:00.000Z',
};

void main() {
  test('uses the protected notification inbox API contract', () async {
    final requests = <RequestOptions>[];
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test/api/v1'));
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          requests.add(options);
          final data = switch ((options.method, options.path)) {
            ('GET', '/me/notifications') => {
              'success': true,
              'data': [_notificationJson()],
              'meta': {
                'page': 2,
                'limit': 20,
                'total': 21,
                'unreadCount': 4,
                'totalPages': 2,
                'hasNextPage': false,
              },
            },
            ('GET', '/me/notifications/unread-count') => {
              'success': true,
              'data': {'unreadCount': 4},
            },
            ('PATCH', '/me/notifications/notification-1/read') => {
              'success': true,
              'data': _notificationJson(isRead: true),
            },
            ('PATCH', '/me/notifications/read-all') => {
              'success': true,
              'data': {'updatedCount': 3, 'unreadCount': 0},
            },
            _ => throw StateError(
              'Unexpected request ${options.method} ${options.path}',
            ),
          };
          handler.resolve(
            Response<dynamic>(
              requestOptions: options,
              statusCode: 200,
              data: data,
            ),
          );
        },
      ),
    );
    final repository = NotificationsRepository(dio);

    final page = await repository.list(page: 2, unreadOnly: true);
    final unreadCount = await repository.unreadCount();
    final marked = await repository.markRead('notification-1');
    final markedAll = await repository.markAllRead();

    expect(page.page, 2);
    expect(page.total, 21);
    expect(page.unreadCount, 4);
    expect(page.hasNextPage, isFalse);
    expect(
      page.items.single.type,
      PatientNotificationType.appointmentConfirmed,
    );
    final appointmentDestination = Uri.parse(
      page.items.single.safeDestination!,
    );
    expect(appointmentDestination.path, '/appointments/appointment-1');
    expect(appointmentDestination.queryParameters, {
      'origin': 'notification',
      'notificationType': 'APPOINTMENT_CONFIRMED',
      'notificationAt': '2030-01-02T09:00:00.000Z',
    });
    expect(unreadCount, 4);
    expect(marked.isRead, isTrue);
    expect(markedAll, 3);
    expect(requests.first.queryParameters, {
      'page': 2,
      'limit': 20,
      'unread': true,
    });

    dio.close(force: true);
  });

  test('never creates a route from an unknown notification payload', () {
    final unknown = PatientNotification.fromJson(
      _notificationJson(type: 'OPEN_ARBITRARY_URL')
        ..['entityType'] = 'URL'
        ..['entityId'] = 'https://malicious.example',
    );

    expect(unknown.type, PatientNotificationType.unknown);
    expect(unknown.safeDestination, isNull);
  });

  test('maps clinical and billing notifications to allowlisted routes', () {
    final cases = <(String, String, String)>[
      ('APPOINTMENT_NO_SHOW', 'APPOINTMENT', '/appointments/id-1'),
      ('APPOINTMENT_CHECKED_IN', 'APPOINTMENT', '/appointments/id-1'),
      ('APPOINTMENT_IN_PROGRESS', 'APPOINTMENT', '/appointments/id-1'),
      ('APPOINTMENT_COMPLETED', 'APPOINTMENT', '/appointments/id-1'),
      ('MEDICAL_RESULT_PUBLISHED', 'MEDICAL_RECORD', '/medical-records/id-1'),
      ('PRESCRIPTION_ISSUED', 'PRESCRIPTION', '/prescriptions/id-1'),
      ('INVOICE_CREATED', 'INVOICE', '/invoices/id-1'),
      ('PAYMENT_SUCCEEDED', 'INVOICE', '/invoices/id-1'),
      ('PAYMENT_REFUNDED', 'INVOICE', '/invoices/id-1'),
    ];

    for (final (type, entityType, destination) in cases) {
      final notification = PatientNotification.fromJson(
        _notificationJson(type: type)
          ..['entityType'] = entityType
          ..['entityId'] = 'id-1',
      );
      expect(notification.type, isNot(PatientNotificationType.unknown));
      final actual = Uri.parse(notification.safeDestination!);
      expect(actual.path, destination);
      if (entityType == 'APPOINTMENT') {
        expect(actual.queryParameters['origin'], 'notification');
        expect(actual.queryParameters['notificationType'], type);
        expect(
          actual.queryParameters['notificationAt'],
          '2030-01-02T09:00:00.000Z',
        );
      } else {
        expect(actual.hasQuery, isFalse);
      }
    }
  });

  test('rejects a known notification type with a mismatched entity', () {
    final notification = PatientNotification.fromJson(
      _notificationJson(type: 'PAYMENT_SUCCEEDED')
        ..['entityType'] = 'MEDICAL_RECORD'
        ..['entityId'] = 'id-1',
    );

    expect(notification.safeDestination, isNull);
  });
}
