import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/design/app_design_tokens.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:hospital_booking_mobile/core/formatters/search_text.dart';
import 'package:hospital_booking_mobile/features/booking/presentation/widgets/booking_picker_parts.dart';
import 'package:hospital_booking_mobile/features/packages/domain/medical_package.dart';

/// Bảng chọn gói khám có ô tìm kiếm.
Future<void> showBookingPackagePicker(
  BuildContext context, {
  required List<MedicalPackage> packages,
  required ValueChanged<String> onSelected,
  String? selectedId,
}) => showBookingPickerSheet(
  context,
  (sheetContext, scrollController) => _PackagePicker(
    packages: packages,
    selectedId: selectedId,
    scrollController: scrollController,
    onSelected: (id) {
      Navigator.of(sheetContext).pop();
      onSelected(id);
    },
  ),
);

class _PackagePicker extends StatefulWidget {
  const _PackagePicker({
    required this.packages,
    required this.scrollController,
    required this.onSelected,
    this.selectedId,
  });

  final List<MedicalPackage> packages;
  final ScrollController scrollController;
  final ValueChanged<String> onSelected;
  final String? selectedId;

  @override
  State<_PackagePicker> createState() => _PackagePickerState();
}

class _PackagePickerState extends State<_PackagePicker> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final filtered = widget.packages
        .where(
          (item) => matchesSearch(
            '${item.name} ${item.departmentName ?? ''} ${item.summary ?? ''}',
            _query,
          ),
        )
        .toList(growable: false);
    final text = Theme.of(context).textTheme;
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.page,
            0,
            AppSpacing.page,
            AppSpacing.xs,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Chọn gói khám', style: text.titleMedium),
              const SizedBox(height: AppSpacing.xs),
              BookingSearchField(
                hint: 'Tìm gói khám',
                onChanged: (value) => setState(() => _query = value),
              ),
            ],
          ),
        ),
        Expanded(
          child: BookingPagedList<MedicalPackage>(
            items: filtered,
            scrollController: widget.scrollController,
            emptyMessage: 'Không tìm thấy gói khám phù hợp.',
            itemBuilder: (context, item) => _PackageTile(
              item: item,
              selected: item.id == widget.selectedId,
              onTap: () => widget.onSelected(item.id),
            ),
          ),
        ),
      ],
    );
  }
}

class _PackageTile extends StatelessWidget {
  const _PackageTile({
    required this.item,
    required this.selected,
    required this.onTap,
  });

  final MedicalPackage item;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final text = Theme.of(context).textTheme;
    return Material(
      color: selected ? colors.primarySoft : colors.surface,
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: InkWell(
        key: ValueKey('booking-package-${item.id}'),
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        child: Ink(
          padding: const EdgeInsets.all(AppSpacing.sm),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadius.lg),
            border: Border.all(
              color: selected ? colors.primary : colors.border,
              width: selected ? 1.5 : 1,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: colors.violetContainer,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      Icons.health_and_safety_outlined,
                      size: 21,
                      color: colors.violet,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(item.name, style: text.titleSmall),
                        if (item.summary != null) ...[
                          const SizedBox(height: 2),
                          Text(
                            item.summary!,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: text.bodySmall?.copyWith(
                              color: colors.muted,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  if (selected)
                    Icon(Icons.check_circle_rounded, color: colors.primary),
                ],
              ),
              const SizedBox(height: AppSpacing.xs),
              Wrap(
                spacing: AppSpacing.xs,
                runSpacing: AppSpacing.xxs,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  BookingMiniChip(
                    label: formatVnd(item.finalPrice),
                    background: colors.primarySoft,
                    foreground: colors.primaryDark,
                  ),
                  if (item.departmentName != null)
                    ConstrainedBox(
                      constraints: BoxConstraints(
                        maxWidth: MediaQuery.sizeOf(context).width * 0.5,
                      ),
                      child: BookingMiniChip(
                        label: item.departmentName!,
                        background: colors.infoContainer,
                        foreground: colors.info,
                      ),
                    ),
                  if (item.isBhytSupport)
                    BookingMiniChip(
                      label: 'BHYT',
                      background: colors.successContainer,
                      foreground: colors.success,
                    ),
                  if (item.slug != null)
                    TextButton(
                      onPressed: () => context.push(
                        '/packages/${Uri.encodeComponent(item.slug!)}',
                      ),
                      style: TextButton.styleFrom(
                        visualDensity: VisualDensity.compact,
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                      child: const Text('Chi tiết'),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
