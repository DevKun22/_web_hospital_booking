import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/app/theme/app_theme.dart';
import 'package:hospital_booking_mobile/features/notifications/application/notifications_controller.dart';
import 'package:hospital_booking_mobile/features/notifications/application/push_notifications_controller.dart';
import 'package:hospital_booking_mobile/features/notifications/data/push_messaging_gateway.dart';
import 'package:hospital_booking_mobile/features/notifications/domain/patient_notification.dart';
import 'package:hospital_booking_mobile/features/notifications/presentation/notifications_screen.dart';

class _LoadedNotificationsController extends NotificationsController {
  String? markedId;
  int markAllCalls = 0;

  @override
  NotificationsState build() {
    final now = DateTime.now();
    return NotificationsState(
      items: [
        PatientNotification(
          id: 'notification-today',
          type: PatientNotificationType.appointmentConfirmed,
          title: 'Lịch khám đã được xác nhận',
          body: 'Bạn có cập nhật mới về lịch khám.',
          entityType: 'APPOINTMENT',
          entityId: 'appointment-1',
          publishedAt: now,
          isRead: false,
        ),
        PatientNotification(
          id: 'notification-earlier',
          type: PatientNotificationType.appointmentReminder,
          title: 'Nhắc lịch khám',
          body: 'Bạn có lịch khám sắp tới.',
          publishedAt: now.subtract(const Duration(days: 2)),
          isRead: true,
          readAt: now.subtract(const Duration(days: 2)),
        ),
      ],
      total: 2,
      unreadCount: 1,
    );
  }

  @override
  Future<bool> markRead(String id) async {
    markedId = id;
    return true;
  }

  @override
  Future<bool> markAllRead() async {
    markAllCalls += 1;
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

class _EmptyNotificationsController extends NotificationsController {
  @override
  NotificationsState build() => const NotificationsState();
}

class _AnnouncementNotificationsController extends NotificationsController {
  String? markedId;

  @override
  NotificationsState build() => NotificationsState(
    items: [
      PatientNotification(
        id: 'hospital-announcement',
        type: PatientNotificationType.systemAnnouncement,
        title: 'Thay đổi giờ làm việc',
        body: 'Bệnh viện tiếp nhận người bệnh từ 7 giờ sáng.',
        publishedAt: DateTime.now(),
        isRead: false,
      ),
    ],
    total: 1,
    unreadCount: 1,
  );

  @override
  Future<bool> markRead(String id) async {
    markedId = id;
    return true;
  }
}

class _DeniedPushController extends PushNotificationsController {
  int openSettingsCalls = 0;

  @override
  PushNotificationsState build() => const PushNotificationsState(
    permission: PushPermissionStatus.denied,
    isCheckingPermission: false,
  );

  @override
  Future<bool> openNotificationSettings() async {
    openSettingsCalls += 1;
    return true;
  }
}

class _UnsyncedPushController extends PushNotificationsController {
  int retryCalls = 0;

  @override
  PushNotificationsState build() => const PushNotificationsState(
    permission: PushPermissionStatus.authorized,
    isCheckingPermission: false,
    errorMessage: 'Chưa đồng bộ được thiết bị.',
  );

  @override
  Future<bool> retryRegistration() async {
    retryCalls += 1;
    return true;
  }
}

void main() {
  testWidgets(
    'groups notifications and opens only an allowlisted destination',
    (tester) async {
      final controller = _LoadedNotificationsController();
      final router = GoRouter(
        initialLocation: '/notifications',
        routes: [
          GoRoute(
            path: '/notifications',
            builder: (_, _) => const NotificationsScreen(),
          ),
          GoRoute(
            path: '/appointments/:id',
            builder: (_, state) =>
                Scaffold(body: Text('Chi tiết ${state.pathParameters['id']}')),
          ),
          GoRoute(
            path: '/home',
            builder: (_, _) => const Scaffold(body: Text('Trang chủ')),
          ),
        ],
      );
      addTearDown(router.dispose);

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            notificationsControllerProvider.overrideWith(() => controller),
            pushNotificationsControllerProvider.overrideWith(
              _EnabledPushController.new,
            ),
          ],
          child: MaterialApp.router(
            theme: AppTheme.light,
            routerConfig: router,
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('1 thông báo chưa đọc'), findsOneWidget);
      expect(find.text('Hôm nay'), findsOneWidget);
      expect(find.text('Trước đó'), findsOneWidget);
      expect(find.text('Lịch khám đã được xác nhận'), findsOneWidget);

      await tester.tap(find.text('Đọc tất cả'));
      await tester.pump();
      expect(controller.markAllCalls, 1);

      await tester.tap(find.text('Lịch khám đã được xác nhận'));
      await tester.pumpAndSettle();
      expect(controller.markedId, 'notification-today');
      expect(find.text('Chi tiết appointment-1'), findsOneWidget);
    },
  );

  testWidgets('offers settings recovery after notification permission denial', (
    tester,
  ) async {
    final pushController = _DeniedPushController();
    final router = GoRouter(
      initialLocation: '/notifications',
      routes: [
        GoRoute(
          path: '/notifications',
          builder: (_, _) => const NotificationsScreen(),
        ),
        GoRoute(
          path: '/appointments',
          builder: (_, _) => const Scaffold(body: Text('Lịch khám')),
        ),
        GoRoute(
          path: '/home',
          builder: (_, _) => const Scaffold(body: Text('Trang chủ')),
        ),
      ],
    );
    addTearDown(router.dispose);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          notificationsControllerProvider.overrideWith(
            _EmptyNotificationsController.new,
          ),
          pushNotificationsControllerProvider.overrideWith(
            () => pushController,
          ),
        ],
        child: MaterialApp.router(theme: AppTheme.light, routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Thông báo trên thiết bị đang tắt'), findsOneWidget);
    expect(find.text('Hộp thư đang trống'), findsOneWidget);
    expect(find.text('Đọc tất cả'), findsNothing);

    await tester.tap(find.text('Mở cài đặt'));
    await tester.pump();
    expect(pushController.openSettingsCalls, 1);
  });

  testWidgets('opens hospital announcements in a readable detail sheet', (
    tester,
  ) async {
    final controller = _AnnouncementNotificationsController();
    final router = GoRouter(
      initialLocation: '/notifications',
      routes: [
        GoRoute(
          path: '/notifications',
          builder: (_, _) => const NotificationsScreen(),
        ),
        GoRoute(
          path: '/home',
          builder: (_, _) => const Scaffold(body: Text('Trang chủ')),
        ),
      ],
    );
    addTearDown(router.dispose);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          notificationsControllerProvider.overrideWith(() => controller),
          pushNotificationsControllerProvider.overrideWith(
            _EnabledPushController.new,
          ),
        ],
        child: MaterialApp.router(theme: AppTheme.light, routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Thay đổi giờ làm việc'));
    await tester.pumpAndSettle();

    expect(controller.markedId, 'hospital-announcement');
    expect(find.text('Thông báo từ bệnh viện'), findsOneWidget);
    expect(
      find.descendant(
        of: find.byType(BottomSheet),
        matching: find.text('Bệnh viện tiếp nhận người bệnh từ 7 giờ sáng.'),
      ),
      findsOneWidget,
    );
    expect(find.text('Đã hiểu'), findsOneWidget);
  });

  testWidgets('shows a retry action when push token synchronization fails', (
    tester,
  ) async {
    final pushController = _UnsyncedPushController();
    final router = GoRouter(
      initialLocation: '/notifications',
      routes: [
        GoRoute(
          path: '/notifications',
          builder: (_, _) => const NotificationsScreen(),
        ),
        GoRoute(
          path: '/appointments',
          builder: (_, _) => const Scaffold(body: Text('Lịch khám')),
        ),
        GoRoute(
          path: '/home',
          builder: (_, _) => const Scaffold(body: Text('Trang chủ')),
        ),
      ],
    );
    addTearDown(router.dispose);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          notificationsControllerProvider.overrideWith(
            _EmptyNotificationsController.new,
          ),
          pushNotificationsControllerProvider.overrideWith(
            () => pushController,
          ),
        ],
        child: MaterialApp.router(theme: AppTheme.light, routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Chưa đồng bộ được thông báo'), findsOneWidget);
    await tester.tap(find.text('Thử kết nối lại'));
    await tester.pump();
    expect(pushController.retryCalls, 1);
  });
}
