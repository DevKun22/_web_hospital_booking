import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/app/theme/app_theme.dart';
import 'package:hospital_booking_mobile/core/widgets/app_error_banner.dart';
import 'package:hospital_booking_mobile/core/widgets/app_route_back_scope.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/notifications/application/notifications_controller.dart';
import 'package:hospital_booking_mobile/features/notifications/application/push_notifications_controller.dart';
import 'package:hospital_booking_mobile/features/notifications/data/push_messaging_gateway.dart';
import 'package:hospital_booking_mobile/features/notifications/domain/patient_notification.dart';

class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key, this.embeddedInMainNavigation = false});

  final bool embeddedInMainNavigation;

  @override
  ConsumerState<NotificationsScreen> createState() =>
      _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen>
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
    final state = ref.watch(notificationsControllerProvider);
    final controller = ref.read(notificationsControllerProvider.notifier);
    final pushState = ref.watch(pushNotificationsControllerProvider);

    final content = Scaffold(
      appBar: AppBar(
        automaticallyImplyLeading: !widget.embeddedInMainNavigation,
        leading: widget.embeddedInMainNavigation
            ? null
            : const AppRouteBackButton(fallbackLocation: '/home'),
        title: const Text('Thông báo'),
        actions: [
          IconButton(
            tooltip: 'Tùy chọn thông báo',
            onPressed: () => context.push('/notification-settings'),
            icon: const Icon(Icons.tune_rounded),
          ),
          if (state.unreadCount > 0 || state.isMarkingAllRead)
            TextButton(
              onPressed: state.isMarkingAllRead ? null : controller.markAllRead,
              child: state.isMarkingAllRead
                  ? const SizedBox.square(
                      dimension: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Đọc tất cả'),
            ),
          const SizedBox(width: 8),
        ],
      ),
      body: SafeArea(
        child: state.isInitialLoading && !state.hasItems
            ? const _NotificationsLoading()
            : RefreshIndicator(
                onRefresh: controller.refresh,
                child: ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: EdgeInsets.fromLTRB(
                    16,
                    8,
                    16,
                    widget.embeddedInMainNavigation
                        ? appFloatingActionContentBottomInset
                        : 28,
                  ),
                  children: [
                    if (!pushState.isCheckingPermission &&
                        !pushState.isAllowed) ...[
                      _PushPermissionCard(state: pushState),
                      const SizedBox(height: 14),
                    ] else if (pushState.isAllowed &&
                        (!pushState.isTokenRegistered ||
                            pushState.isRegisteringToken)) ...[
                      _PushSyncCard(state: pushState),
                      const SizedBox(height: 14),
                    ],
                    _InboxOverview(
                      unreadCount: state.unreadCount,
                      total: state.total,
                    ),
                    if (state.error != null) ...[
                      const SizedBox(height: 14),
                      AppErrorBanner(
                        error: state.error!,
                        onDismiss: controller.dismissError,
                      ),
                    ],
                    if (state.isRefreshing) ...[
                      const SizedBox(height: 12),
                      const LinearProgressIndicator(minHeight: 2),
                    ],
                    if (!state.hasItems) ...[
                      const SizedBox(height: 28),
                      AppEmptyState(
                        icon: Icons.notifications_none_rounded,
                        title: state.error == null
                            ? 'Chưa có thông báo'
                            : 'Chưa tải được hộp thư',
                        message: state.error == null
                            ? 'Xác nhận, thay đổi và lời nhắc lịch khám sẽ được lưu tại đây.'
                            : 'Kiểm tra kết nối mạng rồi thử tải lại.',
                        action: OutlinedButton.icon(
                          onPressed: state.error == null
                              ? () => context.push('/notification-appointments')
                              : controller.refresh,
                          icon: Icon(
                            state.error == null
                                ? Icons.calendar_month_outlined
                                : Icons.refresh_rounded,
                          ),
                          label: Text(
                            state.error == null ? 'Xem lịch khám' : 'Thử lại',
                          ),
                        ),
                      ),
                    ] else ...[
                      const SizedBox(height: 22),
                      ..._groupedItems(
                        context,
                        state.items,
                        onTap: (item) {
                          controller.markRead(item.id);
                          final destination = item.safeDestination;
                          if (destination != null) {
                            context.push(destination);
                            return;
                          }
                          if (item.isAnnouncement) {
                            _showAnnouncementDetails(context, item);
                            return;
                          }
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text(
                                'Thông báo này chưa có nội dung chi tiết.',
                              ),
                            ),
                          );
                        },
                      ),
                    ],
                    if (state.hasNextPage) ...[
                      const SizedBox(height: 8),
                      OutlinedButton.icon(
                        onPressed: state.isLoadingMore
                            ? null
                            : controller.loadMore,
                        icon: state.isLoadingMore
                            ? const SizedBox.square(
                                dimension: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Icon(Icons.expand_more_rounded),
                        label: Text(
                          state.isLoadingMore
                              ? 'Đang tải thêm…'
                              : 'Xem thông báo cũ hơn',
                        ),
                      ),
                    ],
                  ],
                ),
              ),
      ),
    );
    if (widget.embeddedInMainNavigation) return content;
    return AppRouteBackScope(fallbackLocation: '/home', child: content);
  }
}

Future<void> _showAnnouncementDetails(
  BuildContext context,
  PatientNotification item,
) => showModalBottomSheet<void>(
  context: context,
  useRootNavigator: true,
  isScrollControlled: true,
  showDragHandle: true,
  builder: (context) => SafeArea(
    child: Padding(
      padding: EdgeInsets.fromLTRB(
        24,
        4,
        24,
        24 + MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: item.type.background,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(item.type.icon, color: item.type.foreground),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Text(
                  'Thông báo từ bệnh viện',
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          Text(
            item.title,
            style: Theme.of(
              context,
            ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 10),
          ConstrainedBox(
            constraints: BoxConstraints(
              maxHeight: MediaQuery.sizeOf(context).height * .45,
            ),
            child: SingleChildScrollView(
              child: Text(item.body, style: const TextStyle(height: 1.55)),
            ),
          ),
          const SizedBox(height: 22),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Đã hiểu'),
            ),
          ),
        ],
      ),
    ),
  ),
);

class _PushPermissionCard extends ConsumerWidget {
  const _PushPermissionCard({required this.state});

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

class _PushSyncCard extends ConsumerWidget {
  const _PushSyncCard({required this.state});

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
                        ? 'Ứng dụng đang đăng ký thiết bị với hệ thống bệnh viện.'
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

List<Widget> _groupedItems(
  BuildContext context,
  List<PatientNotification> items, {
  required ValueChanged<PatientNotification> onTap,
}) {
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final todayItems = items
      .where((item) => !item.publishedAt.isBefore(today))
      .toList(growable: false);
  final earlierItems = items
      .where((item) => item.publishedAt.isBefore(today))
      .toList(growable: false);
  final widgets = <Widget>[];

  void addGroup(String title, List<PatientNotification> group) {
    if (group.isEmpty) return;
    widgets.add(AppSectionHeader(title: title));
    widgets.add(const SizedBox(height: 8));
    for (final item in group) {
      widgets.add(_NotificationCard(item: item, onTap: () => onTap(item)));
      widgets.add(const SizedBox(height: 10));
    }
  }

  addGroup('Hôm nay', todayItems);
  addGroup('Trước đó', earlierItems);
  return widgets;
}

class _InboxOverview extends StatelessWidget {
  const _InboxOverview({required this.unreadCount, required this.total});

  final int unreadCount;
  final int total;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(18),
    decoration: BoxDecoration(
      gradient: const LinearGradient(
        colors: [AppTheme.primaryDark, AppTheme.primary],
      ),
      borderRadius: BorderRadius.circular(20),
    ),
    child: Row(
      children: [
        Container(
          width: 50,
          height: 50,
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.14),
            borderRadius: BorderRadius.circular(16),
          ),
          child: const Icon(
            Icons.notifications_active_outlined,
            color: Colors.white,
          ),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                total == 0
                    ? 'Hộp thư đang trống'
                    : unreadCount == 0
                    ? 'Bạn đã xem tất cả cập nhật'
                    : '$unreadCount thông báo chưa đọc',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                total == 0
                    ? 'Thông tin lịch khám sẽ được lưu an toàn tại đây.'
                    : '$total thông báo từ hệ thống bệnh viện',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Colors.white.withValues(alpha: 0.84),
                ),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

class _NotificationCard extends StatelessWidget {
  const _NotificationCard({required this.item, required this.onTap});

  final PatientNotification item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: item.isRead ? item.title : 'Thông báo chưa đọc: ${item.title}',
    child: Card(
      margin: EdgeInsets.zero,
      color: item.isRead
          ? Colors.white
          : Theme.of(
              context,
            ).colorScheme.primaryContainer.withValues(alpha: 0.55),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: item.type.background,
                  borderRadius: BorderRadius.circular(15),
                ),
                child: Icon(item.type.icon, color: item.type.foreground),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Text(
                            item.title,
                            style: Theme.of(context).textTheme.titleSmall
                                ?.copyWith(
                                  fontWeight: item.isRead
                                      ? FontWeight.w700
                                      : FontWeight.w900,
                                ),
                          ),
                        ),
                        if (!item.isRead) ...[
                          const SizedBox(width: 8),
                          Container(
                            width: 9,
                            height: 9,
                            decoration: BoxDecoration(
                              color: Theme.of(context).colorScheme.primary,
                              shape: BoxShape.circle,
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 5),
                    Text(
                      item.body,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                        height: 1.35,
                      ),
                    ),
                    const SizedBox(height: 9),
                    Row(
                      children: [
                        Icon(
                          Icons.schedule_rounded,
                          size: 15,
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                        const SizedBox(width: 5),
                        Text(
                          _formatNotificationTime(item.publishedAt),
                          style: Theme.of(context).textTheme.bodySmall
                              ?.copyWith(
                                color: Theme.of(
                                  context,
                                ).colorScheme.onSurfaceVariant,
                              ),
                        ),
                        if (item.safeDestination != null) ...[
                          const Spacer(),
                          Icon(
                            Icons.chevron_right_rounded,
                            color: Theme.of(context).colorScheme.primary,
                          ),
                        ],
                      ],
                    ),
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

String _formatNotificationTime(DateTime value) {
  final local = value.toLocal();
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final date = DateTime(local.year, local.month, local.day);
  final time =
      '${local.hour.toString().padLeft(2, '0')}:'
      '${local.minute.toString().padLeft(2, '0')}';
  if (date == today) return time;
  if (date == today.subtract(const Duration(days: 1))) {
    return 'Hôm qua · $time';
  }
  return '${local.day.toString().padLeft(2, '0')}/'
      '${local.month.toString().padLeft(2, '0')}/${local.year} · $time';
}

class _NotificationsLoading extends StatelessWidget {
  const _NotificationsLoading();

  @override
  Widget build(BuildContext context) => ListView.separated(
    padding: const EdgeInsets.all(16),
    itemCount: 5,
    separatorBuilder: (_, _) => const SizedBox(height: 10),
    itemBuilder: (_, index) =>
        AppLoadingSkeleton(height: index == 0 ? 96 : 122),
  );
}
