import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/features/notifications/domain/push_permission_status.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/notifications/application/push_notifications_controller.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';

class ProfilePatientShortcuts extends StatelessWidget {
  const ProfilePatientShortcuts({super.key});

  @override
  Widget build(BuildContext context) => Card(
    margin: EdgeInsets.zero,
    child: Column(
      children: [
        ListTile(
          key: const Key('profile-mobile-tools'),
          leading: const Icon(Icons.phone_android_rounded),
          title: const Text('Thẻ số & bảo mật thiết bị'),
          subtitle: const Text('QR người khám và khóa ứng dụng'),
          trailing: const Icon(Icons.chevron_right_rounded),
          onTap: () => context.push('/mobile-tools'),
        ),
      ],
    ),
  );
}

class ProfileGroupTitle extends StatelessWidget {
  const ProfileGroupTitle({super.key, required this.title});

  final String title;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(left: 4),
    child: Text(
      title,
      style: Theme.of(context).textTheme.titleMedium?.copyWith(
        color: context.colors.ink,
        fontWeight: FontWeight.w900,
      ),
    ),
  );
}

class ProfileAppSupportSection extends StatelessWidget {
  const ProfileAppSupportSection({super.key, required this.pushState});

  final PushNotificationsState pushState;

  @override
  Widget build(BuildContext context) => Card(
    margin: EdgeInsets.zero,
    child: Column(
      children: [
        ListTile(
          key: const Key('profile-notification-settings'),
          leading: const Icon(Icons.notifications_none_rounded),
          title: const Text('Thông báo'),
          subtitle: const Text('Lịch khám, kết quả và hóa đơn'),
          trailing: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                profileNotificationStatus(pushState),
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: pushState.isAllowed
                      ? context.colors.primary
                      : Theme.of(context).colorScheme.onSurfaceVariant,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(width: 4),
              const Icon(Icons.chevron_right_rounded),
            ],
          ),
          onTap: () => context.push('/notification-settings'),
        ),
        const Divider(height: 1),
        ListTile(
          key: const Key('profile-support-center'),
          leading: const Icon(Icons.support_agent_rounded),
          title: const Text('Trung tâm hỗ trợ'),
          subtitle: const Text('Hotline, cấp cứu và câu hỏi thường gặp'),
          trailing: const Icon(Icons.chevron_right_rounded),
          onTap: () => context.push('/support'),
        ),
      ],
    ),
  );
}

class ProfileSection extends StatelessWidget {
  const ProfileSection({
    super.key,
    required this.title,
    required this.icon,
    required this.children,
  });

  final String title;
  final IconData icon;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Card(
    margin: EdgeInsets.zero,
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: Theme.of(context).colorScheme.primary),
              const SizedBox(width: 10),
              Text(
                title,
                style: Theme.of(
                  context,
                ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ...children,
        ],
      ),
    ),
  );
}

class ProfileRow extends StatelessWidget {
  const ProfileRow({
    super.key,
    required this.label,
    required this.value,
    this.showDivider = true,
  });

  final String label;
  final String? value;
  final bool showDivider;

  @override
  Widget build(BuildContext context) => Column(
    children: [
      Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 118,
              child: Text(
                label,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                value?.trim().isNotEmpty == true ? value! : 'Chưa cập nhật',
                textAlign: TextAlign.right,
                style: Theme.of(
                  context,
                ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
      ),
      if (showDivider) const Divider(height: 1),
    ],
  );
}

class ProfileLoading extends StatelessWidget {
  const ProfileLoading({super.key});

  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(16),
    children: const [
      AppLoadingSkeleton(height: 150),
      SizedBox(height: 14),
      AppLoadingSkeleton(height: 130),
      SizedBox(height: 14),
      AppLoadingSkeleton(height: 300),
    ],
  );
}

String profileNotificationStatus(PushNotificationsState state) {
  if (state.isCheckingPermission) return 'Đang kiểm tra';
  return switch (state.permission) {
    PushPermissionStatus.authorized =>
      state.isTokenRegistered ? 'Đang bật' : 'Đang đồng bộ',
    PushPermissionStatus.provisional => 'Tạm thời',
    PushPermissionStatus.denied => 'Đang tắt',
    PushPermissionStatus.notDetermined => 'Chưa thiết lập',
    PushPermissionStatus.unknown => 'Chưa xác định',
  };
}
