import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/design/app_design_tokens.dart';
import 'package:hospital_booking_mobile/features/notifications/domain/push_permission_status.dart';
import 'package:hospital_booking_mobile/features/notifications/application/push_notifications_controller.dart';

/// Dải vàng mỏng một dòng khi chưa bật thông báo đẩy: nút bật (hoặc mở cài đặt khi đã từ chối).
class NotificationPushPermissionCard extends ConsumerWidget {
  const NotificationPushPermissionCard({super.key, required this.state});

  final PushNotificationsState state;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;
    final text = Theme.of(context).textTheme;
    final wasDenied = state.permission == PushPermissionStatus.denied;
    final notifier = ref.read(pushNotificationsControllerProvider.notifier);
    return Container(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.sm,
        AppSpacing.xs,
        AppSpacing.xs,
        AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: colors.warningContainer,
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                wasDenied
                    ? Icons.notifications_off_outlined
                    : Icons.notifications_active_outlined,
                color: colors.warning,
              ),
              const SizedBox(width: AppSpacing.xs),
              Expanded(
                child: Text(
                  wasDenied
                      ? 'Thông báo trên thiết bị đang tắt'
                      : 'Nhận nhắc lịch ngay trên điện thoại',
                  style: text.titleSmall?.copyWith(color: colors.warning),
                ),
              ),
              if (!wasDenied)
                FilledButton(
                  onPressed: state.isRequestingPermission
                      ? null
                      : notifier.requestPermission,
                  style: FilledButton.styleFrom(
                    minimumSize: const Size(0, 36),
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                  ),
                  child: Text(
                    state.isRequestingPermission ? 'Đang bật…' : 'Bật',
                  ),
                )
              else
                TextButton(
                  onPressed: state.isOpeningSettings
                      ? null
                      : notifier.openNotificationSettings,
                  child: Text(
                    state.isOpeningSettings ? 'Đang mở…' : 'Mở cài đặt',
                  ),
                ),
            ],
          ),
          if (state.errorMessage != null)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                state.errorMessage!,
                style: text.bodySmall?.copyWith(color: colors.danger),
              ),
            ),
        ],
      ),
    );
  }
}

class NotificationPushSyncCard extends ConsumerWidget {
  const NotificationPushSyncCard({super.key, required this.state});

  final PushNotificationsState state;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isLoading = state.isRegisteringToken;
    return Card(
      margin: EdgeInsets.zero,
      color: isLoading
          ? Theme.of(context).colorScheme.secondaryContainer
          : Theme.of(context).colorScheme.errorContainer,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (isLoading)
              const SizedBox.square(
                dimension: 22,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            else
              Icon(
                Icons.sync_problem_rounded,
                color: Theme.of(context).colorScheme.error,
              ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    isLoading
                        ? 'Đang kết nối thiết bị'
                        : 'Chưa đồng bộ được thông báo',
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 5),
                  Text(
                    isLoading
                        ? 'Ứng dụng đang đăng ký thiết bị với DevKunCare.'
                        : state.errorMessage ??
                              'Bạn vẫn xem được hộp thư. Hãy thử kết nối lại để nhận thông báo đẩy.',
                  ),
                  if (!isLoading) ...[
                    const SizedBox(height: 10),
                    TextButton.icon(
                      onPressed: () => ref
                          .read(pushNotificationsControllerProvider.notifier)
                          .retryRegistration(),
                      icon: const Icon(Icons.sync_rounded),
                      label: const Text('Thử kết nối lại'),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
