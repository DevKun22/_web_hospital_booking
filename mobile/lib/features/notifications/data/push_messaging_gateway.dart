import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/features/notifications/domain/push_message.dart';

final pushMessagingGatewayProvider = Provider<PushMessagingGateway>(
  (ref) => FirebasePushMessagingGateway(),
);

enum PushPermissionStatus {
  unknown,
  notDetermined,
  denied,
  authorized,
  provisional,
}

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

class FirebasePushMessagingGateway implements PushMessagingGateway {
  static const _settingsChannel = MethodChannel(
    'com.hospitalbooking.hospital_booking_mobile/settings',
  );

  @override
  Future<PushPermissionStatus> permissionStatus() async => _mapPermission(
    (await FirebaseMessaging.instance.getNotificationSettings())
        .authorizationStatus,
  );

  @override
  Future<PushPermissionStatus> requestPermission() async => _mapPermission(
    (await FirebaseMessaging.instance.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
    )).authorizationStatus,
  );

  @override
  Future<String?> getToken() => FirebaseMessaging.instance.getToken();

  @override
  Future<void> deleteToken() => FirebaseMessaging.instance.deleteToken();

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
    final message = await FirebaseMessaging.instance.getInitialMessage();
    return message == null ? null : _fromRemoteMessage(message);
  }

  @override
  Stream<String> get tokenRefreshes =>
      FirebaseMessaging.instance.onTokenRefresh;

  @override
  Stream<PushMessage> get foregroundMessages =>
      FirebaseMessaging.onMessage.map(_fromRemoteMessage);

  @override
  Stream<PushMessage> get openedMessages =>
      FirebaseMessaging.onMessageOpenedApp.map(_fromRemoteMessage);
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
