import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/design/app_design_tokens.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:hospital_booking_mobile/core/widgets/app_form.dart';
import 'package:hospital_booking_mobile/core/widgets/birth_date_picker.dart';
import 'package:hospital_booking_mobile/features/dependents/application/dependent_profiles_controller.dart';
import 'package:hospital_booking_mobile/features/dependents/domain/dependent_profile.dart';
import 'package:hospital_booking_mobile/features/profile/presentation/profile_actions.dart';

/// Thêm người thân từng bước: quan hệ, thông tin cơ bản, xác nhận quyền quản lý. Các thông tin còn lại thêm sau
/// ở trang hồ sơ người thân (máy chủ chỉ bắt buộc quan hệ, họ tên và xác nhận khi tạo).
class DependentWizardScreen extends ConsumerStatefulWidget {
  const DependentWizardScreen({super.key});

  @override
  ConsumerState<DependentWizardScreen> createState() =>
      _DependentWizardScreenState();
}

class _DependentWizardScreenState extends ConsumerState<DependentWizardScreen> {
  static const _lastStep = 2;

  final _nameFormKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  int _step = 0;
  DependentRelationship? _relationship;
  DateTime? _dateOfBirth;
  String? _gender;
  bool _consent = false;
  String? _consentError;

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  void _next() {
    if (_step == 0 && _relationship == null) return;
    if (_step == 1 && _nameFormKey.currentState?.validate() != true) return;
    setState(() => _step += 1);
  }

  Future<void> _save() async {
    if (!_consent) {
      setState(() => _consentError = 'Cần xác nhận quyền quản lý hồ sơ này.');
      return;
    }
    final controller = ref.read(dependentProfilesControllerProvider.notifier);
    final created = await controller.create(
      DependentProfileDraft(
        fullName: _name.text,
        relationship: _relationship!,
        hasBhyt: false,
        dateOfBirth: _dateOfBirth == null ? null : apiDateOf(_dateOfBirth!),
        gender: _gender,
        consentConfirmed: true,
      ),
    );
    if (!mounted) return;
    if (created == null) {
      final message =
          ref.read(dependentProfilesControllerProvider).error?.message ??
          'Chưa lưu được. Vui lòng thử lại.';
      controller.dismissError();
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(message)));
      return;
    }
    Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final text = Theme.of(context).textTheme;
    final saving = ref.watch(dependentProfilesControllerProvider).isSaving;
    return PopScope<void>(
      canPop: _step == 0,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) setState(() => _step -= 1);
      },
      child: Scaffold(
        appBar: AppBar(title: const Text('Thêm người thân')),
        body: Column(
          children: [
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.page,
                  AppSpacing.xs,
                  AppSpacing.page,
                  AppSpacing.xl,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'Bước ${_step + 1} trên ${_lastStep + 1}',
                      style: text.labelMedium?.copyWith(color: colors.muted),
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        for (var i = 0; i <= _lastStep; i += 1)
                          Expanded(
                            child: Container(
                              height: 4,
                              margin: EdgeInsets.only(
                                right: i == _lastStep ? 0 : 4,
                              ),
                              decoration: BoxDecoration(
                                color: i <= _step
                                    ? colors.primary
                                    : colors.border,
                                borderRadius: BorderRadius.circular(2),
                              ),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.md),
                    if (_step == 0) ..._relationshipStep(text),
                    if (_step == 1) ..._basicsStep(text),
                    if (_step == _lastStep) ..._confirmStep(text, colors),
                  ],
                ),
              ),
            ),
            SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.page,
                  AppSpacing.xs,
                  AppSpacing.page,
                  AppSpacing.sm,
                ),
                child: FilledButton(
                  key: const ValueKey('wizard-next'),
                  onPressed: saving
                      ? null
                      : (_step == _lastStep
                            ? _save
                            : (_step == 0 && _relationship == null
                                  ? null
                                  : _next)),
                  style: FilledButton.styleFrom(
                    minimumSize: const Size.fromHeight(
                      AppSize.primaryControlHeight,
                    ),
                  ),
                  child: Text(
                    _step == _lastStep
                        ? (saving ? 'Đang lưu…' : 'Lưu hồ sơ')
                        : 'Tiếp tục',
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  List<Widget> _relationshipStep(TextTheme text) => [
    Text('Bạn đặt lịch cho ai?', style: text.titleMedium),
    const SizedBox(height: AppSpacing.sm),
    AppChoiceChips<DependentRelationship>(
      items: DependentRelationship.values,
      selected: _relationship,
      labelOf: (item) => item.label,
      onChanged: (value) => setState(() => _relationship = value),
    ),
  ];

  List<Widget> _basicsStep(TextTheme text) => [
    Text(
      'Thông tin của ${_relationship?.label.toLowerCase() ?? 'người thân'} bạn',
      style: text.titleMedium,
    ),
    const SizedBox(height: AppSpacing.sm),
    Form(
      key: _nameFormKey,
      child: TextFormField(
        controller: _name,
        autofocus: true,
        textCapitalization: TextCapitalization.words,
        maxLength: 120,
        buildCounter: nearLimitCounter,
        decoration: const InputDecoration(labelText: 'Họ và tên *'),
        validator: (value) => (value?.trim().length ?? 0) < 2
            ? 'Họ tên tối thiểu 2 ký tự.'
            : null,
      ),
    ),
    const SizedBox(height: AppSpacing.sm),
    AppPickerField(
      label: 'Ngày sinh',
      placeholder: 'Chọn ngày sinh',
      value: _dateOfBirth == null
          ? null
          : formatDateVi(apiDateOf(_dateOfBirth!)),
      icon: Icons.calendar_month_outlined,
      onTap: () async {
        final picked = await showBirthDatePicker(
          context,
          initial: _dateOfBirth,
        );
        if (picked != null) setState(() => _dateOfBirth = picked);
      },
      onClear: () => setState(() => _dateOfBirth = null),
    ),
    const SizedBox(height: AppSpacing.sm),
    AppSegmentedChoice<String>(
      label: 'Giới tính',
      items: const ['MALE', 'FEMALE', 'OTHER'],
      selected: _gender,
      labelOf: (value) => switch (value) {
        'MALE' => 'Nam',
        'FEMALE' => 'Nữ',
        _ => 'Khác',
      },
      onChanged: (value) => setState(() => _gender = value),
    ),
    const SizedBox(height: AppSpacing.md),
    Text(
      'CCCD, BHYT, địa chỉ có thể thêm sau trong hồ sơ người thân.',
      style: text.bodySmall?.copyWith(color: context.colors.muted),
    ),
  ];

  List<Widget> _confirmStep(TextTheme text, AppColors colors) => [
    Text('Xác nhận quyền quản lý', style: text.titleMedium),
    const SizedBox(height: AppSpacing.sm),
    Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: colors.border, width: 0.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(_name.text.trim(), style: text.titleSmall),
          Text(
            _relationship?.label ?? '',
            style: text.bodySmall?.copyWith(color: colors.muted),
          ),
          const SizedBox(height: AppSpacing.sm),
          CheckboxListTile(
            key: const ValueKey('dependent-consent'),
            contentPadding: EdgeInsets.zero,
            controlAffinity: ListTileControlAffinity.leading,
            value: _consent,
            onChanged: (value) => setState(() {
              _consent = value ?? false;
              _consentError = null;
            }),
            title: const Text('Tôi xác nhận có quyền quản lý hồ sơ này *'),
            subtitle: const Text(
              'Tôi có quyền cung cấp thông tin và đặt lịch khám cho người này.',
            ),
          ),
          if (_consentError != null)
            Text(
              _consentError!,
              style: text.bodySmall?.copyWith(color: colors.danger),
            ),
        ],
      ),
    ),
  ];
}
