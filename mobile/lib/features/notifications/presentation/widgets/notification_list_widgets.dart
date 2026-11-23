import 'dart:async';

import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/features/notifications/presentation/notification_type_visuals.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/notifications/domain/patient_notification.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/formatters/vietnam_time.dart';

/// Dòng tóm tắt hộp thư: số chưa đọc bên trái, tổng số bên phải; chỉ một dòng chữ nhỏ.
class NotificationInboxOverview extends StatelessWidget {
  const NotificationInboxOverview({
    super.key,
    required this.unreadCount,
    required this.total,
  });

  final int unreadCount;
  final int total;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final colors = context.colors;
    return Row(
      children: [
        Expanded(
          child: Text(
            total == 0
                ? 'Hộp thư đang trống'
                : unreadCount == 0
                ? 'Bạn đã xem tất cả cập nhật'
                : '$unreadCount thông báo chưa đọc',
            style: text.labelLarge?.copyWith(
              color: unreadCount > 0 ? colors.primaryDark : colors.muted,
            ),
          ),
        ),
        if (total > 0)
          Text(
            '$total thông báo',
            style: text.labelMedium?.copyWith(color: colors.muted),
          ),
      ],
    );
  }
}

/// Một thông báo dạng dòng gọn: biểu tượng tròn màu theo loại, tiêu đề và giờ cùng hàng, nội dung một dòng.
/// Chưa đọc có nền xanh nhạt và chấm; đã đọc nền trắng.
class NotificationCard extends StatelessWidget {
  const NotificationCard({super.key, required this.item, required this.onTap});

  final PatientNotification item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final text = Theme.of(context).textTheme;
    return Semantics(
      button: true,
      label: item.isRead ? item.title : 'Thông báo chưa đọc: ${item.title}',
      child: Material(
        color: item.isRead ? colors.surface : colors.primarySoft,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.sm,
              vertical: 10,
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: item.isRead
                        ? item.type.background(colors)
                        : colors.surface,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    item.type.icon,
                    size: 19,
                    color: item.type.foreground(colors),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.baseline,
                        textBaseline: TextBaseline.alphabetic,
                        children: [
                          Expanded(
                            child: Text(
                              item.title,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: text.titleSmall?.copyWith(
                                fontWeight: item.isRead
                                    ? FontWeight.w500
                                    : FontWeight.w600,
                              ),
                            ),
                          ),
                          const SizedBox(width: 6),
                          RelativeTimeText(
                            value: item.publishedAt,
                            style: text.labelMedium?.copyWith(
                              color: colors.muted,
                            ),
                          ),
                        ],
                      ),
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              item.body,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: text.bodySmall?.copyWith(
                                color: colors.muted,
                              ),
                            ),
                          ),
                          if (!item.isRead) ...[
                            const SizedBox(width: 8),
                            Container(
                              width: 8,
                              height: 8,
                              decoration: BoxDecoration(
                                color: colors.primary,
                                shape: BoxShape.circle,
                              ),
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
}

class NotificationsLoading extends StatelessWidget {
  const NotificationsLoading({super.key});

  @override
  Widget build(BuildContext context) => ListView.separated(
    padding: const EdgeInsets.all(16),
    itemCount: 5,
    separatorBuilder: (_, _) => const SizedBox(height: 10),
    itemBuilder: (_, index) => AppLoadingSkeleton(height: index == 0 ? 24 : 64),
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
