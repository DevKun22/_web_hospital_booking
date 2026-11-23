import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:flutter/services.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';

class ProfileDateField extends StatelessWidget {
  const ProfileDateField({
    super.key,
    required this.value,
    required this.onSelect,
    required this.onClear,
  });

  final String? value;
  final VoidCallback onSelect;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) => InkWell(
    onTap: onSelect,
    borderRadius: BorderRadius.circular(14),
    child: InputDecorator(
      decoration: InputDecoration(
        labelText: 'Ngày sinh',
        prefixIcon: const Icon(Icons.cake_outlined),
        suffixIcon: value == null
            ? const Icon(Icons.calendar_month_outlined)
            : IconButton(
                tooltip: 'Xóa ngày sinh',
                onPressed: onClear,
                icon: const Icon(Icons.close_rounded),
              ),
      ),
      child: Text(value == null ? 'Chưa cập nhật' : formatDateVi(value!)),
    ),
  );
}

class ProfileDecimalField extends StatelessWidget {
  const ProfileDecimalField({
    super.key,
    required this.controller,
    required this.label,
    required this.max,
  });

  final TextEditingController controller;
  final String label;
  final double max;

  @override
  Widget build(BuildContext context) => TextFormField(
    controller: controller,
    keyboardType: const TextInputType.numberWithOptions(decimal: true),
    inputFormatters: [
      FilteringTextInputFormatter.allow(RegExp(r'^\d{0,3}([.,]\d{0,2})?')),
    ],
    decoration: InputDecoration(labelText: label),
    validator: (value) {
      final raw = value?.trim() ?? '';
      if (raw.isEmpty) return null;
      final number = parseProfileDecimal(raw);
      if (number == null || number <= 0 || number > max) {
        return 'Giá trị không hợp lệ';
      }
      return null;
    },
  );
}

class ProfileLongTextField extends StatelessWidget {
  const ProfileLongTextField({
    super.key,
    required this.controller,
    required this.label,
    required this.maxLength,
  });

  final TextEditingController controller;
  final String label;
  final int maxLength;

  @override
  Widget build(BuildContext context) => TextFormField(
    controller: controller,
    minLines: 2,
    maxLines: 4,
    maxLength: maxLength,
    textCapitalization: TextCapitalization.sentences,
    decoration: InputDecoration(labelText: label, alignLabelWithHint: true),
  );
}

/// Mục thu gọn của form hồ sơ: dấu tích xanh khi đủ, cảnh báo vàng khi còn thiếu. Trạng thái mở hoặc thu gọn do màn
/// chỉnh sửa giữ (nên không mất khi cuộn đi), nội dung vẫn nằm trong cây widget khi thu gọn để form kiểm tra đủ mọi ô.
class ProfileCollapsibleSection extends StatelessWidget {
  const ProfileCollapsibleSection({
    super.key,
    required this.title,
    required this.description,
    required this.complete,
    required this.expanded,
    required this.onToggle,
    required this.child,
  });

  final String title;
  final String description;
  final bool complete;
  final bool expanded;
  final VoidCallback onToggle;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final text = Theme.of(context).textTheme;
    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: colors.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            button: true,
            expanded: expanded,
            label: title,
            child: InkWell(
              onTap: onToggle,
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.sm),
                child: Row(
                  children: [
                    Icon(
                      complete
                          ? Icons.check_circle_rounded
                          : Icons.error_outline_rounded,
                      color: complete ? colors.success : colors.warning,
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(title, style: text.titleSmall),
                          Text(
                            complete ? 'Đã đủ thông tin' : description,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: text.bodySmall?.copyWith(
                              color: colors.muted,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Icon(
                      expanded
                          ? Icons.expand_less_rounded
                          : Icons.expand_more_rounded,
                      color: colors.muted,
                    ),
                  ],
                ),
              ),
            ),
          ),
          Visibility(
            visible: expanded,
            maintainState: true,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.sm,
                0,
                AppSpacing.sm,
                AppSpacing.sm,
              ),
              child: child,
            ),
          ),
        ],
      ),
    );
  }
}

class ProfileEditLoading extends StatelessWidget {
  const ProfileEditLoading({super.key});

  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(16),
    children: const [
      AppLoadingSkeleton(height: 300),
      SizedBox(height: 14),
      AppLoadingSkeleton(height: 220),
      SizedBox(height: 14),
      AppLoadingSkeleton(height: 360),
    ],
  );
}

double? parseProfileDecimal(String value) =>
    double.tryParse(value.trim().replaceAll(',', '.'));

String displayProfileNumber(double? value) {
  if (value == null) return '';
  return value == value.roundToDouble()
      ? value.toInt().toString()
      : value.toStringAsFixed(1);
}
