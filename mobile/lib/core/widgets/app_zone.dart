import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/core/design/app_design_tokens.dart';

/// Ô biểu tượng có nền theo vùng màu. Mọi ô biểu tượng của app dùng widget này để đổi kiểu một nơi.
class AppIconTile extends StatelessWidget {
  const AppIconTile({
    super.key,
    required this.icon,
    required this.tint,
    this.size = AppTileSize.md,
    this.circle = false,
  });

  final IconData icon;
  final ({Color background, Color foreground}) tint;
  final AppTileSize size;
  final bool circle;

  @override
  Widget build(BuildContext context) => Container(
    width: size.box,
    height: size.box,
    decoration: BoxDecoration(
      color: tint.background,
      shape: circle ? BoxShape.circle : BoxShape.rectangle,
      borderRadius: circle ? null : BorderRadius.circular(AppRadius.md),
    ),
    child: Icon(icon, size: size.icon, color: tint.foreground),
  );
}

/// Viên nhỏ có nền theo vùng màu: nhãn trạng thái (nổi bật, có BHYT, quan hệ).
class AppPill extends StatelessWidget {
  const AppPill({super.key, required this.label, required this.tint});

  final String label;
  final ({Color background, Color foreground}) tint;

  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: BoxDecoration(
      color: tint.background,
      borderRadius: BorderRadius.circular(AppRadius.pill),
    ),
    child: Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.xs,
        vertical: AppSpacing.hair,
      ),
      child: Text(
        label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: Theme.of(context).textTheme.labelMedium?.copyWith(
          color: tint.foreground,
          fontWeight: AppFontWeight.medium,
        ),
      ),
    ),
  );
}
