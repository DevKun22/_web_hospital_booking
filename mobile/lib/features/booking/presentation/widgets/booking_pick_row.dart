import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/design/app_design_tokens.dart';
import 'package:hospital_booking_mobile/core/widgets/app_motion.dart';

/// Một dòng chọn của màn đặt lịch: nhãn nhỏ, giá trị đã chọn (hoặc gợi ý chọn) và mũi tên.
/// Chạm để mở bảng chọn; khi đã chọn viền và biểu tượng đổi sang màu chính.
class BookingPickRow extends StatelessWidget {
  const BookingPickRow({
    super.key,
    required this.icon,
    required this.label,
    required this.placeholder,
    required this.onTap,
    this.value,
    this.detail,
    this.leading,
    this.enabled = true,
    this.locked = false,
  });

  final IconData icon;
  final String label;
  final String placeholder;
  final String? value;
  final String? detail;

  /// Thay biểu tượng bằng ảnh đại diện khi có.
  final Widget? leading;
  final VoidCallback onTap;
  final bool enabled;

  /// Giá trị do lựa chọn trước quyết định, không đổi được ở đây.
  final bool locked;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final text = Theme.of(context).textTheme;
    final chosen = value != null;
    final interactive = enabled && !locked;
    return Semantics(
      button: interactive,
      enabled: interactive,
      label: chosen ? '$label: $value' : '$label: $placeholder',
      child: ExcludeSemantics(
        child: PressScale(
          child: Material(
            color: chosen ? colors.primarySoft : colors.surface,
            borderRadius: BorderRadius.circular(AppRadius.lg),
            child: InkWell(
              onTap: interactive ? onTap : null,
              borderRadius: BorderRadius.circular(AppRadius.lg),
              child: Ink(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.sm,
                  vertical: AppSpacing.sm,
                ),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(AppRadius.lg),
                  border: Border.all(
                    color: chosen
                        ? colors.primary.withValues(alpha: 0.45)
                        : colors.border,
                  ),
                ),
                child: Row(
                  children: [
                    leading ??
                        Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: chosen ? colors.surface : colors.primarySoft,
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            icon,
                            size: 21,
                            color: enabled ? colors.primary : colors.muted,
                          ),
                        ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            label,
                            style: text.labelMedium?.copyWith(
                              color: colors.muted,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            value ?? placeholder,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: text.titleSmall?.copyWith(
                              color: chosen
                                  ? colors.primaryDark
                                  : (enabled ? colors.ink : colors.muted),
                            ),
                          ),
                          if (detail != null)
                            Text(
                              detail!,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: text.bodySmall?.copyWith(
                                color: colors.muted,
                              ),
                            ),
                        ],
                      ),
                    ),
                    Icon(
                      locked
                          ? Icons.lock_outline_rounded
                          : (chosen
                                ? Icons.edit_outlined
                                : Icons.chevron_right_rounded),
                      size: 20,
                      color: colors.muted,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
