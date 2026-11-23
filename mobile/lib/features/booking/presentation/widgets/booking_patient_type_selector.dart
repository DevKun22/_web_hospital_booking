import 'package:hospital_booking_mobile/core/design/app_design_tokens.dart';
import 'package:flutter/material.dart';

enum BookingPatientType { self, relative }

class BookingPatientTypeSelector extends StatelessWidget {
  const BookingPatientTypeSelector({
    super.key,
    this.selected = BookingPatientType.self,
    this.relativeEnabled = false,
    this.relativeUnavailableLabel = 'Sắp có',
    required this.onChanged,
    this.onUnavailableRelativeTap,
  });

  final BookingPatientType selected;
  final bool relativeEnabled;
  final String relativeUnavailableLabel;
  final ValueChanged<BookingPatientType> onChanged;
  final VoidCallback? onUnavailableRelativeTap;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.xxs),
      decoration: BoxDecoration(
        color: colors.secondaryContainer.withValues(alpha: 0.55),
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Row(
        children: [
          Expanded(
            child: _PatientTypeOption(
              key: const Key('booking-patient-type-self'),
              icon: Icons.person_outline_outlined,
              label: 'Đặt cho bản thân',
              selected: selected == BookingPatientType.self,
              onTap: () => onChanged(BookingPatientType.self),
            ),
          ),
          const SizedBox(width: AppSpacing.xxs),
          Expanded(
            child: _PatientTypeOption(
              key: const Key('booking-patient-type-relative'),
              icon: Icons.group_outlined,
              label: 'Đặt cho người thân',
              selected: selected == BookingPatientType.relative,
              badge: relativeEnabled ? null : relativeUnavailableLabel,
              muted: !relativeEnabled,
              onTap: relativeEnabled
                  ? () => onChanged(BookingPatientType.relative)
                  : onUnavailableRelativeTap,
            ),
          ),
        ],
      ),
    );
  }
}

class _PatientTypeOption extends StatelessWidget {
  const _PatientTypeOption({
    super.key,
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
    this.badge,
    this.muted = false,
  });

  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback? onTap;
  final String? badge;
  final bool muted;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final foreground = selected
        ? colors.primary
        : muted
        ? colors.onSurfaceVariant
        : colors.onSurface;

    return Material(
      color: selected ? colors.surface : Colors.transparent,
      borderRadius: BorderRadius.circular(AppRadius.sm),
      elevation: selected ? 1 : 0,
      shadowColor: colors.shadow.withValues(alpha: 0.08),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.sm),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 52),
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.xs,
              vertical: AppSpacing.xs,
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(icon, size: 18, color: foreground),
                    const SizedBox(width: AppSpacing.xs),
                    Flexible(
                      child: Text(
                        label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.labelMedium
                            ?.copyWith(
                              color: foreground,
                              fontWeight: selected
                                  ? AppFontWeight.strong
                                  : AppFontWeight.strong,
                            ),
                      ),
                    ),
                  ],
                ),
                if (badge != null) ...[
                  const SizedBox(height: AppSpacing.xxs),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.xxs,
                      vertical: AppSpacing.hair,
                    ),
                    decoration: BoxDecoration(
                      color: colors.tertiaryContainer,
                      borderRadius: BorderRadius.circular(AppRadius.pill),
                    ),
                    child: Text(
                      badge!,
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: colors.onTertiaryContainer,
                        fontWeight: AppFontWeight.strong,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
