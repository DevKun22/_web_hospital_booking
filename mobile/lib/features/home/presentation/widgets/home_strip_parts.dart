import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/design/app_design_tokens.dart';
import 'package:hospital_booking_mobile/core/widgets/app_motion.dart';

/// Phần dùng chung của các dải ngang ở Trang chủ: thẻ, chiều cao và giới hạn cỡ chữ.

/// Thẻ dùng chung của các dải ngang trên Trang chủ: viền mảnh, bo 14, nhấn vào thì co nhẹ.
class HomeStripCard extends StatelessWidget {
  const HomeStripCard({
    super.key,
    required this.width,
    required this.onTap,
    required this.child,
  });

  final double width;
  final VoidCallback onTap;
  final Widget child;

  @override
  Widget build(BuildContext context) => SizedBox(
    width: width,
    child: PressScale(
      child: Material(
        color: context.colors.surface,
        clipBehavior: Clip.antiAlias,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
          side: BorderSide(color: context.colors.border, width: 0.5),
        ),
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.sm),
            child: child,
          ),
        ),
      ),
    ),
  );
}

String homeInitials(String name) {
  final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty);
  final list = parts.toList();
  if (list.isEmpty) return '?';
  if (list.length == 1) return list.first.characters.first.toUpperCase();
  return '${list[list.length - 2].characters.first}${list.last.characters.first}'
      .toUpperCase();
}

/// Thẻ trong dải ngang là thẻ chữ dày đặc nên chỉ phóng chữ đến mức này; lớn hơn thì chữ tràn khỏi thẻ.
const homeStripMaxTextScale = 1.3;

/// Chiều cao dải ngang theo cỡ chữ của máy (đã giới hạn): chữ lớn thì thẻ cao hơn, không bị cắt hay bó lại.
double homeStripHeight(BuildContext context, double base) {
  final scaler = MediaQuery.textScalerOf(
    context,
  ).clamp(maxScaleFactor: homeStripMaxTextScale);
  final scaled = scaler.scale(base);
  return scaled < base ? base : scaled;
}

/// Giới hạn cỡ chữ bên trong một dải ngang.
Widget homeClampedStrip(BuildContext context, Widget child) =>
    MediaQuery.withClampedTextScaling(
      maxScaleFactor: homeStripMaxTextScale,
      child: child,
    );
