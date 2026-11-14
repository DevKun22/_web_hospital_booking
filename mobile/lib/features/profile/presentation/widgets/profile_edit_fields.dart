import 'package:flutter/material.dart';
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

class ProfileEditSectionHeader extends StatelessWidget {
  const ProfileEditSectionHeader({
    super.key,
    required this.icon,
    required this.title,
    required this.description,
  });

  final IconData icon;
  final String title;
  final String description;

  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Icon(icon, color: Theme.of(context).colorScheme.primary),
      const SizedBox(width: 10),
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 3),
            Text(
              description,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    ],
  );
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
