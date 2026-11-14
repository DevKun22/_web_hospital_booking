import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/features/notifications/domain/push_permission_status.dart';
import 'package:hospital_booking_mobile/core/theme/app_theme.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/notifications/application/push_notifications_controller.dart';

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
        const Divider(height: 1),
        ListTile(
          key: const Key('profile-dependents'),
          leading: const Icon(Icons.family_restroom_outlined),
          title: const Text('Hồ sơ người thân'),
          subtitle: const Text('Quản lý người được bạn đặt lịch'),
          trailing: const Icon(Icons.chevron_right_rounded),
          onTap: () => context.push('/dependents'),
        ),
        const Divider(height: 1),
        ListTile(
          leading: const Icon(Icons.event_note_outlined),
          title: const Text('Lịch khám của tôi'),
          trailing: const Icon(Icons.chevron_right_rounded),
          onTap: () => context.push('/appointments'),
        ),
        const Divider(height: 1),
        ListTile(
          leading: const Icon(Icons.folder_shared_outlined),
          title: const Text('Kết quả khám'),
          trailing: const Icon(Icons.chevron_right_rounded),
          onTap: () => context.push('/medical-records'),
        ),
        const Divider(height: 1),
        ListTile(
          leading: const Icon(Icons.medication_outlined),
          title: const Text('Đơn thuốc'),
          trailing: const Icon(Icons.chevron_right_rounded),
          onTap: () => context.push('/prescriptions'),
        ),
        const Divider(height: 1),
        ListTile(
          leading: const Icon(Icons.receipt_long_outlined),
          title: const Text('Hóa đơn và BHYT'),
          trailing: const Icon(Icons.chevron_right_rounded),
          onTap: () => context.push('/invoices'),
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
        color: AppTheme.clinicalInk,
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
                      ? AppTheme.primary
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
