import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/app/router/app_router.dart';
import 'package:hospital_booking_mobile/app/theme/app_theme.dart';
import 'package:hospital_booking_mobile/core/sync/patient_data_sync_coordinator.dart';
import 'package:hospital_booking_mobile/features/notifications/application/push_notifications_controller.dart';
import 'package:hospital_booking_mobile/features/security/application/app_lock_controller.dart';
import 'package:hospital_booking_mobile/features/security/presentation/app_lock_gate.dart';

final rootScaffoldMessengerKey = GlobalKey<ScaffoldMessengerState>();

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
      title: 'Medcare Booking',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      scaffoldMessengerKey: rootScaffoldMessengerKey,
      routerConfig: router,
      builder: (context, child) =>
          AppLockGate(child: child ?? const SizedBox.shrink()),
    );
  }
}
