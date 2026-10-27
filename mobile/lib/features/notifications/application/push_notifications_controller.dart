import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/providers/app_providers.dart';
import 'package:hospital_booking_mobile/core/sync/patient_data_sync_coordinator.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/notifications/application/notifications_controller.dart';
import 'package:hospital_booking_mobile/features/notifications/data/push_messaging_gateway.dart';
import 'package:hospital_booking_mobile/features/notifications/data/push_registration_repository.dart';
import 'package:hospital_booking_mobile/features/notifications/domain/push_message.dart';

final pushRegistrationRepositoryProvider = Provider<PushRegistrationRepository>(
  (ref) => PushRegistrationRepository(ref.watch(authenticatedDioProvider)),
);

final pushNotificationsControllerProvider =
    NotifierProvider<PushNotificationsController, PushNotificationsState>(
      PushNotificationsController.new,
    );

class PushNotificationsState {
  const PushNotificationsState({
    this.permission = PushPermissionStatus.unknown,
    this.isCheckingPermission = true,
    this.isRequestingPermission = false,
    this.isOpeningSettings = false,
    this.isRegisteringToken = false,
    this.isTokenRegistered = false,
    this.messageEvent = 0,
    this.foregroundMessage,
    this.navigationDestination,
    this.errorMessage,
  });

  final PushPermissionStatus permission;
  final bool isCheckingPermission;
  final bool isRequestingPermission;
  final bool isOpeningSettings;
  final bool isRegisteringToken;
  final bool isTokenRegistered;
  final int messageEvent;
  final PushMessage? foregroundMessage;
  final String? navigationDestination;
  final String? errorMessage;

  bool get isAllowed =>
      permission == PushPermissionStatus.authorized ||
      permission == PushPermissionStatus.provisional;

  PushNotificationsState copyWith({
    PushPermissionStatus? permission,
    bool? isCheckingPermission,
    bool? isRequestingPermission,
    bool? isOpeningSettings,
    bool? isRegisteringToken,
    bool? isTokenRegistered,
    int? messageEvent,
    PushMessage? foregroundMessage,
    String? navigationDestination,
    String? errorMessage,
    bool clearForegroundMessage = false,
    bool clearNavigationDestination = false,
    bool clearError = false,
  }) => PushNotificationsState(
    permission: permission ?? this.permission,
    isCheckingPermission: isCheckingPermission ?? this.isCheckingPermission,
    isRequestingPermission:
        isRequestingPermission ?? this.isRequestingPermission,
    isOpeningSettings: isOpeningSettings ?? this.isOpeningSettings,
    isRegisteringToken: isRegisteringToken ?? this.isRegisteringToken,
    isTokenRegistered: isTokenRegistered ?? this.isTokenRegistered,
    messageEvent: messageEvent ?? this.messageEvent,
    foregroundMessage: clearForegroundMessage
        ? null
        : foregroundMessage ?? this.foregroundMessage,
    navigationDestination: clearNavigationDestination
        ? null
        : navigationDestination ?? this.navigationDestination,
    errorMessage: clearError ? null : errorMessage ?? this.errorMessage,
  );
}

class PushNotificationsController extends Notifier<PushNotificationsState> {
  final List<StreamSubscription<Object?>> _subscriptions = [];
  int _generation = 0;
  String? _patientId;

  @override
  PushNotificationsState build() {
    final generation = ++_generation;
    _patientId = ref.watch(
      authControllerProvider.select((auth) => auth.user?.id),
    );
    ref.onDispose(() {
      _generation += 1;
      for (final subscription in _subscriptions) {
        unawaited(subscription.cancel());
      }
      _subscriptions.clear();
    });
    Future<void>.microtask(() => _initialize(generation));
    return const PushNotificationsState();
  }

  Future<void> _initialize(int generation) async {
    try {
      final gateway = ref.read(pushMessagingGatewayProvider);
      _listen(gateway, generation);
      final requestedBefore = await ref
          .read(appPreferencesProvider)
          .hasRequestedNotificationPermission();
      var permission = await gateway.permissionStatus();
      if (permission == PushPermissionStatus.denied && !requestedBefore) {
        permission = PushPermissionStatus.notDetermined;
      }
      if (generation != _generation) return;
      state = state.copyWith(
        permission: permission,
        isCheckingPermission: false,
        clearError: true,
      );
      if (_patientId != null && state.isAllowed && !state.isTokenRegistered) {
        await _registerCurrentToken(generation);
      }
      final initialMessage = await gateway.getInitialMessage();
      if (generation != _generation || initialMessage == null) return;
      unawaited(_synchronizeMessage(initialMessage));
      _openMessage(initialMessage);
    } catch (_) {
      if (generation != _generation) return;
      state = state.copyWith(
        isCheckingPermission: false,
        errorMessage:
            'Chưa thể khởi tạo thông báo đẩy. Bạn vẫn xem được hộp thư trong ứng dụng.',
      );
    }
  }

  void _listen(PushMessagingGateway gateway, int generation) {
    _subscriptions.add(
      gateway.tokenRefreshes.listen((token) {
        if (generation == _generation &&
            _patientId != null &&
            state.isAllowed) {
          unawaited(_registerToken(token, generation));
        }
      }),
    );
    _subscriptions.add(
      gateway.foregroundMessages.listen((message) {
        if (generation != _generation || _patientId == null) return;
        state = state.copyWith(
          foregroundMessage: message,
          messageEvent: state.messageEvent + 1,
        );
        unawaited(_synchronizeMessage(message));
      }),
    );
    _subscriptions.add(
      gateway.openedMessages.listen((message) {
        if (generation != _generation) return;
        unawaited(_synchronizeMessage(message));
        _openMessage(message);
      }),
    );
  }

  Future<bool> requestPermission() async {
    if (state.isRequestingPermission) return false;
    state = state.copyWith(isRequestingPermission: true, clearError: true);
    final generation = _generation;
    try {
      await ref
          .read(appPreferencesProvider)
          .setNotificationPermissionRequested();
      final permission = await ref
          .read(pushMessagingGatewayProvider)
          .requestPermission();
      if (generation != _generation) return false;
      state = state.copyWith(
        permission: permission,
        isRequestingPermission: false,
      );
      if (!state.isAllowed) return false;
      await _registerCurrentToken(generation);
      return state.isTokenRegistered;
    } catch (_) {
      if (generation != _generation) return false;
      state = state.copyWith(
        isRequestingPermission: false,
        errorMessage: 'Không thể bật thông báo lúc này. Vui lòng thử lại.',
      );
      return false;
    }
  }

  Future<void> refreshPermission() async {
    if (state.isCheckingPermission || state.isRequestingPermission) return;
    final generation = _generation;
    state = state.copyWith(isCheckingPermission: true, clearError: true);
    try {
      final permission = await ref
          .read(pushMessagingGatewayProvider)
          .permissionStatus();
      if (generation != _generation) return;
      state = state.copyWith(
        permission: permission,
        isCheckingPermission: false,
      );
      if (_patientId != null && state.isAllowed && !state.isTokenRegistered) {
        await _registerCurrentToken(generation);
      }
    } catch (_) {
      if (generation != _generation) return;
      state = state.copyWith(
        isCheckingPermission: false,
        errorMessage: 'Chưa thể kiểm tra quyền thông báo. Vui lòng thử lại.',
      );
    }
  }

  Future<bool> openNotificationSettings() async {
    if (state.isOpeningSettings) return false;
    final generation = _generation;
    state = state.copyWith(isOpeningSettings: true, clearError: true);
    final opened = await ref
        .read(pushMessagingGatewayProvider)
        .openNotificationSettings();
    if (generation != _generation) return false;
    state = state.copyWith(
      isOpeningSettings: false,
      errorMessage: opened
          ? null
          : 'Không thể mở Cài đặt. Hãy mở Cài đặt hệ thống và bật quyền thông báo cho ứng dụng.',
      clearError: opened,
    );
    return opened;
  }

  Future<bool> retryRegistration() async {
    if (_patientId == null || !state.isAllowed || state.isRegisteringToken) {
      return false;
    }
    await _registerCurrentToken(_generation);
    return state.isTokenRegistered;
  }

  Future<void> _registerCurrentToken(int generation) async {
    if (generation != _generation) return;
    state = state.copyWith(isRegisteringToken: true, clearError: true);
    try {
      final token = await ref.read(pushMessagingGatewayProvider).getToken();
      if (generation != _generation) return;
      if (token == null || token.trim().isEmpty) {
        state = state.copyWith(
          isRegisteringToken: false,
          isTokenRegistered: false,
          errorMessage:
              'Chưa lấy được mã thiết bị. Vui lòng kiểm tra mạng và thử lại.',
        );
        return;
      }
      await _registerToken(token, generation);
    } catch (_) {
      if (generation != _generation) return;
      state = state.copyWith(
        isRegisteringToken: false,
        isTokenRegistered: false,
        errorMessage:
            'Đã bật quyền nhưng chưa đồng bộ được thiết bị với máy chủ.',
      );
    }
  }

  Future<void> _registerToken(String token, int generation) async {
    if (_patientId == null || generation != _generation) return;
    state = state.copyWith(isRegisteringToken: true, clearError: true);
    try {
      await ref
          .read(pushRegistrationRepositoryProvider)
          .register(token: token, platform: _platformName);
      if (generation != _generation) return;
      state = state.copyWith(
        isRegisteringToken: false,
        isTokenRegistered: true,
        clearError: true,
      );
    } catch (_) {
      if (generation != _generation) return;
      state = state.copyWith(
        isRegisteringToken: false,
        isTokenRegistered: false,
        errorMessage:
            'Đã bật quyền nhưng chưa đồng bộ được thiết bị với máy chủ.',
      );
    }
  }

  void openForegroundMessage() {
    final message = state.foregroundMessage;
    if (message == null) return;
    _openMessage(message);
    state = state.copyWith(clearForegroundMessage: true);
  }

  void _openMessage(PushMessage message) {
    unawaited(_markOpenedMessageRead(message.notificationId));
    _emitNavigation(message.safeDestination);
  }

  Future<void> _synchronizeMessage(PushMessage message) => ref
      .read(patientDataSyncCoordinatorProvider)
      .handleRemoteChange(
        entityType: message.data['entityType'],
        entityId: message.data['entityId'],
      );

  Future<void> _markOpenedMessageRead(String? notificationId) async {
    if (_patientId == null || notificationId == null) return;
    try {
      await ref.read(notificationsRepositoryProvider).markRead(notificationId);
      await ref.read(notificationsControllerProvider.notifier).refresh();
    } catch (_) {
      // Đánh dấu đã đọc là best-effort; không được chặn điều hướng từ push.
    }
  }

  void acknowledgeNavigation() =>
      state = state.copyWith(clearNavigationDestination: true);

  void dismissError() => state = state.copyWith(clearError: true);

  void _emitNavigation(String destination) {
    state = state.copyWith(
      navigationDestination: destination,
      messageEvent: state.messageEvent + 1,
    );
  }

  String get _platformName => switch (defaultTargetPlatform) {
    TargetPlatform.iOS => 'ios',
    _ => 'android',
  };
}
