import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/core/widgets/app_zone.dart';
import 'package:hospital_booking_mobile/core/widgets/resized_network_image.dart';
import 'package:hospital_booking_mobile/features/catalog/presentation/department_visuals.dart';

/// Ô chuyên khoa trong lưới: biểu tượng (hoặc ảnh) theo khoa, tên tối đa hai dòng và số bác sĩ đang nhận lịch.
class DepartmentTile extends StatelessWidget {
  const DepartmentTile({
    super.key,
    required this.id,
    required this.name,
    this.slug,
    this.image,
    required this.doctorCount,
    required this.index,
  });

  final String id;
  final String name;
  final String? slug;
  final String? image;
  final int doctorCount;
  final int index;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final text = Theme.of(context).textTheme;
    final visual = departmentVisual(
      context,
      name: name,
      slug: slug,
      index: index,
    );
    final picture = resizedNetworkImage(
      context,
      image,
      logicalWidth: AppTileSize.lg.box,
      logicalHeight: AppTileSize.lg.box,
    );
    return AppSurfaceCard(
      onTap: () => context.push('/departments/${Uri.encodeComponent(id)}'),
      semanticLabel: doctorCount == 0
          ? name
          : '$name, $doctorCount bác sĩ đang nhận lịch',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (picture == null)
            AppIconTile(
              icon: visual.icon,
              tint: visual.tint,
              size: AppTileSize.lg,
            )
          else
            ClipRRect(
              borderRadius: BorderRadius.circular(AppRadius.md),
              child: SizedBox(
                width: AppTileSize.lg.box,
                height: AppTileSize.lg.box,
                child: Image(
                  image: picture,
                  fit: BoxFit.cover,
                  errorBuilder: (_, _, _) => AppIconTile(
                    icon: visual.icon,
                    tint: visual.tint,
                    size: AppTileSize.lg,
                  ),
                ),
              ),
            ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            name,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: text.titleSmall,
          ),
          const SizedBox(height: AppSpacing.hair),
          Text(
            doctorCount == 0
                ? 'Xem chuyên khoa'
                : '$doctorCount bác sĩ nhận lịch',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: text.bodySmall?.copyWith(color: colors.muted),
          ),
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
