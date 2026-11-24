import 'package:hospital_booking_mobile/core/widgets/app_entity_mark.dart';
import 'package:hospital_booking_mobile/core/widgets/app_zone.dart';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/app/navigation/booking_navigation.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/design/app_design_tokens.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:hospital_booking_mobile/features/catalog/domain/catalog_entities.dart';

import 'package:hospital_booking_mobile/features/home/presentation/widgets/home_strip_parts.dart';

/// Dải gói khám: ảnh hoặc chữ viết tắt, nhãn nổi bật, tên, mô tả ngắn, nhãn BHYT và giá lớn.
class HomePackageStrip extends StatelessWidget {
  const HomePackageStrip({super.key, required this.items});

  final List<CatalogMedicalPackage> items;

  @override
  Widget build(BuildContext context) => SizedBox(
    height: homeStripHeight(context, 226),
    child: homeClampedStrip(
      context,
      ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: items.length,
        separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.sm),
        itemBuilder: (context, index) {
          final item = items[index];
          final text = Theme.of(context).textTheme;
          final colors = context.colors;
          return HomeStripCard(
            width: 216,
            onTap: item.slug == null
                ? () => openBookingFromCurrentRoute(
                    context,
                    '/booking?packageId=${item.id}',
                  )
                : () => context.push(
                    '/packages/${Uri.encodeComponent(item.slug!)}',
                  ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    AppEntityMark(
                      name: item.name,
                      image: item.image,
                      size: AppTileSize.sm,
                    ),
                    const Spacer(),
                    if (item.isPopular)
                      AppPill(
                        label: 'Nổi bật',
                        tint: (
                          background: colors.warningContainer,
                          foreground: colors.warning,
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  item.name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: text.titleSmall?.copyWith(color: colors.ink),
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
                const Spacer(),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        formatVnd(item.finalPrice),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: text.titleMedium?.copyWith(
                          color: colors.primaryDark,
                        ),
                      ),
                    ),
                    if (item.isBhytSupport)
                      AppPill(
                        label: 'BHYT',
                        tint: (
                          background: colors.primarySoft,
                          foreground: colors.primaryDark,
                        ),
                      ),
                  ],
                ),
              ],
            ),
          );
        },
      ),
    ),
  );
}
