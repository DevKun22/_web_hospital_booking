import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/app/navigation/booking_navigation.dart';
import 'package:hospital_booking_mobile/app/theme/app_theme.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/core/widgets/resized_network_image.dart';
import 'package:hospital_booking_mobile/features/home/domain/home_content.dart';

class DoctorCatalogCard extends StatelessWidget {
  const DoctorCatalogCard({required this.doctor, super.key});

  final HomeDoctor doctor;

  @override
  Widget build(BuildContext context) {
    final slots = doctor.todayAvailableSlots.take(2).toList(growable: false);
    return AppSurfaceCard(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                radius: 31,
                backgroundColor: Theme.of(context).colorScheme.primaryContainer,
                backgroundImage: resizedNetworkImage(
                  context,
                  doctor.avatar,
                  logicalWidth: 62,
                  logicalHeight: 62,
                ),
                child: doctor.avatar?.trim().isNotEmpty != true
                    ? const Icon(Icons.person_outline_rounded, size: 29)
                    : null,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            doctor.displayName,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.titleMedium
                                ?.copyWith(fontWeight: FontWeight.w800),
                          ),
                        ),
                        if (doctor.averageRating > 0)
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 7,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: AppPalette.warningContainer,
                              borderRadius: BorderRadius.circular(AppRadius.sm),
                            ),
                            child: Text(
                              '★ ${doctor.averageRating.toStringAsFixed(1)}',
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 3),
                    Text(
                      '${doctor.departmentName}${doctor.specialization == null ? '' : ' • ${doctor.specialization}'}',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppTheme.primaryDark,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    if (doctor.experience != null) ...[
                      const SizedBox(height: 3),
                      Text(
                        '${doctor.experience} năm kinh nghiệm',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 9),
            decoration: BoxDecoration(
              color: AppPalette.infoContainer,
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Giờ trống hôm nay',
                        style: Theme.of(context).textTheme.labelSmall,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        slots.isEmpty
                            ? 'Xem lịch gần nhất'
                            : slots.map((slot) => slot.startTime).join('   '),
                        style: Theme.of(context).textTheme.labelLarge?.copyWith(
                          color: AppTheme.primaryDark,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      'Phí khám',
                      style: Theme.of(context).textTheme.labelSmall,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      formatVnd(doctor.consultationFee),
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 11),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => context.push(
                    '/doctors/${Uri.encodeComponent(doctor.id)}',
                  ),
                  child: const Text('Xem hồ sơ'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: FilledButton(
                  onPressed: () => openBookingFromCurrentRoute(
                    context,
                    Uri(
                      path: '/booking',
                      queryParameters: {'doctorId': doctor.id},
                    ).toString(),
                  ),
                  child: const Text('Đặt khám'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
