import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/features/catalog/domain/catalog_entities.dart';
import 'package:hospital_booking_mobile/app/navigation/booking_navigation.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/core/widgets/resized_network_image.dart';

import 'package:hospital_booking_mobile/core/design/app_design_tokens.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';

class HomeDoctorList extends StatelessWidget {
  const HomeDoctorList({super.key, required this.items});

  final List<CatalogDoctor> items;

  @override
  Widget build(BuildContext context) => SizedBox(
    height: 202,
    child: ListView.separated(
      scrollDirection: Axis.horizontal,
      itemCount: items.length,
      separatorBuilder: (_, _) => const SizedBox(width: 10),
      itemBuilder: (context, index) => SizedBox(
        width: 252,
        child: Align(
          alignment: Alignment.topCenter,
          child: _DoctorCard(doctor: items[index]),
        ),
      ),
    ),
  );
}

class _DoctorCard extends StatelessWidget {
  const _DoctorCard({required this.doctor});

  final CatalogDoctor doctor;

  @override
  Widget build(BuildContext context) {
    final slots = doctor.todayAvailableSlots.take(2).toList(growable: false);
    final hiddenSlotCount = doctor.todayAvailableSlots.length - slots.length;
    final experienceText = doctor.experience == null
        ? doctor.specialization ?? 'Tư vấn và thăm khám chuyên khoa'
        : '${doctor.experience} năm kinh nghiệm${doctor.specialization == null ? '' : ' • ${doctor.specialization}'}';

    void openBooking() => openBookingFromCurrentRoute(
      context,
      Uri(
        path: '/booking',
        queryParameters: {'doctorId': doctor.id},
      ).toString(),
    );

    final profileLocation = '/doctors/${Uri.encodeComponent(doctor.id)}';

    return Card(
      color: context.colors.surface,
      shadowColor: context.colors.shadowTint,
      elevation: 1,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: BorderSide(color: context.colors.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.push(profileLocation),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SizedBox(
                height: 62,
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    CircleAvatar(
                      radius: 22,
                      backgroundColor: context.colors.primarySoft,
                      backgroundImage: resizedNetworkImage(
                        context,
                        doctor.avatar,
                        logicalWidth: 44,
                        logicalHeight: 44,
                      ),
                      child: doctor.avatar?.trim().isNotEmpty != true
                          ? Icon(
                              Icons.person_outline_rounded,
                              color: context.colors.primaryDark,
                              size: 20,
                            )
                          : null,
                    ),
                    const SizedBox(width: 9),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            doctor.displayName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.titleSmall
                                ?.copyWith(
                                  color: context.colors.ink,
                                  fontWeight: FontWeight.w900,
                                ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            doctor.departmentName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.labelMedium
                                ?.copyWith(
                                  color: context.colors.success,
                                  fontWeight: FontWeight.w800,
                                ),
                          ),
                          const SizedBox(height: 3),
                          Row(
                            children: [
                              if (doctor.reviewCount > 0)
                                _DoctorRatingBadge(
                                  rating: doctor.averageRating,
                                  reviewCount: doctor.reviewCount,
                                ),
                              if (doctor.reviewCount > 0)
                                const SizedBox(width: 5),
                              Expanded(
                                child: Text(
                                  experienceText,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: Theme.of(context).textTheme.labelSmall
                                      ?.copyWith(color: context.colors.muted),
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
              const SizedBox(height: 5),
              SizedBox(
                height: 64,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  decoration: BoxDecoration(
                    color: context.colors.primarySoft,
                    borderRadius: BorderRadius.circular(11),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              slots.isEmpty
                                  ? 'Lịch khám'
                                  : 'Giờ trống gần nhất',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(context).textTheme.labelSmall
                                  ?.copyWith(
                                    color: context.colors.muted,
                                    fontWeight: FontWeight.w700,
                                  ),
                            ),
                          ),
                          Text(
                            formatVnd(doctor.consultationFee),
                            style: Theme.of(context).textTheme.labelMedium
                                ?.copyWith(
                                  color: context.colors.ink,
                                  fontWeight: FontWeight.w900,
                                ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 3),
                      Row(
                        children: [
                          Expanded(
                            child: slots.isEmpty
                                ? Text(
                                    'Chọn ngày phù hợp',
                                    style: Theme.of(context)
                                        .textTheme
                                        .labelSmall
                                        ?.copyWith(
                                          color: context.colors.primaryDark,
                                          fontWeight: FontWeight.w800,
                                        ),
                                  )
                                : Wrap(
                                    spacing: 4,
                                    children: [
                                      for (final slot in slots)
                                        _DoctorSlotChip(label: slot.startTime),
                                    ],
                                  ),
                          ),
                          TextButton(
                            onPressed: () => context.push(profileLocation),
                            style: TextButton.styleFrom(
                              minimumSize: Size.zero,
                              padding: const EdgeInsets.only(left: 6),
                              visualDensity: VisualDensity.compact,
                              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                              foregroundColor: context.colors.primaryDark,
                            ),
                            child: Text(
                              hiddenSlotCount > 0
                                  ? 'Xem thêm +$hiddenSlotCount'
                                  : 'Xem thêm giờ',
                              style: const TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 6),
              FilledButton.icon(
                style: FilledButton.styleFrom(
                  minimumSize: const Size(0, 36),
                  backgroundColor: context.colors.primary,
                  foregroundColor: context.colors.onPrimary,
                  visualDensity: VisualDensity.compact,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                onPressed: openBooking,
                icon: const Icon(Icons.calendar_month_outlined, size: 16),
                label: const Text('Đặt khám ngay'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DoctorRatingBadge extends StatelessWidget {
  const _DoctorRatingBadge({required this.rating, required this.reviewCount});

  final double rating;
  final int reviewCount;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
    decoration: BoxDecoration(
      color: context.colors.warningContainer,
      borderRadius: BorderRadius.circular(999),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.star_rounded, size: 13, color: AppPalette.star),
        const SizedBox(width: 2),
        Text(
          '${rating.toStringAsFixed(1)} ($reviewCount)',
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
            color: context.colors.warning,
            fontWeight: FontWeight.w800,
            fontSize: 10,
          ),
        ),
      ],
    ),
  );
}

class _DoctorSlotChip extends StatelessWidget {
  const _DoctorSlotChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
    decoration: BoxDecoration(
      color: context.colors.surface,
      borderRadius: BorderRadius.circular(7),
    ),
    child: Text(
      label,
      style: Theme.of(context).textTheme.labelSmall?.copyWith(
        color: context.colors.primaryDark,
        fontWeight: FontWeight.w800,
      ),
    ),
  );
}
