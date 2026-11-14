import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/features/notifications/domain/push_message.dart';
import 'package:hospital_booking_mobile/features/notifications/domain/push_permission_status.dart';

final pushMessagingGatewayProvider = Provider<PushMessagingGateway>(
  (ref) => FirebasePushMessagingGateway(),
);

abstract interface class PushMessagingGateway {
  Future<PushPermissionStatus> permissionStatus();
  Future<PushPermissionStatus> requestPermission();
  Future<String?> getToken();
  Future<void> deleteToken();
  Future<bool> openNotificationSettings();
  Future<PushMessage?> getInitialMessage();
  Stream<String> get tokenRefreshes;
  Stream<PushMessage> get foregroundMessages;
  Stream<PushMessage> get openedMessages;
}

/// Chạy trong isolate riêng khi có thông báo lúc ứng dụng ở nền, nên phải tự khởi tạo Firebase.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
}

class FirebasePushMessagingGateway implements PushMessagingGateway {
  static Future<void>? _ready;

  /// Khởi tạo Firebase một lần, ngay lần đầu cần dùng (không chặn khung hình đầu tiên của ứng dụng).
  static Future<void> _ensureReady() => _ready ??= _initialize();

  static Future<void> _initialize() async {
    try {
      await Firebase.initializeApp();
      FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
    } catch (_) {
      _ready = null; // cho phép thử lại lần sau
      rethrow;
    }
  }

  static const _settingsChannel = MethodChannel(
    'dev.ngoloi.devkuncare/settings',
  );

  @override
  Future<PushPermissionStatus> permissionStatus() async {
    await _ensureReady();
    return _mapPermission(
      (await FirebaseMessaging.instance.getNotificationSettings())
          .authorizationStatus,
    );
  }

  @override
  Future<PushPermissionStatus> requestPermission() async {
    await _ensureReady();
    return _mapPermission(
      (await FirebaseMessaging.instance.requestPermission(
        alert: true,
        badge: true,
        sound: true,
        provisional: false,
      )).authorizationStatus,
    );
  }

  @override
  Future<String?> getToken() async {
    await _ensureReady();
    return FirebaseMessaging.instance.getToken();
  }

  @override
  Future<void> deleteToken() async {
    await _ensureReady();
    await FirebaseMessaging.instance.deleteToken();
  }

  @override
  Future<bool> openNotificationSettings() async {
    try {
      return await _settingsChannel.invokeMethod<bool>(
            'openNotificationSettings',
          ) ??
          false;
    } on PlatformException {
      return false;
    } on MissingPluginException {
      return false;
    }
  }

  @override
  Future<PushMessage?> getInitialMessage() async {
    await _ensureReady();
    final message = await FirebaseMessaging.instance.getInitialMessage();
    return message == null ? null : _fromRemoteMessage(message);
  }

  @override
  Stream<String> get tokenRefreshes => Stream.fromFuture(
    _ensureReady(),
  ).asyncExpand((_) => FirebaseMessaging.instance.onTokenRefresh);

  @override
  Stream<PushMessage> get foregroundMessages => Stream.fromFuture(
    _ensureReady(),
  ).asyncExpand((_) => FirebaseMessaging.onMessage).map(_fromRemoteMessage);

  @override
  Stream<PushMessage> get openedMessages => Stream.fromFuture(_ensureReady())
      .asyncExpand((_) => FirebaseMessaging.onMessageOpenedApp)
      .map(_fromRemoteMessage);
}

PushPermissionStatus _mapPermission(AuthorizationStatus status) =>
    switch (status) {
      AuthorizationStatus.authorized => PushPermissionStatus.authorized,
      AuthorizationStatus.provisional => PushPermissionStatus.provisional,
      AuthorizationStatus.denied => PushPermissionStatus.denied,
      AuthorizationStatus.deniedPermanently => PushPermissionStatus.denied,
      AuthorizationStatus.notDetermined => PushPermissionStatus.notDetermined,
    };

PushMessage _fromRemoteMessage(RemoteMessage message) => PushMessage(
  messageId:
      message.messageId ??
      '${message.sentTime?.millisecondsSinceEpoch ?? DateTime.now().millisecondsSinceEpoch}',
  title: message.notification?.title,
  body: message.notification?.body,
  data: message.data.map((key, value) => MapEntry(key, value.toString())),
);
