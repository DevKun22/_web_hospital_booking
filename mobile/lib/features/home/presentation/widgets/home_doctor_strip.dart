import 'package:hospital_booking_mobile/core/widgets/app_zone.dart';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/app/navigation/booking_navigation.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/design/app_design_tokens.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:hospital_booking_mobile/core/widgets/resized_network_image.dart';
import 'package:hospital_booking_mobile/features/catalog/domain/catalog_entities.dart';

import 'package:hospital_booking_mobile/features/home/presentation/widgets/home_strip_parts.dart';

/// Dải bác sĩ nổi bật: ảnh (hoặc chữ cái đầu có màu), sao đánh giá, tên, khoa và số năm kinh nghiệm, giờ trống hôm nay, giá khám.
class HomeDoctorStrip extends StatelessWidget {
  const HomeDoctorStrip({super.key, required this.items});

  final List<CatalogDoctor> items;

  @override
  Widget build(BuildContext context) => SizedBox(
    height: homeStripHeight(context, 246),
    child: homeClampedStrip(
      context,
      ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: items.length,
        separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.sm),
        itemBuilder: (context, index) => _DoctorCard(
          doctor: items[index],
          tint: homeTint(context, index + 4),
        ),
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
    return HomeStripCard(
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
                        homeInitials(doctor.fullName),
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
                    label: formatTimeShort(slot.startTime),
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
