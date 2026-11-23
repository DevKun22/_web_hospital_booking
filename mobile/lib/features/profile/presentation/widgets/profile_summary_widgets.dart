import 'package:hospital_booking_mobile/core/widgets/app_zone.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/widgets/app_motion.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/profile/domain/patient_profile.dart';

/// Đầu tab Tài khoản: thẻ xanh có chữ cái đầu, tên, email và dải "đủ N/6 mục" kèm nút hoàn thiện (chỉ khi còn thiếu).
class ProfileHeader extends StatelessWidget {
  const ProfileHeader({super.key, required this.profile, this.onComplete});

  final PatientProfile profile;

  /// Bấm "Hoàn thiện": mở trang thông tin cá nhân.
  final VoidCallback? onComplete;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final missing = profile.completedCount < profile.totalCount;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [AppPalette.heroDeep, AppPalette.heroMid],
        ),
        borderRadius: BorderRadius.circular(AppRadius.xl),
      ),
      child: Column(
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 26,
                backgroundColor: AppPalette.onHero,
                child: Text(
                  profile.fullName.isEmpty
                      ? 'B'
                      : profile.fullName.substring(0, 1).toUpperCase(),
                  style: text.titleLarge?.copyWith(color: AppPalette.heroDeep),
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
                      style: text.titleMedium?.copyWith(
                        color: AppPalette.onHero,
                      ),
                    ),
                    if (profile.email != null)
                      Text(
                        profile.email!,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: text.bodySmall?.copyWith(
                          color: AppPalette.onHeroMuted,
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Container(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.sm,
              vertical: AppSpacing.xs,
            ),
            decoration: BoxDecoration(
              color: AppPalette.onHeroFaint,
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            child: Wrap(
              alignment: WrapAlignment.spaceBetween,
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: AppSpacing.sm,
              children: [
                Text(
                  missing
                      ? 'Hồ sơ đã đủ ${profile.completedCount}/${profile.totalCount} mục'
                      : 'Hồ sơ đã đủ thông tin',
                  style: text.labelLarge?.copyWith(color: AppPalette.onHero),
                ),
                if (missing && onComplete != null)
                  TextButton(
                    key: const Key('profile-complete'),
                    onPressed: onComplete,
                    style: TextButton.styleFrom(
                      backgroundColor: AppPalette.onHero,
                      foregroundColor: AppPalette.heroDeep,
                      visualDensity: VisualDensity.compact,
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.md,
                      ),
                    ),
                    child: const Text('Hoàn thiện'),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Bốn lối tắt tròn màu: kết quả khám, đơn thuốc, hóa đơn, người thân.
class ProfileQuickTiles extends StatelessWidget {
  const ProfileQuickTiles({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final tiles = [
      (
        const Key('profile-medical-records'),
        Icons.folder_shared_outlined,
        'Kết quả',
        '/medical-records',
        colors.zone(AppZone.primary),
      ),
      (
        const Key('profile-prescriptions'),
        Icons.medication_outlined,
        'Đơn thuốc',
        '/prescriptions',
        colors.zone(AppZone.violet),
      ),
      (
        const Key('profile-invoices'),
        Icons.receipt_long_outlined,
        'Hóa đơn',
        '/invoices',
        colors.zone(AppZone.warning),
      ),
      (
        const Key('profile-dependents'),
        Icons.family_restroom_outlined,
        'Người thân',
        '/dependents',
        colors.zone(AppZone.care),
      ),
    ];
    return Row(
      children: [
        for (final tile in tiles)
          Expanded(
            child: PressScale(
              child: InkWell(
                key: tile.$1,
                borderRadius: BorderRadius.circular(AppRadius.md),
                onTap: () => context.push(tile.$4),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
                  child: Column(
                    children: [
                      AppIconTile(
                        icon: tile.$2,
                        tint: tile.$5,
                        size: AppTileSize.lg,
                        circle: true,
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        tile.$3,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.labelMedium,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class ProfileLoading extends StatelessWidget {
  const ProfileLoading({super.key});

  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(AppSpacing.page),
    children: const [
      AppLoadingSkeleton(height: 120),
      SizedBox(height: AppSpacing.sm),
      AppLoadingSkeleton(height: 80),
      SizedBox(height: AppSpacing.sm),
      AppLoadingSkeleton(height: 160),
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
