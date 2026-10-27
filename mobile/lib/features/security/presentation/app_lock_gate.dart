import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/app/theme/app_theme.dart';
import 'package:hospital_booking_mobile/core/widgets/app_brand_mark.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/security/application/app_lock_controller.dart';

class AppLockGate extends ConsumerWidget {
  const AppLockGate({required this.child, super.key});

  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authenticated = ref.watch(
      authControllerProvider.select((state) => state.isAuthenticated),
    );
    final lock = ref.watch(appLockControllerProvider);
    final covered = authenticated && (lock.isChecking || lock.locked);
    return Stack(
      children: [
        ExcludeSemantics(excluding: covered, child: child),
        if (covered)
          Positioned.fill(
            child: Material(
              color: AppTheme.quietCanvas,
              child: SafeArea(
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 360),
                    child: Padding(
                      padding: const EdgeInsets.all(28),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const AppBrandMark(size: 72),
                          const SizedBox(height: 20),
                          Text(
                            lock.isChecking
                                ? 'Đang kiểm tra bảo mật'
                                : 'Ứng dụng đã được khóa',
                            textAlign: TextAlign.center,
                            style: Theme.of(context).textTheme.headlineSmall
                                ?.copyWith(fontWeight: FontWeight.w900),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Xác thực trên thiết bị để tiếp tục xem lịch khám và hồ sơ y tế.',
                            textAlign: TextAlign.center,
                            style: Theme.of(context).textTheme.bodyMedium
                                ?.copyWith(
                                  color: Theme.of(
                                    context,
                                  ).colorScheme.onSurfaceVariant,
                                ),
                          ),
                          if (lock.message != null) ...[
                            const SizedBox(height: 12),
                            Text(
                              lock.message!,
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                color: Theme.of(context).colorScheme.error,
                              ),
                            ),
                          ],
                          const SizedBox(height: 22),
                          if (lock.isChecking || lock.isAuthenticating)
                            const CircularProgressIndicator()
                          else
                            FilledButton.icon(
                              key: const Key('app-lock-unlock'),
                              onPressed: () => ref
                                  .read(appLockControllerProvider.notifier)
                                  .unlock(),
                              icon: const Icon(Icons.fingerprint_rounded),
                              label: const Text('Mở khóa'),
                            ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
