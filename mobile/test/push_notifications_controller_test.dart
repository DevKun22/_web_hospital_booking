import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/core/providers/app_providers.dart';
import 'package:hospital_booking_mobile/core/storage/app_preferences.dart';
import 'package:hospital_booking_mobile/core/sync/patient_data_sync_coordinator.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_state.dart';
import 'package:hospital_booking_mobile/features/auth/domain/patient_user.dart';
import 'package:hospital_booking_mobile/features/notifications/application/notifications_controller.dart';
import 'package:hospital_booking_mobile/features/notifications/application/push_notifications_controller.dart';
import 'package:hospital_booking_mobile/features/notifications/data/notifications_repository.dart';
import 'package:hospital_booking_mobile/features/notifications/data/push_messaging_gateway.dart';
import 'package:hospital_booking_mobile/features/notifications/data/push_registration_repository.dart';
import 'package:hospital_booking_mobile/features/notifications/domain/patient_notification.dart';
import 'package:hospital_booking_mobile/features/notifications/domain/push_message.dart';

const _patient = PatientUser(
  id: 'patient-1',
  fullName: 'Nguyễn Văn An',
  phone: '0912345678',
  isPhoneVerified: true,
);

class _AuthenticatedController extends AuthController {
  @override
  AuthState build() =>
      const AuthState(status: AuthStatus.authenticated, user: _patient);
}

class _FakeGateway implements PushMessagingGateway {
  final tokenController = StreamController<String>.broadcast();
  final foregroundController = StreamController<PushMessage>.broadcast();
  final openedController = StreamController<PushMessage>.broadcast();

  PushPermissionStatus currentPermission = PushPermissionStatus.denied;
  PushPermissionStatus requestedPermission = PushPermissionStatus.authorized;
  int requestCalls = 0;
  int openSettingsCalls = 0;
  bool opensSettings = true;
  String? token = 'fcm-token-initial-0000001';
  PushMessage? initialMessage;

  @override
  Future<void> deleteToken() async => token = null;

  @override
  Future<bool> openNotificationSettings() async {
    openSettingsCalls += 1;
    return opensSettings;
  }

  @override
  Stream<PushMessage> get foregroundMessages => foregroundController.stream;

  @override
  Future<PushMessage?> getInitialMessage() async => initialMessage;

  @override
  Future<String?> getToken() async => token;

  @override
  Stream<PushMessage> get openedMessages => openedController.stream;

  @override
  Future<PushPermissionStatus> permissionStatus() async => currentPermission;

  @override
  Future<PushPermissionStatus> requestPermission() async {
    requestCalls += 1;
    currentPermission = requestedPermission;
    return requestedPermission;
  }

  @override
  Stream<String> get tokenRefreshes => tokenController.stream;

  Future<void> dispose() async {
    await tokenController.close();
    await foregroundController.close();
    await openedController.close();
  }
}

class _FakeRegistrationRepository extends PushRegistrationRepository {
  _FakeRegistrationRepository()
    : super(Dio(BaseOptions(baseUrl: 'https://example.test/api/v1')));

  final registeredTokens = <String>[];
  bool shouldFail = false;

  @override
  Future<void> register({
    required String token,
    required String platform,
    String? appVersion,
  }) async {
    if (shouldFail) throw StateError('registration failed');
    registeredTokens.add(token);
  }
}

class _FakeNotificationsRepository extends NotificationsRepository {
  _FakeNotificationsRepository()
    : super(Dio(BaseOptions(baseUrl: 'https://example.test/api/v1')));

  final markedReadIds = <String>[];

  @override
  Future<NotificationPage> list({
    int page = 1,
    int limit = 20,
    bool unreadOnly = false,
  }) async => NotificationPage(
    items: const [],
    page: page,
    total: 0,
    unreadCount: 0,
    hasNextPage: false,
  );

  @override
  Future<PatientNotification> markRead(String id) async {
    markedReadIds.add(id);
    return PatientNotification(
      id: id,
      type: PatientNotificationType.appointmentConfirmed,
      title: 'Đã xác nhận',
      body: 'Nội dung',
      publishedAt: DateTime(2030),
      readAt: DateTime(2030),
      isRead: true,
    );
  }

  @override
  Future<int> unreadCount() async => 0;
}

class _FakePatientDataSyncCoordinator implements PatientDataSyncCoordinator {
  final remoteChanges = <(String?, String?)>[];

  @override
  Future<void> handleAppResumed() async {}

  @override
  Future<void> handleAppointmentChanged({String? appointmentId}) async {}

  @override
  Future<void> handleBookingCompleted({String? appointmentId}) async {}

  @override
  Future<void> handleMainBranchSelected(int branchIndex) async {}

  @override
  Future<void> handleRemoteChange({
    String? entityType,
    String? entityId,
  }) async {
    remoteChanges.add((entityType, entityId));
  }
}

void main() {
  test(
    'requests permission only after user action and keeps token current',
    () async {
      final gateway = _FakeGateway();
      final repository = _FakeRegistrationRepository();
      final notificationsRepository = _FakeNotificationsRepository();
      final syncCoordinator = _FakePatientDataSyncCoordinator();
      final preferences = MemoryAppPreferences();
      final container = ProviderContainer(
        overrides: [
          authControllerProvider.overrideWith(_AuthenticatedController.new),
          appPreferencesProvider.overrideWithValue(preferences),
          pushMessagingGatewayProvider.overrideWithValue(gateway),
          pushRegistrationRepositoryProvider.overrideWithValue(repository),
          notificationsRepositoryProvider.overrideWithValue(
            notificationsRepository,
          ),
          patientDataSyncCoordinatorProvider.overrideWithValue(syncCoordinator),
        ],
      );
      addTearDown(() async {
        container.dispose();
        await gateway.dispose();
      });

      container.read(pushNotificationsControllerProvider);
      await Future<void>.delayed(Duration.zero);
      await Future<void>.delayed(Duration.zero);

      var state = container.read(pushNotificationsControllerProvider);
      expect(state.permission, PushPermissionStatus.notDetermined);
      expect(gateway.requestCalls, 0);
      expect(repository.registeredTokens, isEmpty);

      final enabled = await container
          .read(pushNotificationsControllerProvider.notifier)
          .requestPermission();
      expect(enabled, isTrue);
      expect(preferences.notificationPermissionRequested, isTrue);
      expect(repository.registeredTokens, ['fcm-token-initial-0000001']);

      gateway.tokenController.add('fcm-token-refreshed-0000002');
      await Future<void>.delayed(Duration.zero);
      expect(repository.registeredTokens.last, 'fcm-token-refreshed-0000002');

      gateway.openedController.add(
        const PushMessage(
          messageId: 'message-1',
          data: {
            'notificationId': 'notification-1',
            'entityType': 'APPOINTMENT',
            'entityId': 'appointment-1',
          },
        ),
      );
      await Future<void>.delayed(Duration.zero);
      await Future<void>.delayed(Duration.zero);
      state = container.read(pushNotificationsControllerProvider);
      final destination = Uri.parse(state.navigationDestination!);
      expect(destination.path, '/appointments/appointment-1');
      expect(destination.queryParameters, {'origin': 'notification'});
      expect(notificationsRepository.markedReadIds, ['notification-1']);
      expect(syncCoordinator.remoteChanges, [('APPOINTMENT', 'appointment-1')]);
    },
  );

  test('an arbitrary payload falls back to the protected inbox', () {
    const message = PushMessage(
      messageId: 'message-unsafe',
      data: {
        'destination': 'https://malicious.example',
        'entityType': 'URL',
        'entityId': '../../admin',
      },
    );

    expect(message.safeDestination, '/notifications');
  });

  test('push payloads open allowlisted clinical and billing details', () {
    final cases = <(String, String)>[
      ('MEDICAL_RECORD', '/medical-records/entity-1'),
      ('PRESCRIPTION', '/prescriptions/entity-1'),
      ('INVOICE', '/invoices/entity-1'),
    ];

    for (final (entityType, destination) in cases) {
      final message = PushMessage(
        messageId: 'message-$entityType',
        data: {'entityType': entityType, 'entityId': 'entity-1'},
      );
      expect(message.safeDestination, destination);
    }
  });

  test('appointment push preserves notification event context', () {
    const message = PushMessage(
      messageId: 'message-appointment',
      data: {
        'entityType': 'APPOINTMENT',
        'entityId': 'appointment-1',
        'type': 'APPOINTMENT_CANCELLED',
      },
    );

    final destination = Uri.parse(message.safeDestination);
    expect(destination.path, '/appointments/appointment-1');
    expect(destination.queryParameters, {
      'origin': 'notification',
      'notificationType': 'APPOINTMENT_CANCELLED',
    });
  });

  test(
    'opens system notification settings after permission is denied',
    () async {
      final gateway = _FakeGateway();
      final container = ProviderContainer(
        overrides: [
          authControllerProvider.overrideWith(_AuthenticatedController.new),
          appPreferencesProvider.overrideWithValue(MemoryAppPreferences()),
          pushMessagingGatewayProvider.overrideWithValue(gateway),
          pushRegistrationRepositoryProvider.overrideWithValue(
            _FakeRegistrationRepository(),
          ),
        ],
      );
      addTearDown(() async {
        container.dispose();
        await gateway.dispose();
      });

      container.read(pushNotificationsControllerProvider);
      await Future<void>.delayed(Duration.zero);
      await Future<void>.delayed(Duration.zero);

      final opened = await container
          .read(pushNotificationsControllerProvider.notifier)
          .openNotificationSettings();

      expect(opened, isTrue);
      expect(gateway.openSettingsCalls, 1);
      expect(
        container.read(pushNotificationsControllerProvider).isOpeningSettings,
        isFalse,
      );
    },
  );

  test('exposes token synchronization failure and allows retry', () async {
    final gateway = _FakeGateway()
      ..currentPermission = PushPermissionStatus.authorized;
    final repository = _FakeRegistrationRepository()..shouldFail = true;
    final container = ProviderContainer(
      overrides: [
        authControllerProvider.overrideWith(_AuthenticatedController.new),
        appPreferencesProvider.overrideWithValue(MemoryAppPreferences()),
        pushMessagingGatewayProvider.overrideWithValue(gateway),
        pushRegistrationRepositoryProvider.overrideWithValue(repository),
      ],
    );
    addTearDown(() async {
      container.dispose();
      await gateway.dispose();
    });

    container.read(pushNotificationsControllerProvider);
    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);

    var state = container.read(pushNotificationsControllerProvider);
    expect(state.isAllowed, isTrue);
    expect(state.isTokenRegistered, isFalse);
    expect(state.isRegisteringToken, isFalse);
    expect(state.errorMessage, isNotNull);

    repository.shouldFail = false;
    final synchronized = await container
        .read(pushNotificationsControllerProvider.notifier)
        .retryRegistration();

    state = container.read(pushNotificationsControllerProvider);
    expect(synchronized, isTrue);
    expect(state.isTokenRegistered, isTrue);
    expect(state.errorMessage, isNull);
    expect(repository.registeredTokens, ['fcm-token-initial-0000001']);
  });
}
