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
                backgroundColor: Colors.white,
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
                      style: text.titleMedium?.copyWith(color: Colors.white),
                    ),
                    if (profile.email != null)
                      Text(
                        profile.email!,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: text.bodySmall?.copyWith(color: Colors.white70),
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
              color: Colors.white.withValues(alpha: 0.16),
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
                  style: text.labelLarge?.copyWith(color: Colors.white),
                ),
                if (missing && onComplete != null)
                  TextButton(
                    key: const Key('profile-complete'),
                    onPressed: onComplete,
                    style: TextButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: AppPalette.heroDeep,
                      visualDensity: VisualDensity.compact,
                      padding: const EdgeInsets.symmetric(horizontal: 14),
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
    final tints = context.colors.tintPairs;
    final tiles = [
      (
        const Key('profile-medical-records'),
        Icons.folder_shared_outlined,
        'Kết quả',
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
                      Container(
                        width: 52,
                        height: 52,
                        decoration: BoxDecoration(
                          color: tile.$5.background,
                          shape: BoxShape.circle,
                        ),
                        child: Icon(tile.$2, color: tile.$5.foreground),
                      ),
                      const SizedBox(height: 6),
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
