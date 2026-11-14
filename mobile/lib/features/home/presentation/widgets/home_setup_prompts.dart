import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/design/app_design_tokens.dart';
import 'package:hospital_booking_mobile/features/home/application/setup_prompts_controller.dart';
import 'package:hospital_booking_mobile/features/notifications/application/push_notifications_controller.dart';
import 'package:hospital_booking_mobile/features/notifications/domain/push_permission_status.dart';
import 'package:hospital_booking_mobile/features/security/application/app_lock_controller.dart';

/// Gợi ý bật thông báo và khóa vân tay cho người đã đăng nhập. Tự ẩn khi đã bật đủ
/// hoặc khi người dùng chọn "Để sau" (ẩn trong [setupPromptsSnoozeDuration]).
class HomeSetupPrompts extends ConsumerWidget {
  const HomeSetupPrompts({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final setup = ref.watch(setupPromptsControllerProvider);
    final push = ref.watch(pushNotificationsControllerProvider);
    final lock = ref.watch(appLockControllerProvider);

    final needsNotifications = !push.isCheckingPermission && !push.isAllowed;
    final needsLock = !lock.isChecking && !lock.enabled;
    if (!setup.isLoaded ||
        setup.isSnoozed ||
        (!needsNotifications && !needsLock)) {
      return const SizedBox.shrink();
    }

    final colors = context.colors;
    return Container(
      key: const Key('home-setup-prompts'),
      padding: const EdgeInsets.fromLTRB(14, 12, 6, 8),
      decoration: BoxDecoration(
        color: colors.primarySoft,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: colors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.tips_and_updates_outlined, color: colors.primaryDark),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Hoàn tất thiết lập',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    color: colors.primaryDark,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              TextButton(
                key: const Key('home-setup-snooze'),
                onPressed: ref
                    .read(setupPromptsControllerProvider.notifier)
                    .snooze,
                child: const Text('Để sau'),
              ),
            ],
          ),
          if (needsNotifications)
            _SetupRow(
              key: const Key('home-setup-notifications'),
              icon: Icons.notifications_active_outlined,
              title: 'Bật thông báo',
              description:
                  'Nhận nhắc lịch khám và cập nhật ngay trên điện thoại.',
              actionLabel: push.permission == PushPermissionStatus.denied
                  ? 'Mở cài đặt'
                  : 'Bật',
              busy: push.isRequestingPermission || push.isOpeningSettings,
              onPressed: () {
                final controller = ref.read(
                  pushNotificationsControllerProvider.notifier,
                );
                if (push.permission == PushPermissionStatus.denied) {
                  controller.openNotificationSettings();
                } else {
                  controller.requestPermission();
                }
              },
            ),
          if (needsLock)
            _SetupRow(
              key: const Key('home-setup-lock'),
              icon: Icons.fingerprint_rounded,
              title: 'Khóa bằng vân tay',
              description: 'Chỉ bạn mở được lịch khám và hồ sơ trên máy này.',
              actionLabel: 'Bật',
              busy: lock.isAuthenticating,
              onPressed: () async {
                final changed = await ref
                    .read(appLockControllerProvider.notifier)
                    .setEnabled(true);
                if (!context.mounted) return;
                ScaffoldMessenger.of(context)
                  ..hideCurrentSnackBar()
                  ..showSnackBar(
                    SnackBar(
                      content: Text(
                        changed
                            ? 'Đã bật khóa ứng dụng trên thiết bị này.'
                            : ref.read(appLockControllerProvider).message ??
                                  'Cài đặt chưa thay đổi.',
                      ),
                    ),
                  );
              },
            ),
        ],
      ),
    );
  }
}

class _SetupRow extends StatelessWidget {
  const _SetupRow({
    super.key,
    required this.icon,
    required this.title,
    required this.description,
    required this.actionLabel,
    required this.busy,
    required this.onPressed,
  });

  final IconData icon;
  final String title;
  final String description;
  final String actionLabel;
  final bool busy;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Padding(
      padding: const EdgeInsets.only(top: 4, right: 8, bottom: 4),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: colors.surface,
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: colors.primary, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: Theme.of(
                    context,
                  ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                ),
                Text(
                  description,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: colors.muted,
                    height: 1.3,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          FilledButton(
            onPressed: busy ? null : onPressed,
            style: FilledButton.styleFrom(
              minimumSize: const Size(64, 40),
              padding: const EdgeInsets.symmetric(horizontal: 14),
            ),
            child: busy
                ? const SizedBox.square(
                    dimension: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Text(actionLabel),
          ),
        ],
      ),
    );
  }
}
