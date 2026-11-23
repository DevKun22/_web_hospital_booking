import 'package:hospital_booking_mobile/features/catalog/presentation/department_visuals.dart';
import 'package:hospital_booking_mobile/core/widgets/app_zone.dart';
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

/// Vùng màu xoay vòng theo thứ tự, để các thẻ cạnh nhau có màu khác nhau.
({Color background, Color foreground}) _tint(BuildContext context, int index) =>
    context.colors.zoneAt(index);

/// Thẻ dùng chung của các dải ngang trên Trang chủ: viền mảnh, bo 14, nhấn vào thì co nhẹ.
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
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.sm),
            child: child,
          ),
        ),
      ),
    ),
  );
}

String _initials(String name) {
  final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty);
  final list = parts.toList();
  if (list.isEmpty) return '?';
  if (list.length == 1) return list.first.characters.first.toUpperCase();
  return '${list[list.length - 2].characters.first}${list.last.characters.first}'
      .toUpperCase();
}

/// Thẻ trong dải ngang là thẻ chữ dày đặc nên chỉ phóng chữ đến mức này; lớn hơn thì chữ tràn khỏi thẻ.
const _stripMaxTextScale = 1.3;

/// Chiều cao dải ngang theo cỡ chữ của máy (đã giới hạn): chữ lớn thì thẻ cao hơn, không bị cắt hay bó lại.
double _stripHeight(BuildContext context, double base) {
  final scaler = MediaQuery.textScalerOf(
    context,
  ).clamp(maxScaleFactor: _stripMaxTextScale);
  final scaled = scaler.scale(base);
  return scaled < base ? base : scaled;
}

/// Giới hạn cỡ chữ bên trong một dải ngang.
Widget _clampedStrip(BuildContext context, Widget child) =>
    MediaQuery.withClampedTextScaling(
      maxScaleFactor: _stripMaxTextScale,
      child: child,
    );

String _hhmm(String value) => value.length >= 5 ? value.substring(0, 5) : value;

/// Dải bác sĩ nổi bật: ảnh (hoặc chữ cái đầu có màu), sao đánh giá, tên, khoa và số năm kinh nghiệm, giờ trống hôm nay, giá khám.
class HomeDoctorStrip extends StatelessWidget {
  const HomeDoctorStrip({super.key, required this.items});

  final List<CatalogDoctor> items;

  @override
  Widget build(BuildContext context) => SizedBox(
    height: _stripHeight(context, 246),
    child: _clampedStrip(
      context,
      ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: items.length,
        separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.sm),
        itemBuilder: (context, index) =>
            _DoctorCard(doctor: items[index], tint: _tint(context, index + 4)),
      ),
    ),
  );
}

class _DoctorCard extends StatelessWidget {
  const _DoctorCard({required this.doctor, required this.tint});

  final CatalogDoctor doctor;
  final ({Color background, Color foreground}) tint;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final colors = context.colors;
    final slots = doctor.todayAvailableSlots;
    final shown = slots.take(2).toList();
    final more = slots.length - shown.length;
    final details = [
      doctor.departmentName,
      if (doctor.experience != null) '${doctor.experience} năm',
    ].join(' · ');
    final avatar = resizedNetworkImage(
      context,
      doctor.avatar,
      logicalWidth: 52,
      logicalHeight: 52,
    );
    return _StripCard(
      width: 204,
      onTap: () => context.push('/doctors/${Uri.encodeComponent(doctor.id)}'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                radius: 26,
                backgroundColor: tint.background,
                backgroundImage: avatar,
                child: avatar == null
                    ? Text(
                        _initials(doctor.fullName),
                        style: text.titleSmall?.copyWith(
                          color: tint.foreground,
                        ),
                      )
                    : null,
              ),
              const Spacer(),
              if (doctor.reviewCount > 0)
                AppPill(
                  label:
                      '★ ${doctor.averageRating.toStringAsFixed(1).replaceAll('.', ',')}',
                  tint: colors.zone(AppZone.warning),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            doctor.displayName,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: text.titleSmall?.copyWith(color: colors.ink),
          ),
          Text(
            details,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: text.bodySmall?.copyWith(color: colors.muted),
          ),
          const SizedBox(height: AppSpacing.xs),
          if (shown.isEmpty)
            Text(
              'Chọn ngày khám',
              style: text.labelMedium?.copyWith(color: colors.muted),
            )
          else
            Wrap(
              spacing: 5,
              children: [
                for (final slot in shown)
                  AppPill(
                    label: _hhmm(slot.startTime),
                    tint: (
                      background: colors.primarySoft,
                      foreground: colors.primaryDark,
                    ),
                  ),
                if (more > 0)
                  AppPill(
                    label: '+$more',
                    tint: (
                      background: colors.surfaceMuted,
                      foreground: colors.muted,
                    ),
                  ),
              ],
            ),
          const Spacer(),
          Row(
            children: [
              Expanded(
                child: Text(
                  doctor.consultationFee > 0
                      ? formatVnd(doctor.consultationFee)
                      : '',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: text.titleSmall?.copyWith(color: colors.primaryDark),
                ),
              ),
              FilledButton(
                onPressed: () => openBookingFromCurrentRoute(
                  context,
                  Uri(
                    path: '/booking',
                    queryParameters: {'doctorId': doctor.id},
                  ).toString(),
                ),
                style: FilledButton.styleFrom(
                  minimumSize: const Size(0, 34),
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.md,
                  ),
                ),
                child: const Text('Đặt'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Chuyên khoa: lưới 2 cột, mỗi khoa một ô biểu tượng màu riêng.
class HomeDepartmentGrid extends StatelessWidget {
  const HomeDepartmentGrid({super.key, required this.items});

  final List<CatalogDepartment> items;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      const gap = 10.0;
      final width = (constraints.maxWidth - gap) / 2;
      return Wrap(
        spacing: gap,
        runSpacing: gap,
        children: [
          for (final (index, item) in items.indexed)
            _DepartmentTile(width: width, item: item, index: index),
        ],
      );
    },
  );
}

class _DepartmentTile extends StatelessWidget {
  const _DepartmentTile({
    required this.width,
    required this.item,
    required this.index,
  });

  final double width;
  final CatalogDepartment item;
  final int index;

  @override
  Widget build(BuildContext context) {
    final visual = departmentVisual(
      context,
      name: item.name,
      slug: item.slug,
      index: index,
    );
    return _StripCard(
      width: width,
      onTap: () => context.push('/departments/${Uri.encodeComponent(item.id)}'),
      child: Row(
        children: [
          AppIconTile(
            icon: visual.icon,
            tint: visual.tint,
            size: AppTileSize.md,
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              item.name,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(
                context,
              ).textTheme.labelLarge?.copyWith(color: context.colors.ink),
            ),
          ),
        ],
      ),
    );
  }
}

/// Dải gói khám: ô biểu tượng màu, nhãn nổi bật, tên, mô tả ngắn, nhãn BHYT và giá lớn.
class HomePackageStrip extends StatelessWidget {
  const HomePackageStrip({super.key, required this.items});

  final List<CatalogMedicalPackage> items;

  @override
  Widget build(BuildContext context) => SizedBox(
    height: _stripHeight(context, 226),
    child: _clampedStrip(
      context,
      ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: items.length,
        separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.sm),
        itemBuilder: (context, index) {
          final item = items[index];
          final text = Theme.of(context).textTheme;
          final colors = context.colors;
          final tint = _tint(context, index + 3);
          return _StripCard(
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
                    AppIconTile(
                      icon: Icons.inventory_2_outlined,
                      tint: tint,
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
          child: _ArticleRow(item: item, tint: _tint(context, index + 5)),
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
