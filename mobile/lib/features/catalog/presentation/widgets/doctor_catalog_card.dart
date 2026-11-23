import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/app/navigation/booking_navigation.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/core/widgets/app_zone.dart';
import 'package:hospital_booking_mobile/core/widgets/resized_network_image.dart';
import 'package:hospital_booking_mobile/features/catalog/domain/catalog_entities.dart';

/// Thẻ bác sĩ trong danh sách: chạm cả thẻ để xem hồ sơ, một nút chính để đặt khám.
class DoctorCatalogCard extends StatelessWidget {
  const DoctorCatalogCard({required this.doctor, super.key});

  final CatalogDoctor doctor;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final text = Theme.of(context).textTheme;
    final slots = doctor.todayAvailableSlots
        .take(2)
        .map((slot) => slot.startTime)
        .toList(growable: false);
    return AppSurfaceCard(
      onTap: () => context.push('/doctors/${Uri.encodeComponent(doctor.id)}'),
      semanticLabel: 'Hồ sơ ${doctor.displayName}, ${doctor.departmentName}',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 28,
                backgroundColor: colors.primarySoft,
                backgroundImage: resizedNetworkImage(
                  context,
                  doctor.avatar,
                  logicalWidth: 56,
                  logicalHeight: 56,
                ),
                child: doctor.avatar?.trim().isNotEmpty != true
                    ? Icon(Icons.person_outlined, color: colors.primary)
                    : null,
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      doctor.displayName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: text.titleSmall,
                    ),
                    const SizedBox(height: AppSpacing.xxs),
                    Wrap(
                      spacing: AppSpacing.xs,
                      runSpacing: AppSpacing.hair,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        AppPill(
                          label: doctor.departmentName,
                          tint: colors.zone(AppZone.primary),
                        ),
                        if (doctor.reviewCount > 0)
                          AppPill(
                            label:
                                '★ ${doctor.averageRating.toStringAsFixed(1).replaceAll('.', ',')}',
                            tint: colors.zone(AppZone.warning),
                          ),
                        if (doctor.experience != null)
                          Text(
                            '${doctor.experience} năm KN',
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
          const SizedBox(height: AppSpacing.sm),
          DecoratedBox(
            decoration: BoxDecoration(
              color: colors.primarySoft,
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.sm,
                vertical: AppSpacing.xs,
              ),
              child: Wrap(
                alignment: WrapAlignment.spaceBetween,
                crossAxisAlignment: WrapCrossAlignment.center,
                spacing: AppSpacing.xs,
                runSpacing: AppSpacing.hair,
                children: [
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.schedule_outlined,
                        size: AppIconSize.sm,
                        color: colors.primaryDark,
                      ),
                      const SizedBox(width: AppSpacing.xs),
                      Flexible(
                        child: Text(
                          slots.isEmpty
                              ? 'Xem lịch gần nhất'
                              : 'Hôm nay ${slots.join(' · ')}',
                          style: text.labelLarge?.copyWith(
                            color: colors.primaryDark,
                          ),
                        ),
                      ),
                    ],
                  ),
                  Text(
                    formatVnd(doctor.consultationFee),
                    style: text.titleSmall?.copyWith(color: colors.primaryDark),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          FilledButton(
            onPressed: () => openBookingFromCurrentRoute(
              context,
              Uri(
                path: '/booking',
                queryParameters: {'doctorId': doctor.id},
              ).toString(),
            ),
            child: const Text('Đặt khám'),
          ),
        ],
      ),
    );
  }
}
