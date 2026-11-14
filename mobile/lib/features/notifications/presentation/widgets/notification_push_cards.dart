import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/features/notifications/domain/push_permission_status.dart';
import 'package:hospital_booking_mobile/features/notifications/application/push_notifications_controller.dart';

class NotificationPushPermissionCard extends ConsumerWidget {
  const NotificationPushPermissionCard({super.key, required this.state});

  final PushNotificationsState state;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final wasDenied = state.permission == PushPermissionStatus.denied;
    return Card(
      margin: EdgeInsets.zero,
      color: Theme.of(context).colorScheme.primaryContainer,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  wasDenied
                      ? Icons.notifications_off_outlined
                      : Icons.notifications_active_outlined,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    wasDenied
                        ? 'Thông báo trên thiết bị đang tắt'
                        : 'Nhận nhắc lịch ngay trên điện thoại',
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              wasDenied
                  ? 'Bạn vẫn xem được hộp thư tại đây. Để nhận thông báo đẩy, hãy bật quyền trong Cài đặt của điện thoại.'
                  : 'Bật một lần để không bỏ lỡ xác nhận, thay đổi hoặc nhắc lịch khám.',
            ),
            if (!wasDenied) ...[
              const SizedBox(height: 12),
              FilledButton.icon(
                onPressed: state.isRequestingPermission
                    ? null
                    : () => ref
                          .read(pushNotificationsControllerProvider.notifier)
                          .requestPermission(),
                icon: state.isRequestingPermission
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.notifications_active_outlined),
                label: Text(
                  state.isRequestingPermission ? 'Đang bật…' : 'Bật thông báo',
                ),
              ),
            ] else ...[
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: state.isOpeningSettings
                    ? null
                    : () => ref
                          .read(pushNotificationsControllerProvider.notifier)
                          .openNotificationSettings(),
                icon: state.isOpeningSettings
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.settings_outlined),
                label: Text(
                  state.isOpeningSettings ? 'Đang mở…' : 'Mở cài đặt',
                ),
              ),
            ],
            if (state.errorMessage != null) ...[
              const SizedBox(height: 10),
              Text(
                state.errorMessage!,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.error,
                ),
              ),
            ],
          ],
        ),
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
