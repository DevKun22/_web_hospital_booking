import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/design/app_design_tokens.dart';

/// Kết quả bảng sửa một ô chữ: nội dung đã cắt khoảng trắng ('' là xóa) và việc người dùng có tick đồng ý không.
class TextEditResult {
  const TextEditResult(this.text, {this.consented = false});

  final String text;
  final bool consented;
}

/// Bảng sửa riêng một ô chữ: tiêu đề, một ô gõ, nút Hủy và Lưu. Trả null khi hủy.
/// [validator] nhận chuỗi đã cắt; ô để trống chỉ hợp lệ khi [allowEmpty].
/// [consentText] khác null thì hiện ô tick đồng ý và bắt buộc tick khi ô có nội dung.
Future<TextEditResult?> showTextEditSheet(
  BuildContext context, {
  required String title,
  required String label,
  String? description,
  String? initial,
  TextInputType keyboardType = TextInputType.text,
  TextCapitalization capitalization = TextCapitalization.none,
  List<TextInputFormatter>? inputFormatters,
  int? maxLength,
  int minLines = 1,
  int maxLines = 1,
  bool allowEmpty = true,
  String? hint,
  String? Function(String value)? validator,
  String? consentText,
}) => showModalBottomSheet<TextEditResult>(
  context: context,
  isScrollControlled: true,
  useRootNavigator: true,
  showDragHandle: true,
  builder: (_) => _TextEditSheet(
    title: title,
    label: label,
    description: description,
    initial: initial,
    keyboardType: keyboardType,
    capitalization: capitalization,
    inputFormatters: inputFormatters,
    maxLength: maxLength,
    minLines: minLines,
    maxLines: maxLines,
    allowEmpty: allowEmpty,
    hint: hint,
    validator: validator,
    consentText: consentText,
  ),
);

class _TextEditSheet extends StatefulWidget {
  const _TextEditSheet({
    required this.title,
    required this.label,
    required this.keyboardType,
    required this.capitalization,
    required this.minLines,
    required this.maxLines,
    required this.allowEmpty,
    this.description,
    this.initial,
    this.inputFormatters,
    this.maxLength,
    this.hint,
    this.validator,
    this.consentText,
  });

  final String title;
  final String label;
  final String? description;
  final String? initial;
  final TextInputType keyboardType;
  final TextCapitalization capitalization;
  final List<TextInputFormatter>? inputFormatters;
  final int? maxLength;
  final int minLines;
  final int maxLines;
  final bool allowEmpty;
  final String? hint;
  final String? Function(String value)? validator;
  final String? consentText;

  @override
  State<_TextEditSheet> createState() => _TextEditSheetState();
}

class _TextEditSheetState extends State<_TextEditSheet> {
  late final TextEditingController _controller = TextEditingController(
    text: widget.initial ?? '',
  );
  final _formKey = GlobalKey<FormState>();
  bool _consented = false;
  String? _consentError;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    if (_formKey.currentState?.validate() != true) return;
    final text = _controller.text.trim();
    if (widget.consentText != null && text.isNotEmpty && !_consented) {
      setState(() => _consentError = 'Cần đồng ý để lưu nội dung này.');
      return;
    }
    Navigator.of(context).pop(TextEditResult(text, consented: _consented));
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final text = Theme.of(context).textTheme;
    return Padding(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.page,
        0,
        AppSpacing.page,
        MediaQuery.viewInsetsOf(context).bottom + AppSpacing.md,
      ),
      child: SafeArea(
        child: SingleChildScrollView(
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(widget.title, style: text.titleMedium),
                if (widget.description != null) ...[
                  const SizedBox(height: AppSpacing.hair),
                  Text(
                    widget.description!,
                    style: text.bodySmall?.copyWith(color: colors.muted),
                  ),
                ],
                const SizedBox(height: AppSpacing.sm),
                TextFormField(
                  key: const ValueKey('edit-sheet-field'),
                  controller: _controller,
                  autofocus: true,
                  keyboardType: widget.keyboardType,
                  textCapitalization: widget.capitalization,
                  inputFormatters: widget.inputFormatters,
                  maxLength: widget.maxLength,
                  buildCounter: _counter,
                  minLines: widget.minLines,
                  maxLines: widget.maxLines,
                  decoration: InputDecoration(
                    labelText: widget.label,
                    hintText: widget.hint,
                  ),
                  validator: (value) {
                    final trimmed = value?.trim() ?? '';
                    if (trimmed.isEmpty) {
                      return widget.allowEmpty
                          ? null
                          : '${widget.label} không được để trống.';
                    }
                    return widget.validator?.call(trimmed);
                  },
                  onFieldSubmitted: widget.maxLines == 1
                      ? (_) => _submit()
                      : null,
                ),
                if (widget.consentText != null) ...[
                  CheckboxListTile(
                    key: const ValueKey('health-consent-checkbox'),
                    contentPadding: EdgeInsets.zero,
                    controlAffinity: ListTileControlAffinity.leading,
                    value: _consented,
                    onChanged: (value) => setState(() {
                      _consented = value ?? false;
                      _consentError = null;
                    }),
                    title: Text(widget.consentText!, style: text.bodySmall),
                  ),
                  if (_consentError != null)
                    Text(
                      _consentError!,
                      style: text.bodySmall?.copyWith(color: colors.danger),
                    ),
                ],
                const SizedBox(height: AppSpacing.sm),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Navigator.of(context).pop(),
                        style: OutlinedButton.styleFrom(
                          minimumSize: const Size.fromHeight(
                            AppSize.primaryControlHeight,
                          ),
                        ),
                        child: const Text('Hủy'),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: FilledButton(
                        key: const ValueKey('edit-sheet-save'),
                        onPressed: _submit,
                        style: FilledButton.styleFrom(
                          minimumSize: const Size.fromHeight(
                            AppSize.primaryControlHeight,
                          ),
                        ),
                        child: const Text('Lưu'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget? _counter(
    BuildContext context, {
    required int currentLength,
    required bool isFocused,
    required int? maxLength,
  }) {
    if (maxLength == null || currentLength < maxLength * 0.85) return null;
    return Text(
      '$currentLength/$maxLength',
      style: Theme.of(
        context,
      ).textTheme.labelMedium?.copyWith(color: context.colors.warning),
    );
  }
}

/// Kết quả chọn từ danh sách: [value] null nghĩa là người dùng chọn "Xóa lựa chọn".
class OptionPick<T> {
  const OptionPick(this.value);

  final T? value;
}

/// Bảng chọn một giá trị từ danh sách ngắn; chạm một dòng là chọn xong. [allowClear] thêm dòng "Xóa lựa chọn".
Future<OptionPick<T>?> showOptionSheet<T>(
  BuildContext context, {
  required String title,
  required List<T> options,
  required String Function(T) labelOf,
  T? selected,
  bool allowClear = false,
}) => showModalBottomSheet<OptionPick<T>>(
  context: context,
  useRootNavigator: true,
  showDragHandle: true,
  builder: (sheetContext) => SafeArea(
    child: ConstrainedBox(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.sizeOf(sheetContext).height * 0.7,
      ),
      child: ListView(
        shrinkWrap: true,
        padding: const EdgeInsets.only(bottom: AppSpacing.sm),
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.page,
              0,
              AppSpacing.page,
              AppSpacing.xs,
            ),
            child: Text(
              title,
              style: Theme.of(sheetContext).textTheme.titleMedium,
            ),
          ),
          for (final option in options)
            ListTile(
              minTileHeight: AppSize.optionRowHeight,
              title: Text(labelOf(option)),
              trailing: option == selected
                  ? Icon(
                      Icons.check_outlined,
                      color: sheetContext.colors.primary,
                    )
                  : null,
              onTap: () => Navigator.of(sheetContext).pop(OptionPick(option)),
            ),
          if (allowClear && selected != null)
            ListTile(
              minTileHeight: AppSize.optionRowHeight,
              title: Text(
                'Xóa lựa chọn',
                style: TextStyle(color: sheetContext.colors.danger),
              ),
              onTap: () => Navigator.of(sheetContext).pop(OptionPick<T>(null)),
            ),
        ],
      ),
    ),
  ),
);
