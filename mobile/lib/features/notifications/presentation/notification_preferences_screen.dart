import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/app/theme/app_theme.dart';
import 'package:hospital_booking_mobile/core/widgets/app_error_banner.dart';
import 'package:hospital_booking_mobile/core/widgets/app_route_back_scope.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/notifications/application/notification_preferences_controller.dart';
import 'package:hospital_booking_mobile/features/notifications/application/push_notifications_controller.dart';
import 'package:hospital_booking_mobile/features/notifications/domain/notification_preferences.dart';

class NotificationPreferencesScreen extends ConsumerStatefulWidget {
  const NotificationPreferencesScreen({super.key});

  @override
  ConsumerState<NotificationPreferencesScreen> createState() =>
      _NotificationPreferencesScreenState();
}

class _NotificationPreferencesScreenState
    extends ConsumerState<NotificationPreferencesScreen>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      ref
          .read(pushNotificationsControllerProvider.notifier)
          .refreshPermission();
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(notificationPreferencesControllerProvider);
    final pushState = ref.watch(pushNotificationsControllerProvider);
    final controller = ref.read(
      notificationPreferencesControllerProvider.notifier,
    );

    return AppRouteBackScope(
      fallbackLocation: '/notifications',
      child: Scaffold(
        appBar: AppBar(
          leading: const AppRouteBackButton(fallbackLocation: '/notifications'),
          title: const Text('Tùy chọn thông báo'),
        ),
        body: SafeArea(
          child: state.isLoading && state.preferences == null
              ? const _PreferencesLoading()
              : RefreshIndicator(
                  onRefresh: controller.load,
                  child: ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                    children: [
                      _InboxPolicyCard(pushState: pushState),
                      if (state.error != null) ...[
                        const SizedBox(height: 14),
                        AppErrorBanner(
                          error: state.error!,
                          onDismiss: controller.dismissError,
                        ),
                      ],
                      const SizedBox(height: 22),
                      const AppSectionHeader(title: 'Thông báo đẩy theo nhóm'),
                      Text(
                        'Lựa chọn được đồng bộ cho tài khoản trên mọi thiết bị.',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                      ),
                      const SizedBox(height: 10),
                      if (state.preferences == null)
                        AppEmptyState(
                          icon: Icons.sync_problem_rounded,
                          title: 'Chưa tải được tùy chọn',
                          message:
                              'Kiểm tra kết nối mạng rồi tải lại. Hộp thư trong ứng dụng vẫn hoạt động bình thường.',
                          action: FilledButton.icon(
                            onPressed: controller.load,
                            icon: const Icon(Icons.refresh_rounded),
                            label: const Text('Thử lại'),
                          ),
                        )
                      else
                        Card(
                          margin: EdgeInsets.zero,
                          child: Column(
                            children: [
                              for (
                                var index = 0;
                                index <
                                    NotificationPreferenceKind.values.length;
                                index += 1
                              ) ...[
                                _PreferenceTile(
                                  kind:
                                      NotificationPreferenceKind.values[index],
                                  value: state.preferences!.valueFor(
                                    NotificationPreferenceKind.values[index],
                                  ),
                                  isSaving: state.saving.contains(
                                    NotificationPreferenceKind.values[index],
                                  ),
                                  onChanged: (value) => controller.setEnabled(
                                    NotificationPreferenceKind.values[index],
                                    value,
                                  ),
                                ),
                                if (index <
                                    NotificationPreferenceKind.values.length -
                                        1)
                                  const Divider(height: 1, indent: 60),
                              ],
                            ],
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

class _InboxPolicyCard extends ConsumerWidget {
  const _InboxPolicyCard({required this.pushState});

  final PushNotificationsState pushState;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final pushAllowed = pushState.isAllowed;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.primaryContainer,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppTheme.softBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                pushAllowed
                    ? Icons.notifications_active_outlined
                    : Icons.notifications_off_outlined,
                color: AppTheme.primary,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  pushAllowed
                      ? 'Thông báo trên thiết bị đang bật'
                      : 'Thông báo trên thiết bị đang tắt',
                  style: Theme.of(
                    context,
                  ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          const Text(
            'Các lựa chọn bên dưới chỉ kiểm soát thông báo đẩy. Thông tin nghiệp vụ vẫn được lưu đầy đủ trong hộp thư để bạn có thể xem lại.',
          ),
          if (!pushAllowed) ...[
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: pushState.isOpeningSettings
                  ? null
                  : () => ref
                        .read(pushNotificationsControllerProvider.notifier)
                        .openNotificationSettings(),
              icon: pushState.isOpeningSettings
                  ? const SizedBox.square(
                      dimension: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.settings_outlined),
              label: const Text('Mở cài đặt thiết bị'),
            ),
          ],
        ],
      ),
    );
  }
}

class _PreferenceTile extends StatelessWidget {
  const _PreferenceTile({
    required this.kind,
    required this.value,
    required this.isSaving,
    required this.onChanged,
  });

  final NotificationPreferenceKind kind;
  final bool value;
  final bool isSaving;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) => SwitchListTile.adaptive(
    key: ValueKey('notification-preference-${kind.apiKey}'),
    value: value,
    onChanged: isSaving ? null : onChanged,
    secondary: isSaving
        ? const SizedBox.square(
            dimension: 22,
            child: CircularProgressIndicator(strokeWidth: 2),
          )
        : Icon(kind.icon, color: AppTheme.primary),
    title: Text(
      kind.label,
      style: const TextStyle(fontWeight: FontWeight.w700),
    ),
    subtitle: Text(kind.description),
    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
  );
}

class _PreferencesLoading extends StatelessWidget {
  const _PreferencesLoading();

  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(16),
    children: const [
      AppLoadingSkeleton(height: 150),
      SizedBox(height: 20),
      AppLoadingSkeleton(height: 390),
    ],
  );
}
