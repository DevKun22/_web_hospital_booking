import 'dart:async';

import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/features/notifications/presentation/notification_type_visuals.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/notifications/domain/patient_notification.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/formatters/vietnam_time.dart';

class NotificationInboxOverview extends StatelessWidget {
  const NotificationInboxOverview({
    super.key,
    required this.unreadCount,
    required this.total,
  });

  final int unreadCount;
  final int total;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(18),
    decoration: BoxDecoration(
      gradient: LinearGradient(
        colors: [AppPalette.heroDeep, AppPalette.heroMid],
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
                    : '$total thông báo từ DevKunCare',
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

class NotificationCard extends StatelessWidget {
  const NotificationCard({super.key, required this.item, required this.onTap});

  final PatientNotification item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: item.isRead ? item.title : 'Thông báo chưa đọc: ${item.title}',
    child: Card(
      margin: EdgeInsets.zero,
      color: item.isRead
          ? context.colors.surface
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
                  color: item.type.background(context.colors),
                  borderRadius: BorderRadius.circular(15),
                ),
                child: Icon(
                  item.type.icon,
                  color: item.type.foreground(context.colors),
                ),
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
                        RelativeTimeText(
                          value: item.publishedAt,
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

class NotificationsLoading extends StatelessWidget {
  const NotificationsLoading({super.key});

  @override
  Widget build(BuildContext context) => ListView.separated(
    padding: const EdgeInsets.all(16),
    itemCount: 5,
    separatorBuilder: (_, _) => const SizedBox(height: 10),
    itemBuilder: (_, index) =>
        AppLoadingSkeleton(height: index == 0 ? 96 : 122),
  );
}

/// Nhãn thời gian tương đối ("Vừa xong", "5 phút trước"), tự làm mới mỗi 30 giây khi
/// thông báo còn mới (dưới 1 giờ) để không bị đứng hình khi màn đang mở.
class RelativeTimeText extends StatefulWidget {
  const RelativeTimeText({super.key, required this.value, this.style});

  final DateTime value;
  final TextStyle? style;

  @override
  State<RelativeTimeText> createState() => _RelativeTimeTextState();
}

class _RelativeTimeTextState extends State<RelativeTimeText> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _scheduleIfRecent();
  }

  @override
  void didUpdateWidget(covariant RelativeTimeText oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.value != widget.value) _scheduleIfRecent();
  }

  void _scheduleIfRecent() {
    _timer?.cancel();
    final age = DateTime.now().difference(widget.value);
    if (age.isNegative || age >= const Duration(hours: 1)) return;
    _timer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (!mounted) return;
      setState(() {});
      if (DateTime.now().difference(widget.value) >= const Duration(hours: 1)) {
        _timer?.cancel();
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) =>
      Text(formatRelativeVietnamTime(widget.value), style: widget.style);
}
