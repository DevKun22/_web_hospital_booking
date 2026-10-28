import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/app/theme/app_theme.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/auth/application/app_launch_controller.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_state.dart';

class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _animationController;
  late final Animation<double> _crossScale;
  late final Animation<double> _ringOpacity;
  late final Animation<double> _ringScale;
  late final Animation<double> _contentOpacity;
  Timer? _slowLaunchTimer;
  bool _showSlowLaunchProgress = false;
  bool _started = false;

  @override
  void initState() {
    super.initState();
    _animationController =
        AnimationController(
          vsync: this,
          duration: const Duration(milliseconds: 680),
        )..addStatusListener((status) {
          if (status == AnimationStatus.completed) {
            ref
                .read(appLaunchControllerProvider.notifier)
                .completePresentation();
          }
        });
    _crossScale = TweenSequence<double>([
      TweenSequenceItem(tween: ConstantTween(1), weight: 18),
      TweenSequenceItem(
        tween: Tween(
          begin: 1.0,
          end: 1.18,
        ).chain(CurveTween(curve: Curves.easeOutCubic)),
        weight: 34,
      ),
      TweenSequenceItem(
        tween: Tween(
          begin: 1.18,
          end: 1.0,
        ).chain(CurveTween(curve: Curves.easeInOutCubic)),
        weight: 48,
      ),
    ]).animate(_animationController);
    _ringOpacity = Tween<double>(begin: 0, end: 0.42).animate(
      CurvedAnimation(
        parent: _animationController,
        curve: const Interval(0.12, 0.58, curve: Curves.easeOut),
      ),
    );
    _ringScale = Tween<double>(begin: 0.78, end: 1.24).animate(
      CurvedAnimation(
        parent: _animationController,
        curve: const Interval(0.12, 0.78, curve: Curves.easeOutCubic),
      ),
    );
    _contentOpacity = CurvedAnimation(
      parent: _animationController,
      curve: const Interval(0.34, 1, curve: Curves.easeOutCubic),
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    final presentationCompleted = ref.read(appLaunchControllerProvider);
    if (presentationCompleted || MediaQuery.disableAnimationsOf(context)) {
      _animationController.value = 1;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          ref.read(appLaunchControllerProvider.notifier).completePresentation();
        }
      });
      return;
    }
    _animationController.forward();
    _slowLaunchTimer = Timer(const Duration(milliseconds: 1200), () {
      if (mounted) setState(() => _showSlowLaunchProgress = true);
    });
  }

  @override
  void dispose() {
    _slowLaunchTimer?.cancel();
    _animationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(authControllerProvider);
    final isOffline = state.status == AuthStatus.offline;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.light,
        statusBarBrightness: Brightness.dark,
        systemNavigationBarColor: AppTheme.primaryDark,
        systemNavigationBarIconBrightness: Brightness.light,
        systemNavigationBarDividerColor: Colors.transparent,
      ),
      child: Scaffold(
        backgroundColor: AppTheme.primaryDark,
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Stack(
              alignment: Alignment.center,
              children: [
                AnimatedBuilder(
                  animation: _animationController,
                  builder: (context, _) => SizedBox.square(
                    dimension: 220,
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        FadeTransition(
                          opacity: _ringOpacity,
                          child: ScaleTransition(
                            scale: _ringScale,
                            child: Container(
                              width: 174,
                              height: 174,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: Colors.white,
                                  width: 1.5,
                                ),
                              ),
                            ),
                          ),
                        ),
                        AppBrandGlyph(size: 220, crossScale: _crossScale.value),
                      ],
                    ),
                  ),
                ),
                Center(
                  child: Transform.translate(
                    offset: Offset(0, isOffline ? 130 : 190),
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 420),
                      child: FadeTransition(
                        opacity: _contentOpacity,
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              'MEDCARE BOOKING',
                              style: Theme.of(context).textTheme.headlineSmall
                                  ?.copyWith(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w900,
                                    letterSpacing: 1.1,
                                  ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Đặt lịch thuận tiện · Chăm sóc an tâm',
                              textAlign: TextAlign.center,
                              style: Theme.of(context).textTheme.bodyMedium
                                  ?.copyWith(
                                    color: Colors.white.withValues(alpha: 0.84),
                                  ),
                            ),
                            const SizedBox(height: 42),
                            AnimatedSwitcher(
                              duration: const Duration(milliseconds: 220),
                              child: isOffline
                                  ? _OfflineRecovery(
                                      key: const ValueKey('offline'),
                                      message:
                                          state.error?.message ??
                                          'Không thể kết nối máy chủ.',
                                      onRetry: () => ref
                                          .read(authControllerProvider.notifier)
                                          .bootstrapSession(),
                                      onContinueOffline: () => ref
                                          .read(authControllerProvider.notifier)
                                          .continueOffline(),
                                    )
                                  : _showSlowLaunchProgress
                                  ? const _LaunchProgress(
                                      key: ValueKey('progress'),
                                    )
                                  : const SizedBox(
                                      key: ValueKey('fast-launch'),
                                      height: 52,
                                    ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _LaunchProgress extends StatelessWidget {
  const _LaunchProgress({super.key});

  @override
  Widget build(BuildContext context) => Column(
    children: [
      const SizedBox(
        width: 28,
        height: 28,
        child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white),
      ),
      const SizedBox(height: 12),
      Text(
        'Đang chuẩn bị trải nghiệm của bạn…',
        textAlign: TextAlign.center,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
          color: Colors.white.withValues(alpha: 0.82),
        ),
      ),
    ],
  );
}

class _OfflineRecovery extends StatelessWidget {
  const _OfflineRecovery({
    required this.message,
    required this.onRetry,
    required this.onContinueOffline,
    super.key,
  });

  final String message;
  final VoidCallback onRetry;
  final VoidCallback onContinueOffline;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(18),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(20),
    ),
    child: Column(
      children: [
        const Icon(Icons.cloud_off_outlined, color: AppTheme.primaryDark),
        const SizedBox(height: 8),
        Text(message, textAlign: TextAlign.center),
        const SizedBox(height: 14),
        SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh),
            label: const Text('Thử lại'),
          ),
        ),
        TextButton.icon(
          onPressed: onContinueOffline,
          icon: const Icon(Icons.cloud_off_outlined),
          label: const Text('Xem nội dung đã lưu'),
        ),
        Text(
          'Thông tin cá nhân sẽ được khóa cho đến khi khôi phục kết nối.',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
        ),
      ],
    ),
  );
}
