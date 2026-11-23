import 'package:hospital_booking_mobile/features/catalog/presentation/department_visuals.dart';
import 'package:hospital_booking_mobile/core/widgets/app_zone.dart';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/design/app_design_tokens.dart';
import 'package:hospital_booking_mobile/features/catalog/domain/catalog_entities.dart';

import 'package:hospital_booking_mobile/features/home/presentation/widgets/home_strip_parts.dart';

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
    return HomeStripCard(
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
