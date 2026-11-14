import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:hospital_booking_mobile/app/app_orientation_policy.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/app/router/app_router.dart';
import 'package:hospital_booking_mobile/core/theme/app_theme.dart';
import 'package:hospital_booking_mobile/app/sync/patient_data_sync_coordinator.dart';
import 'package:hospital_booking_mobile/features/notifications/application/push_notifications_controller.dart';
import 'package:hospital_booking_mobile/features/security/application/app_lock_controller.dart';
import 'package:hospital_booking_mobile/features/security/presentation/app_lock_gate.dart';

import 'package:hospital_booking_mobile/core/config/app_brand.dart';

final rootScaffoldMessengerKey = GlobalKey<ScaffoldMessengerState>();

/// Đặt màu thanh trạng thái và thanh điều hướng hệ thống theo chế độ sáng/tối.
class AppSystemUiStyle extends StatelessWidget {
  const AppSystemUiStyle({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final icons = isDark ? Brightness.light : Brightness.dark;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: icons,
        statusBarBrightness: isDark ? Brightness.dark : Brightness.light,
        systemNavigationBarColor: context.colors.canvas,
        systemNavigationBarIconBrightness: icons,
        systemNavigationBarDividerColor: Colors.transparent,
      ),
      child: child,
    );
  }
}

class HospitalBookingApp extends ConsumerStatefulWidget {
  const HospitalBookingApp({super.key});

  @override
  ConsumerState<HospitalBookingApp> createState() => _HospitalBookingAppState();
}

class _HospitalBookingAppState extends ConsumerState<HospitalBookingApp>
    with WidgetsBindingObserver {
  GoRouter? _router;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.detached) {
      ref.read(appLockControllerProvider.notifier).noteBackgrounded();
    }
    if (state == AppLifecycleState.resumed) {
      ref.read(appLockControllerProvider.notifier).handleAppResumed();
      unawaited(
        ref.read(patientDataSyncCoordinatorProvider).handleAppResumed(),
      );
    }
  }

  void _bindRouter(GoRouter router) {
    if (identical(_router, router)) return;
    _router?.routeInformationProvider.removeListener(_dismissSnackBar);
    _router = router;
    router.routeInformationProvider.addListener(_dismissSnackBar);
  }

  void _dismissSnackBar() {
    rootScaffoldMessengerKey.currentState?.hideCurrentSnackBar();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _router?.routeInformationProvider.removeListener(_dismissSnackBar);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(appRouterProvider);
    _bindRouter(router);
    ref.listen(pushNotificationsControllerProvider, (previous, next) {
      final controller = ref.read(pushNotificationsControllerProvider.notifier);
      final previousEvent = previous?.messageEvent ?? 0;
      if (next.messageEvent == previousEvent) return;

      WidgetsBinding.instance.addPostFrameCallback((_) {
        final destination = next.navigationDestination;
        if (destination != null) {
          controller.acknowledgeNavigation();
          router.push(destination);
          return;
        }

        final message = next.foregroundMessage;
        if (message == null) return;
        rootScaffoldMessengerKey.currentState
          ?..hideCurrentSnackBar()
          ..showSnackBar(
            SnackBar(
              content: Text('${message.displayTitle}\n${message.displayBody}'),
              action: SnackBarAction(
                label: 'Xem',
                onPressed: controller.openForegroundMessage,
              ),
            ),
          );
      });
    });

    return MaterialApp.router(
      title: AppBrand.name,
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: ThemeMode.system,
      scaffoldMessengerKey: rootScaffoldMessengerKey,
      routerConfig: router,
      builder: (context, child) => AppOrientationPolicy(
        child: AppSystemUiStyle(
          child: AppLockGate(child: child ?? const SizedBox.shrink()),
        ),
      ),
    );
  }
}
