import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/widgets/app_entity_mark.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/catalog/domain/catalog_entities.dart';

/// Ô chuyên khoa trong lưới, căn giữa: ảnh hoặc chữ viết tắt, tên tối đa hai dòng, số bác sĩ và gói do máy chủ đếm sẵn.
class DepartmentTile extends StatelessWidget {
  const DepartmentTile({super.key, required this.department});

  final CatalogDepartment department;

  String get _meta {
    final parts = [
      if (department.doctorCount > 0) '${department.doctorCount} bác sĩ',
      if (department.packageCount > 0) '${department.packageCount} gói',
    ];
    return parts.isEmpty ? 'Xem chuyên khoa' : parts.join(' · ');
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final text = Theme.of(context).textTheme;
    final bookable = department.availableSlotCount > 0;
    return AppSurfaceCard(
      onTap: () =>
          context.push('/departments/${Uri.encodeComponent(department.id)}'),
      semanticLabel: [
        department.name,
        _meta,
        if (bookable) 'còn lịch trống',
      ].join(', '),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          AppEntityMark(name: department.name, image: department.image),
          const SizedBox(height: AppSpacing.sm),
          Text(
            department.name,
            maxLines: 2,
            textAlign: TextAlign.center,
            overflow: TextOverflow.ellipsis,
            style: text.titleSmall,
          ),
          const SizedBox(height: AppSpacing.hair),
          Text(
            _meta,
            maxLines: 1,
            textAlign: TextAlign.center,
            overflow: TextOverflow.ellipsis,
            style: text.bodySmall?.copyWith(color: colors.muted),
          ),
          if (bookable) ...[
            const SizedBox(height: AppSpacing.xxs),
            Text(
              'Còn lịch trống',
              maxLines: 1,
              textAlign: TextAlign.center,
              overflow: TextOverflow.ellipsis,
              style: text.labelSmall?.copyWith(color: colors.success),
            ),
          ],
        ],
      ),
    );
  }
}

/// Lưới hai cột cho chuyên khoa; mỗi hàng cao bằng ô cao nhất để các ô cạnh nhau đều nhau dù tên dài ngắn khác nhau.
class DepartmentGrid extends StatelessWidget {
  const DepartmentGrid({super.key, required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final rows = <Widget>[];
    for (var i = 0; i < children.length; i += 2) {
      rows.add(
        Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.sm),
          child: IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(child: children[i]),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: i + 1 < children.length
                      ? children[i + 1]
                      : const SizedBox.shrink(),
                ),
              ],
            ),
          ),
        ),
      );
    }
    return Column(children: rows);
  }
}
