import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/app/navigation/booking_navigation.dart';
import 'package:hospital_booking_mobile/app/theme/app_theme.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/packages/domain/medical_package.dart';

class PackageCatalogCard extends StatelessWidget {
  const PackageCatalogCard({required this.item, super.key});

  final MedicalPackage item;

  @override
  Widget build(BuildContext context) => Card(
    margin: EdgeInsets.zero,
    clipBehavior: Clip.antiAlias,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(18),
      side: const BorderSide(color: AppTheme.softBorder),
    ),
    child: InkWell(
      onTap: item.slug == null
          ? null
          : () => context.push('/packages/${Uri.encodeComponent(item.slug!)}'),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [AppTheme.primary, Color(0xFF18A5A2)],
                    ),
                    borderRadius: BorderRadius.circular(15),
                  ),
                  child: const Icon(
                    Icons.health_and_safety_outlined,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Wrap(
                        spacing: 6,
                        runSpacing: 5,
                        children: [
                          if (item.isPopular)
                            const AppStatusBadge(
                              label: 'Được quan tâm',
                              tone: AppStatusTone.warning,
                            ),
                          if (item.isBhytSupport)
                            const AppStatusBadge(
                              label: 'Hỗ trợ BHYT',
                              tone: AppStatusTone.success,
                            ),
                        ],
                      ),
                      if (item.isPopular || item.isBhytSupport)
                        const SizedBox(height: 7),
                      Text(
                        item.name,
                        style: Theme.of(context).textTheme.titleMedium
                            ?.copyWith(fontWeight: FontWeight.w800),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            if (item.summary != null) ...[
              const SizedBox(height: 10),
              Text(
                item.summary!,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                  height: 1.35,
                ),
              ),
            ],
            if (item.departmentName != null) ...[
              const SizedBox(height: 10),
              Row(
                children: [
                  const Icon(
                    Icons.local_hospital_outlined,
                    size: 17,
                    color: AppTheme.primary,
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      item.departmentName!,
                      style: Theme.of(context).textTheme.labelMedium,
                    ),
                  ),
                ],
              ),
            ],
            const Divider(height: 26),
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Chi phí dự kiến',
                        style: Theme.of(context).textTheme.labelSmall,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        _formatVnd(item.finalPrice),
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          color: AppTheme.primaryDark,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ),
                ),
                FilledButton(
                  style: FilledButton.styleFrom(
                    minimumSize: const Size(116, 46),
                  ),
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
          ],
        ),
      ),
    ),
  );
}

String _formatVnd(double value) {
  final digits = value.round().toString();
  final buffer = StringBuffer();
  for (var index = 0; index < digits.length; index++) {
    if (index > 0 && (digits.length - index) % 3 == 0) buffer.write('.');
    buffer.write(digits[index]);
  }
  return '$bufferđ';
}
