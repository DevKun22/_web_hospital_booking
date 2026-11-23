import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/widgets/app_motion.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/profile/domain/patient_profile.dart';

/// Đầu tab Tài khoản gọn một khối: chữ cái đầu, tên, số điện thoại ẩn bớt, nhãn đã xác thực và nút sửa.
class ProfileHeader extends StatelessWidget {
  const ProfileHeader({super.key, required this.profile, this.onEdit});

  final PatientProfile profile;
  final VoidCallback? onEdit;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final text = Theme.of(context).textTheme;
    return Row(
      children: [
        CircleAvatar(
          radius: 26,
          backgroundColor: colors.primary,
          child: Text(
            profile.fullName.isEmpty
                ? 'B'
                : profile.fullName.substring(0, 1).toUpperCase(),
            style: text.titleLarge?.copyWith(color: colors.onPrimary),
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                profile.fullName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: text.titleMedium,
              ),
              Wrap(
                spacing: AppSpacing.xs,
                runSpacing: 2,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  Text(
                    profile.phone == null
                        ? 'Chưa cập nhật số điện thoại'
                        : maskPhone(profile.phone!),
                    style: text.bodySmall?.copyWith(color: colors.muted),
                  ),
                  if (profile.isEmailVerified)
                    const AppStatusBadge(
                      label: 'Email đã xác thực',
                      tone: AppStatusTone.success,
                    ),
                ],
              ),
            ],
          ),
        ),
        if (onEdit != null)
          IconButton(
            key: const Key('profile-edit'),
            tooltip: 'Chỉnh sửa hồ sơ',
            onPressed: onEdit,
            icon: Icon(Icons.edit_outlined, color: colors.primary),
          ),
      ],
    );
  }
}

/// Dải vàng mỏng nhắc hoàn thiện hồ sơ; chỉ hiện khi hồ sơ chưa đủ, chạm để mở màn chỉnh sửa.
class ProfileCompletionBanner extends StatelessWidget {
  const ProfileCompletionBanner({
    super.key,
    required this.profile,
    required this.onTap,
  });

  final PatientProfile profile;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final text = Theme.of(context).textTheme;
    final percent = profile.completionPercent;
    return Semantics(
      button: true,
      label: 'Hồ sơ mới đủ $percent phần trăm. Bổ sung thông tin',
      child: ExcludeSemantics(
        child: Material(
          color: colors.warningContainer,
          borderRadius: BorderRadius.circular(AppRadius.md),
          child: InkWell(
            borderRadius: BorderRadius.circular(AppRadius.md),
            onTap: onTap,
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.sm),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Hồ sơ mới đủ $percent%',
                          style: text.titleSmall?.copyWith(
                            color: colors.warning,
                          ),
                        ),
                      ),
                      Text(
                        'Bổ sung',
                        style: text.labelLarge?.copyWith(
                          color: colors.warning,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(AppRadius.pill),
                    child: LinearProgressIndicator(
                      value: percent / 100,
                      minHeight: 5,
                      backgroundColor: colors.surface,
                      color: colors.warning,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Bốn lối tắt màu: kết quả khám, đơn thuốc, hóa đơn, người thân.
class ProfileQuickTiles extends StatelessWidget {
  const ProfileQuickTiles({super.key});

  @override
  Widget build(BuildContext context) {
    final tints = context.colors.tintPairs;
    final tiles = [
      (
        const Key('profile-medical-records'),
        Icons.folder_shared_outlined,
        'Kết quả khám',
        '/medical-records',
        tints[1],
      ),
      (
        const Key('profile-prescriptions'),
        Icons.medication_outlined,
        'Đơn thuốc',
        '/prescriptions',
        tints[5],
      ),
      (
        const Key('profile-invoices'),
        Icons.receipt_long_outlined,
        'Hóa đơn',
        '/invoices',
        tints[3],
      ),
      (
        const Key('profile-dependents'),
        Icons.family_restroom_outlined,
        'Người thân',
        '/dependents',
        tints[4],
      ),
    ];
    return LayoutBuilder(
      builder: (context, constraints) {
        const gap = AppSpacing.xs;
        final width = (constraints.maxWidth - gap) / 2;
        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: [
            for (final tile in tiles)
              SizedBox(
                width: width,
                child: PressScale(
                  child: Material(
                    color: tile.$5.background,
                    borderRadius: BorderRadius.circular(AppRadius.md),
                    child: InkWell(
                      key: tile.$1,
                      borderRadius: BorderRadius.circular(AppRadius.md),
                      onTap: () => context.push(tile.$4),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.sm,
                          vertical: AppSpacing.sm,
                        ),
                        child: Row(
                          children: [
                            Icon(tile.$2, color: tile.$5.foreground),
                            const SizedBox(width: AppSpacing.xs),
                            Expanded(
                              child: Text(
                                tile.$3,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: Theme.of(context).textTheme.titleSmall
                                    ?.copyWith(color: tile.$5.foreground),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}

class ProfileLoading extends StatelessWidget {
  const ProfileLoading({super.key});

  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(AppSpacing.page),
    children: const [
      AppLoadingSkeleton(height: 64),
      SizedBox(height: AppSpacing.sm),
      AppLoadingSkeleton(height: 56),
      SizedBox(height: AppSpacing.sm),
      AppLoadingSkeleton(height: 120),
    ],
  );
}

/// Che giữa mã thẻ BHYT, chỉ để lại 3 ký tự đầu và cuối.
String? maskInsuranceCode(String? value) {
  final normalized = value?.trim();
  if (normalized == null || normalized.isEmpty) return null;
  if (normalized.length <= 6) return normalized;
  return '${normalized.substring(0, 3)}•••${normalized.substring(normalized.length - 3)}';
}

String maskPhone(String value) {
  final digits = value.replaceAll(RegExp(r'\D'), '');
  if (digits.length < 7) return value;
  return '${digits.substring(0, 4)} ••• ${digits.substring(digits.length - 3)}';
}
