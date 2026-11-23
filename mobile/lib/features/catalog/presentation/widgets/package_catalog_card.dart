import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/app/navigation/booking_navigation.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/core/widgets/app_zone.dart';
import 'package:hospital_booking_mobile/features/packages/domain/medical_package.dart';
import 'package:hospital_booking_mobile/features/catalog/presentation/department_visuals.dart';

/// Thẻ gói khám: ô biểu tượng theo khoa, tên, mô tả một đến hai dòng, nhãn gọn và giá trọn gói làm tiêu điểm.
class PackageCatalogCard extends StatelessWidget {
  const PackageCatalogCard({required this.item, super.key});

  final MedicalPackage item;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final text = Theme.of(context).textTheme;
    final visual = item.departmentName == null
        ? (
            icon: Icons.health_and_safety_outlined,
            tint: colors.zone(AppZone.primary),
          )
        : departmentVisual(context, name: item.departmentName!);
    final slug = item.slug;
    return AppSurfaceCard(
      onTap: slug == null
          ? null
          : () => context.push('/packages/${Uri.encodeComponent(slug)}'),
      semanticLabel: 'Gói ${item.name}, ${formatVnd(item.finalPrice)}',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AppIconTile(
                icon: visual.icon,
                tint: visual.tint,
                size: AppTileSize.lg,
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: text.titleSmall,
                    ),
                    if (item.summary != null) ...[
                      const SizedBox(height: AppSpacing.hair),
                      Text(
                        item.summary!,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: text.bodySmall?.copyWith(color: colors.muted),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          if (item.isPopular || item.isBhytSupport) ...[
            const SizedBox(height: AppSpacing.sm),
            Wrap(
              spacing: AppSpacing.xs,
              runSpacing: AppSpacing.xxs,
              children: [
                if (item.isPopular)
                  AppPill(label: 'Nổi bật', tint: colors.zone(AppZone.warning)),
                if (item.isBhytSupport)
                  AppPill(label: 'Có BHYT', tint: colors.zone(AppZone.success)),
              ],
            ),
          ],
          const SizedBox(height: AppSpacing.sm),
          DecoratedBox(
            decoration: BoxDecoration(
              color: colors.surfaceMuted,
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.sm,
                vertical: AppSpacing.xs,
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Giá trọn gói',
                          style: text.labelSmall?.copyWith(color: colors.muted),
                        ),
                        Text(
                          formatVnd(item.finalPrice),
                          style: text.titleMedium?.copyWith(
                            color: colors.primaryDark,
                          ),
                        ),
                      ],
                    ),
                  ),
                  FilledButton(
                    onPressed: () => openBookingFromCurrentRoute(
                      context,
                      Uri(
                        path: '/booking',
                        queryParameters: {
                          'packageId': item.id,
                          'departmentId': ?item.departmentId,
                        },
                      ).toString(),
                    ),
                    child: const Text('Chọn gói'),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
