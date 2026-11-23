import 'package:hospital_booking_mobile/core/design/app_design_tokens.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/widgets/app_brand_mark.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/security/application/app_lock_controller.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';

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
              color: context.colors.canvas,
              child: SafeArea(
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 360),
                    child: Padding(
                      padding: const EdgeInsets.all(AppSpacing.xl),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const AppBrandMark(size: 72),
                          const SizedBox(height: AppSpacing.lg),
                          Text(
                            lock.isChecking
                                ? 'Đang kiểm tra bảo mật'
                                : 'Ứng dụng đã được khóa',
                            textAlign: TextAlign.center,
                            style: Theme.of(context).textTheme.headlineSmall
                                ?.copyWith(fontWeight: AppFontWeight.strong),
                          ),
                          const SizedBox(height: AppSpacing.xs),
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
                            const SizedBox(height: AppSpacing.sm),
                            Text(
                              lock.message!,
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                color: Theme.of(context).colorScheme.error,
                              ),
                            ),
                          ],
                          const SizedBox(height: AppSpacing.lg),
                          if (lock.isChecking || lock.isAuthenticating)
                            const CircularProgressIndicator()
                          else
                            FilledButton.icon(
                              key: const Key('app-lock-unlock'),
                              onPressed: () => ref
                                  .read(appLockControllerProvider.notifier)
                                  .unlock(),
                              icon: const Icon(Icons.fingerprint_outlined),
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
