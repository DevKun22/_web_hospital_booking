import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/design/app_design_tokens.dart';
import 'package:hospital_booking_mobile/core/widgets/app_info_list.dart';
import 'package:hospital_booking_mobile/features/notifications/application/push_notifications_controller.dart';
import 'package:hospital_booking_mobile/features/notifications/domain/push_permission_status.dart';
import 'package:hospital_booking_mobile/features/profile/domain/patient_profile.dart';

/// Hai khối danh sách của tab Tài khoản: "Hồ sơ" (cá nhân, BHYT, sức khỏe kèm chip trạng thái) và "Ứng dụng".
class ProfileMenuGroups extends StatelessWidget {
  const ProfileMenuGroups({
    super.key,
    required this.profile,
    required this.pushState,
  });

  final PatientProfile profile;
  final PushNotificationsState pushState;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final insurance = !profile.hasBhyt
        ? ('Không dùng', colors.muted, colors.surfaceMuted)
        : (profile.healthInsuranceCode == null
              ? ('Thiếu mã', colors.warning, colors.warningContainer)
              : ('Đã có', colors.success, colors.successContainer));
    final health = profile.hasHealthInfo
        ? ('Đã có', colors.success, colors.successContainer)
        : ('Thiếu', colors.warning, colors.warningContainer);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AppInfoSection(
          title: 'Hồ sơ',
          children: [
            _MenuRow(
              key: const Key('profile-personal'),
              icon: Icons.person_outline_rounded,
              title: 'Thông tin cá nhân',
              onTap: () => context.push('/profile/personal'),
            ),
            _MenuRow(
              key: const Key('profile-insurance'),
              icon: Icons.health_and_safety_outlined,
              title: 'Bảo hiểm y tế',
              chip: insurance,
              onTap: () => context.push('/profile/health'),
            ),
            _MenuRow(
              key: const Key('profile-health'),
              icon: Icons.monitor_heart_outlined,
              title: 'Sức khỏe',
              chip: health,
              onTap: () => context.push('/profile/health'),
            ),
          ],
        ),
        AppInfoSection(
          title: 'Ứng dụng',
          children: [
            _MenuRow(
              key: const Key('profile-mobile-tools'),
              icon: Icons.qr_code_2_rounded,
              title: 'Thẻ số và bảo mật',
              onTap: () => context.push('/mobile-tools'),
            ),
            _MenuRow(
              key: const Key('profile-notification-settings'),
              icon: Icons.notifications_none_rounded,
              title: 'Thông báo',
              trailingText: profileNotificationStatus(pushState),
              highlight: pushState.isAllowed,
              onTap: () => context.push('/notification-settings'),
            ),
            _MenuRow(
              key: const Key('profile-support-center'),
              icon: Icons.support_agent_rounded,
              title: 'Trung tâm hỗ trợ',
              onTap: () => context.push('/support'),
            ),
          ],
        ),
      ],
    );
  }
}

class _MenuRow extends StatelessWidget {
  const _MenuRow({
    super.key,
    required this.icon,
    required this.title,
    required this.onTap,
    this.chip,
    this.trailingText,
    this.highlight = false,
  });

  final IconData icon;
  final String title;
  final VoidCallback onTap;

  /// Chip trạng thái (nhãn, màu chữ, màu nền).
  final (String, Color, Color)? chip;
  final String? trailingText;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final text = Theme.of(context).textTheme;
    return InkWell(
      onTap: onTap,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: AppSize.optionRowHeight),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
          child: Row(
            children: [
              Icon(icon, size: 22, color: colors.primary),
              const SizedBox(width: AppSpacing.sm),
              Expanded(child: Text(title, style: text.bodyLarge)),
              if (chip != null)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 3,
                  ),
                  decoration: BoxDecoration(
                    color: chip!.$3,
                    borderRadius: BorderRadius.circular(AppRadius.pill),
                  ),
                  child: Text(
                    chip!.$1,
                    style: text.labelMedium?.copyWith(
                      color: chip!.$2,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              if (trailingText != null)
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
              Icon(Icons.chevron_right_rounded, color: colors.muted),
            ],
          ),
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
