import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/app/navigation/booking_navigation.dart';
import 'package:hospital_booking_mobile/core/config/app_brand.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/design/app_design_tokens.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:hospital_booking_mobile/core/widgets/app_motion.dart';
import 'package:hospital_booking_mobile/core/widgets/resized_network_image.dart';
import 'package:hospital_booking_mobile/features/articles/domain/article_summary.dart';
import 'package:hospital_booking_mobile/features/catalog/domain/catalog_entities.dart';
import 'package:url_launcher/url_launcher.dart';

/// Thẻ nhỏ dùng chung của các dải ngang trên Trang chủ: viền mảnh, bo 14, nhấn vào thì co nhẹ.
class _StripCard extends StatelessWidget {
  const _StripCard({
    required this.width,
    required this.onTap,
    required this.child,
  });

  final double width;
  final VoidCallback onTap;
  final Widget child;

  @override
  Widget build(BuildContext context) => SizedBox(
    width: width,
    child: PressScale(
      child: Material(
        color: context.colors.surface,
        clipBehavior: Clip.antiAlias,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
          side: BorderSide(color: context.colors.border, width: 0.5),
        ),
        child: InkWell(
          onTap: onTap,
          child: Padding(padding: const EdgeInsets.all(10), child: child),
        ),
      ),
    ),
  );
}

/// Dải bác sĩ nổi bật: avatar, tên, chuyên khoa và giờ trống gần nhất hôm nay.
class HomeDoctorStrip extends StatelessWidget {
  const HomeDoctorStrip({super.key, required this.items});

  final List<CatalogDoctor> items;

  @override
  Widget build(BuildContext context) => SizedBox(
    height: 124,
    child: ListView.separated(
      scrollDirection: Axis.horizontal,
      itemCount: items.length,
      separatorBuilder: (_, _) => const SizedBox(width: 8),
      itemBuilder: (context, index) {
        final doctor = items[index];
        final slot = doctor.todayAvailableSlots.firstOrNull;
        final text = Theme.of(context).textTheme;
        return _StripCard(
          width: 152,
          onTap: () =>
              context.push('/doctors/${Uri.encodeComponent(doctor.id)}'),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  CircleAvatar(
                    radius: 18,
                    backgroundColor: context.colors.primarySoft,
                    backgroundImage: resizedNetworkImage(
                      context,
                      doctor.avatar,
                      logicalWidth: 36,
                      logicalHeight: 36,
                    ),
                    child: doctor.avatar?.trim().isNotEmpty == true
                        ? null
                        : Icon(
                            Icons.person_outline_rounded,
                            size: 18,
                            color: context.colors.primaryDark,
                          ),
                  ),
                  if (doctor.reviewCount > 0) ...[
                    const Spacer(),
                    Icon(Icons.star_rounded, size: 14, color: AppPalette.star),
                    const SizedBox(width: 2),
                    Text(
                      doctor.averageRating.toStringAsFixed(1),
                      style: text.labelSmall?.copyWith(
                        color: context.colors.textSoft,
                      ),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 8),
              Text(
                doctor.displayName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: text.labelLarge?.copyWith(color: context.colors.ink),
              ),
              Text(
                doctor.departmentName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: text.bodySmall?.copyWith(color: context.colors.muted),
              ),
              const Spacer(),
              Text(
                slot == null
                    ? 'Chọn ngày khám'
                    : 'Hôm nay ${slot.startTime.length >= 5 ? slot.startTime.substring(0, 5) : slot.startTime}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: text.labelMedium?.copyWith(
                  color: slot == null
                      ? context.colors.muted
                      : context.colors.primaryDark,
                ),
              ),
            ],
          ),
        );
      },
    ),
  );
}

/// Hàng viên chuyên khoa cuộn ngang.
class HomeDepartmentChips extends StatelessWidget {
  const HomeDepartmentChips({super.key, required this.items});

  final List<CatalogDepartment> items;

  @override
  Widget build(BuildContext context) => SizedBox(
    height: 36,
    child: ListView.separated(
      scrollDirection: Axis.horizontal,
      itemCount: items.length,
      separatorBuilder: (_, _) => const SizedBox(width: 6),
      itemBuilder: (context, index) {
        final item = items[index];
        return PressScale(
          child: ActionChip(
            onPressed: () =>
                context.push('/departments/${Uri.encodeComponent(item.id)}'),
            avatar: Icon(
              Icons.medical_services_outlined,
              size: 16,
              color: context.colors.primary,
            ),
            label: Text(item.name),
            backgroundColor: context.colors.primarySoft,
            side: BorderSide.none,
            shape: const StadiumBorder(),
            visualDensity: VisualDensity.compact,
            labelStyle: Theme.of(context).textTheme.labelMedium?.copyWith(
              color: context.colors.primaryDark,
            ),
          ),
        );
      },
    ),
  );
}

/// Dải gói khám: tên, nhãn nổi bật và giá.
class HomePackageStrip extends StatelessWidget {
  const HomePackageStrip({super.key, required this.items});

  final List<CatalogMedicalPackage> items;

  @override
  Widget build(BuildContext context) => SizedBox(
    height: 98,
    child: ListView.separated(
      scrollDirection: Axis.horizontal,
      itemCount: items.length,
      separatorBuilder: (_, _) => const SizedBox(width: 8),
      itemBuilder: (context, index) {
        final item = items[index];
        final text = Theme.of(context).textTheme;
        return _StripCard(
          width: 176,
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
              Text(
                item.name,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: text.labelLarge?.copyWith(color: context.colors.ink),
              ),
              const Spacer(),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      formatVnd(item.finalPrice),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: text.titleSmall?.copyWith(
                        color: context.colors.primaryDark,
                      ),
                    ),
                  ),
                  if (item.isPopular)
                    Text(
                      'Nổi bật',
                      style: text.labelSmall?.copyWith(
                        color: context.colors.warning,
                      ),
                    ),
                ],
              ),
            ],
          ),
        );
      },
    ),
  );
}

/// Bài viết mới: ảnh nhỏ, tiêu đề, dấu bác sĩ duyệt và ngày. Chạm mở bài trên website của cơ sở.
class HomeArticleList extends StatelessWidget {
  const HomeArticleList({super.key, required this.items});

  final List<ArticleSummary> items;

  @override
  Widget build(BuildContext context) => Column(
    children: [
      for (final item in items)
        Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: _ArticleRow(item: item),
        ),
    ],
  );
}

class _ArticleRow extends StatelessWidget {
  const _ArticleRow({required this.item});

  final ArticleSummary item;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final image = resizedNetworkImage(
      context,
      item.coverImage,
      logicalWidth: 56,
      logicalHeight: 56,
    );
    final meta = [
      if (item.reviewerName != null) 'Bác sĩ duyệt',
      if (item.publishedAt != null) _shortDate(item.publishedAt!),
    ].join(' · ');
    return PressScale(
      child: Material(
        color: context.colors.surface,
        clipBehavior: Clip.antiAlias,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
          side: BorderSide(color: context.colors.border, width: 0.5),
        ),
        child: InkWell(
          onTap: () => unawaited(
            launchUrl(
              Uri.parse('${AppBrand.webUrl}/kien-thuc/${item.slug}'),
              mode: LaunchMode.externalApplication,
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.all(8),
            child: Row(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: Container(
                    width: 56,
                    height: 56,
                    color: context.colors.primarySoft,
                    child: image == null
                        ? Icon(
                            Icons.menu_book_outlined,
                            color: context.colors.primary,
                          )
                        : Image(image: image, fit: BoxFit.cover),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: text.labelLarge?.copyWith(
                          color: context.colors.ink,
                        ),
                      ),
                      if (meta.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(
                          meta,
                          style: text.bodySmall?.copyWith(
                            color: context.colors.muted,
                          ),
                        ),
                      ],
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
