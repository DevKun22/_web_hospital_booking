import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/features/notifications/application/push_notifications_controller.dart';
import 'package:hospital_booking_mobile/features/notifications/domain/push_permission_status.dart';

/// Danh sách một khối: mỗi mục một dòng (biểu tượng, tên, chữ phụ bên phải, mũi tên), ngăn bằng đường kẻ mảnh.
class ProfileMenuList extends StatelessWidget {
  const ProfileMenuList({
    super.key,
    required this.pushState,
    this.onEditProfile,
  });

  final PushNotificationsState pushState;
  final VoidCallback? onEditProfile;

  @override
  Widget build(BuildContext context) {
    final items = [
      _MenuItem(
        key: const Key('profile-edit-row'),
        icon: Icons.badge_outlined,
        title: 'Thông tin cá nhân và BHYT',
        onTap: onEditProfile,
      ),
      _MenuItem(
        key: const Key('profile-mobile-tools'),
        icon: Icons.qr_code_2_rounded,
        title: 'Thẻ số và bảo mật',
        onTap: () => context.push('/mobile-tools'),
      ),
      _MenuItem(
        key: const Key('profile-notification-settings'),
        icon: Icons.notifications_none_rounded,
        title: 'Thông báo',
        trailingText: profileNotificationStatus(pushState),
        highlight: pushState.isAllowed,
        onTap: () => context.push('/notification-settings'),
      ),
      _MenuItem(
        key: const Key('profile-support-center'),
        icon: Icons.support_agent_rounded,
        title: 'Trung tâm hỗ trợ',
        onTap: () => context.push('/support'),
      ),
    ];
    final colors = context.colors;
    return ClipRRect(
      borderRadius: BorderRadius.circular(14),
      child: Material(
        color: colors.surface,
        child: Column(
          children: [
            for (var i = 0; i < items.length; i += 1) ...[
              if (i > 0) Divider(height: 0.5, thickness: 0.5, indent: 52),
              items[i],
            ],
          ],
        ),
      ),
    );
  }
}

class _MenuItem extends StatelessWidget {
  const _MenuItem({
    super.key,
    required this.icon,
    required this.title,
    required this.onTap,
    this.trailingText,
    this.highlight = false,
  });

  final IconData icon;
  final String title;
  final VoidCallback? onTap;
  final String? trailingText;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final text = Theme.of(context).textTheme;
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        child: Row(
          children: [
            Icon(icon, size: 22, color: colors.primary),
            const SizedBox(width: 14),
            Expanded(child: Text(title, style: text.bodyLarge)),
            if (trailingText != null) ...[
              Flexible(
                child: Text(
                  trailingText!,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: text.labelMedium?.copyWith(
                    color: highlight ? colors.primary : colors.muted,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              const SizedBox(width: 4),
            ],
            Icon(Icons.chevron_right_rounded, color: colors.muted),
          ],
        ),
      ),
    );
  }
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
