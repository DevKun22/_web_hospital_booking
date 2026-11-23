import 'dart:async';

import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/core/config/app_brand.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/design/app_design_tokens.dart';
import 'package:hospital_booking_mobile/core/widgets/app_motion.dart';
import 'package:hospital_booking_mobile/core/widgets/resized_network_image.dart';
import 'package:hospital_booking_mobile/features/articles/domain/article_summary.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:hospital_booking_mobile/features/home/presentation/widgets/home_strip_parts.dart';

/// Bài viết mới: ô ảnh vuông 64 (ảnh bìa hoặc biểu tượng màu), tiêu đề, dấu bác sĩ duyệt và ngày. Chạm mở bài trên website.
class HomeArticleList extends StatelessWidget {
  const HomeArticleList({super.key, required this.items});

  final List<ArticleSummary> items;

  @override
  Widget build(BuildContext context) => Column(
    children: [
      for (final (index, item) in items.indexed)
        Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.xs),
          child: _ArticleRow(item: item, tint: homeTint(context, index + 5)),
        ),
    ],
  );
}

class _ArticleRow extends StatelessWidget {
  const _ArticleRow({required this.item, required this.tint});

  final ArticleSummary item;
  final ({Color background, Color foreground}) tint;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final colors = context.colors;
    final image = resizedNetworkImage(
      context,
      item.coverImage,
      logicalWidth: 64,
      logicalHeight: 64,
    );
    return PressScale(
      child: Material(
        color: colors.surface,
        clipBehavior: Clip.antiAlias,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
          side: BorderSide(color: colors.border, width: 0.5),
        ),
        child: InkWell(
          onTap: () => unawaited(
            launchUrl(
              Uri.parse('${AppBrand.webUrl}/kien-thuc/${item.slug}'),
              mode: LaunchMode.externalApplication,
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.sm),
            child: Row(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(AppRadius.sm + 2),
                  child: Container(
                    width: 64,
                    height: 64,
                    color: tint.background,
                    child: image == null
                        ? Icon(
                            Icons.menu_book_outlined,
                            color: tint.foreground,
                            size: 28,
                          )
                        : Image(image: image, fit: BoxFit.cover),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: text.titleSmall?.copyWith(color: colors.ink),
                      ),
                      const SizedBox(height: AppSpacing.xxs),
                      Row(
                        children: [
                          if (item.reviewerName != null)
                            Text(
                              'Bác sĩ duyệt',
                              style: text.labelMedium?.copyWith(
                                color: colors.primary,
                              ),
                            ),
                          if (item.reviewerName != null &&
                              item.publishedAt != null)
                            const SizedBox(width: AppSpacing.xs),
                          if (item.publishedAt != null)
                            Text(
                              _shortDate(item.publishedAt!),
                              style: text.bodySmall?.copyWith(
                                color: colors.muted,
                              ),
                            ),
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

String _shortDate(DateTime value) =>
    '${value.day.toString().padLeft(2, '0')}/${value.month.toString().padLeft(2, '0')}/${value.year}';
