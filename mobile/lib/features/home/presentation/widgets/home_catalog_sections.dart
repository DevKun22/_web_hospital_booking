import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/features/catalog/domain/catalog_entities.dart';
import 'package:hospital_booking_mobile/app/navigation/booking_navigation.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';

class HomeDepartmentList extends StatelessWidget {
  const HomeDepartmentList({super.key, required this.items});

  final List<CatalogDepartment> items;

  @override
  Widget build(BuildContext context) => GridView.builder(
    shrinkWrap: true,
    primary: false,
    padding: EdgeInsets.zero,
    physics: const NeverScrollableScrollPhysics(),
    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
      crossAxisCount: 3,
      mainAxisSpacing: 7,
      crossAxisSpacing: 7,
      mainAxisExtent: 80,
    ),
    itemCount: items.length,
    itemBuilder: (context, index) {
      final item = items[index];
      final palette = _departmentPalettes[index % _departmentPalettes.length];
      return Material(
        color: Theme.of(context).colorScheme.surface,
        clipBehavior: Clip.antiAlias,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
          side: const BorderSide(color: AppPalette.publicBorder),
        ),
        child: InkWell(
          onTap: () =>
              context.push('/departments/${Uri.encodeComponent(item.id)}'),
          child: Padding(
            padding: const EdgeInsets.all(7),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: palette.background,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    Icons.medical_services_outlined,
                    size: 18,
                    color: palette.foreground,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  item.name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                    height: 1.15,
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    },
  );
}

const _departmentPalettes = <({Color background, Color foreground})>[
  (background: Color(0xFFFFECEC), foreground: Color(0xFFD64545)),
  (background: Color(0xFFE7F0FF), foreground: AppPalette.clinicalBlue),
  (background: Color(0xFFE5F8F2), foreground: Color(0xFF16856A)),
  (background: Color(0xFFFFF3DD), foreground: Color(0xFFA4660D)),
  (background: Color(0xFFEAF6FA), foreground: Color(0xFF2B6F9E)),
  (background: Color(0xFFFCEBED), foreground: Color(0xFFB64075)),
];

class HomePackageList extends StatelessWidget {
  const HomePackageList({super.key, required this.items});

  final List<CatalogMedicalPackage> items;

  @override
  Widget build(BuildContext context) => SizedBox(
    height: 200,
    child: ListView.separated(
      scrollDirection: Axis.horizontal,
      itemCount: items.length,
      separatorBuilder: (_, _) => const SizedBox(width: 10),
      itemBuilder: (context, index) => SizedBox(
        width: 286,
        child: _PackageCard(
          item: items[index],
          isFeatured: items[index].isPopular,
        ),
      ),
    ),
  );
}

class _PackageCard extends StatelessWidget {
  const _PackageCard({required this.item, required this.isFeatured});

  final CatalogMedicalPackage item;
  final bool isFeatured;

  @override
  Widget build(BuildContext context) => Card(
    color: isFeatured ? AppPalette.clinicalBlueDark : Colors.white,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(20),
      side: BorderSide(
        color: isFeatured
            ? AppPalette.clinicalBlueDark
            : AppPalette.publicBorder,
      ),
    ),
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      onTap: item.slug == null
          ? () => openBookingFromCurrentRoute(
              context,
              '/booking?packageId=${item.id}',
            )
          : () => context.push('/packages/${Uri.encodeComponent(item.slug!)}'),
      child: Stack(
        children: [
          if (isFeatured)
            const Positioned(
              right: -26,
              top: -22,
              child: Icon(
                Icons.health_and_safety_outlined,
                size: 126,
                color: Color(0x1FFFFFFF),
              ),
            ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        color: isFeatured
                            ? Colors.white.withValues(alpha: 0.16)
                            : Theme.of(context).colorScheme.primaryContainer,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(
                        Icons.health_and_safety_outlined,
                        size: 21,
                        color: isFeatured
                            ? Colors.white
                            : AppPalette.clinicalBlue,
                      ),
                    ),
                    const SizedBox(width: 9),
                    Expanded(
                      child: Wrap(
                        spacing: 6,
                        runSpacing: 5,
                        children: [
                          if (item.isPopular)
                            _PackageTag(
                              label: 'PHỔ BIẾN',
                              foreground: isFeatured
                                  ? Colors.white
                                  : const Color(0xFF9B5B00),
                              background: isFeatured
                                  ? Colors.white.withValues(alpha: 0.16)
                                  : const Color(0xFFFFE7C2),
                            ),
                          if (item.isBhytSupport)
                            _PackageTag(
                              label: 'HỖ TRỢ BHYT',
                              foreground: isFeatured
                                  ? Colors.white
                                  : const Color(0xFF236A9B),
                              background: isFeatured
                                  ? Colors.white.withValues(alpha: 0.16)
                                  : const Color(0xFFDCEEFF),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  item.name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: isFeatured ? Colors.white : AppPalette.publicInk,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                if (item.summary != null) ...[
                  const SizedBox(height: 5),
                  Text(
                    item.summary!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: isFeatured
                          ? const Color(0xDFFFFFFF)
                          : Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
                const Spacer(),
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Chi phí trọn gói',
                            style: Theme.of(context).textTheme.labelSmall
                                ?.copyWith(
                                  color: isFeatured
                                      ? const Color(0xBFFFFFFF)
                                      : Theme.of(
                                          context,
                                        ).colorScheme.onSurfaceVariant,
                                ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            formatVnd(item.finalPrice),
                            style: Theme.of(context).textTheme.titleMedium
                                ?.copyWith(
                                  color: isFeatured
                                      ? Colors.white
                                      : AppPalette.clinicalBlueDark,
                                  fontWeight: FontWeight.w900,
                                ),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 11,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: isFeatured
                            ? Colors.white
                            : Theme.of(context).colorScheme.primaryContainer,
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            'Chi tiết',
                            style: Theme.of(context).textTheme.labelMedium
                                ?.copyWith(
                                  color: AppPalette.clinicalBlueDark,
                                  fontWeight: FontWeight.w800,
                                ),
                          ),
                          const SizedBox(width: 2),
                          const Icon(
                            Icons.arrow_forward_rounded,
                            size: 17,
                            color: AppPalette.clinicalBlueDark,
                          ),
                        ],
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
  );
}

class _PackageTag extends StatelessWidget {
  const _PackageTag({
    required this.label,
    required this.foreground,
    required this.background,
  });

  final String label;
  final Color foreground;
  final Color background;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
    decoration: BoxDecoration(
      color: background,
      borderRadius: BorderRadius.circular(999),
    ),
    child: Text(
      label,
      style: Theme.of(context).textTheme.labelSmall?.copyWith(
        color: foreground,
        fontWeight: FontWeight.w800,
        fontSize: 10,
      ),
    ),
  );
}
