import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/features/notifications/presentation/notification_type_visuals.dart';
import 'package:hospital_booking_mobile/core/widgets/app_error_banner.dart';
import 'package:hospital_booking_mobile/core/widgets/app_route_back_scope.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/notifications/application/notifications_controller.dart';
import 'package:hospital_booking_mobile/features/notifications/application/push_notifications_controller.dart';
import 'package:hospital_booking_mobile/features/notifications/domain/patient_notification.dart';
import 'package:hospital_booking_mobile/features/notifications/presentation/widgets/notification_list_widgets.dart';
import 'package:hospital_booking_mobile/features/notifications/presentation/widgets/notification_push_cards.dart';

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
            ? const NotificationsLoading()
            : RefreshIndicator(
                onRefresh: controller.refresh,
                child: ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: EdgeInsets.fromLTRB(
                    16,
                    8,
                    16,
                    widget.embeddedInMainNavigation
                        ? appMainContentBottomInset
                        : 28,
                  ),
                  children: [
                    if (!pushState.isCheckingPermission &&
                        !pushState.isAllowed) ...[
                      NotificationPushPermissionCard(state: pushState),
                      const SizedBox(height: 14),
                    ] else if (pushState.isAllowed &&
                        (!pushState.isTokenRegistered ||
                            pushState.isRegisteringToken)) ...[
                      NotificationPushSyncCard(state: pushState),
                      const SizedBox(height: 14),
                    ],
                    NotificationInboxOverview(
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
                  color: item.type.background(context.colors),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(
                  item.type.icon,
                  color: item.type.foreground(context.colors),
                ),
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
      widgets.add(NotificationCard(item: item, onTap: () => onTap(item)));
      widgets.add(const SizedBox(height: 10));
    }
  }

  addGroup('Hôm nay', todayItems);
  addGroup('Trước đó', earlierItems);
  return widgets;
}
