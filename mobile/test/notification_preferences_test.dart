import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/app/theme/app_theme.dart';
import 'package:hospital_booking_mobile/features/notifications/application/notification_preferences_controller.dart';
import 'package:hospital_booking_mobile/features/notifications/application/push_notifications_controller.dart';
import 'package:hospital_booking_mobile/features/notifications/data/notification_preferences_repository.dart';
import 'package:hospital_booking_mobile/features/notifications/data/push_messaging_gateway.dart';
import 'package:hospital_booking_mobile/features/notifications/domain/notification_preferences.dart';
import 'package:hospital_booking_mobile/features/notifications/presentation/notification_preferences_screen.dart';

class _LoadedPreferencesController extends NotificationPreferencesController {
  NotificationPreferenceKind? changedKind;
  bool? changedValue;

  @override
  NotificationPreferencesState build() => const NotificationPreferencesState(
    preferences: NotificationPreferences(),
  );

  @override
  Future<bool> setEnabled(NotificationPreferenceKind kind, bool enabled) async {
    changedKind = kind;
    changedValue = enabled;
    state = state.copyWith(
      preferences: state.preferences!.withValue(kind, enabled),
    );
    return true;
  }
}

class _EnabledPushController extends PushNotificationsController {
  @override
  PushNotificationsState build() => const PushNotificationsState(
    permission: PushPermissionStatus.authorized,
    isCheckingPermission: false,
    isTokenRegistered: true,
  );
}

void main() {
  test(
    'repository loads and updates account-synced push preferences',
    () async {
      final requests = <RequestOptions>[];
      final dio = Dio(BaseOptions(baseUrl: 'https://example.test/api/v1'));
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            requests.add(options);
            handler.resolve(
              Response<dynamic>(
                requestOptions: options,
                statusCode: 200,
                data: {
                  'success': true,
                  'data': {
                    'generalAnnouncementsPush': options.method == 'PATCH'
                        ? false
                        : true,
                    'appointmentUpdatesPush': true,
                    'appointmentRemindersPush': options.method == 'PATCH'
                        ? false
                        : true,
                    'medicalResultsPush': true,
                    'prescriptionsPush': true,
                    'billingPush': true,
                  },
                },
              ),
            );
          },
        ),
      );
      final repository = NotificationPreferencesRepository(dio);

      final initial = await repository.get();
      final updated = await repository.update(
        NotificationPreferenceKind.generalAnnouncements,
        false,
      );

      expect(initial.generalAnnouncementsPush, isTrue);
      expect(updated.generalAnnouncementsPush, isFalse);
      expect(requests[0].method, 'GET');
      expect(requests[0].path, '/me/notifications/preferences');
      expect(requests[1].method, 'PATCH');
      expect(requests[1].data, {'generalAnnouncementsPush': false});

      dio.close(force: true);
    },
  );

  testWidgets('explains inbox policy and updates one push category', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(430, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final preferencesController = _LoadedPreferencesController();
    final router = GoRouter(
      initialLocation: '/notification-settings',
      routes: [
        GoRoute(
          path: '/notification-settings',
          builder: (_, _) => const NotificationPreferencesScreen(),
        ),
        GoRoute(
          path: '/notifications',
          builder: (_, _) => const Scaffold(body: Text('Thông báo')),
        ),
      ],
    );
    addTearDown(router.dispose);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          notificationPreferencesControllerProvider.overrideWith(
            () => preferencesController,
          ),
          pushNotificationsControllerProvider.overrideWith(
            _EnabledPushController.new,
          ),
        ],
        child: MaterialApp.router(theme: AppTheme.light, routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Tùy chọn thông báo'), findsOneWidget);
    expect(find.textContaining('chỉ kiểm soát thông báo đẩy'), findsOneWidget);
    expect(find.text('Cập nhật lịch khám'), findsOneWidget);
    expect(find.text('Thông báo từ bệnh viện'), findsOneWidget);

    final updatesSwitch = find.byKey(
      const ValueKey('notification-preference-appointmentUpdatesPush'),
    );
    await tester.tap(updatesSwitch);
    await tester.pump();

    expect(
      preferencesController.changedKind,
      NotificationPreferenceKind.appointmentUpdates,
    );
    expect(preferencesController.changedValue, isFalse);
  });
}
