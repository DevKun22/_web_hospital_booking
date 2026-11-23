import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:hospital_booking_mobile/core/widgets/app_error_banner.dart';
import 'package:hospital_booking_mobile/core/widgets/app_form.dart';
import 'package:hospital_booking_mobile/core/widgets/birth_date_picker.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/dependents/application/dependent_profiles_controller.dart';
import 'package:hospital_booking_mobile/features/dependents/domain/dependent_profile.dart';

class DependentFormScreen extends ConsumerStatefulWidget {
  const DependentFormScreen({super.key, this.dependentId});

  final String? dependentId;

  @override
  ConsumerState<DependentFormScreen> createState() =>
      _DependentFormScreenState();
}

class _DependentFormScreenState extends ConsumerState<DependentFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _scrollController = ScrollController();
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _email = TextEditingController();
  final _dateOfBirth = TextEditingController();
  final _cccd = TextEditingController();
  final _address = TextEditingController();
  final _insuranceCode = TextEditingController();
  final _registeredHospital = TextEditingController();
  final _allergies = TextEditingController();
  final _medicalHistory = TextEditingController();
  final _familyHistory = TextEditingController();
  DependentRelationship _relationship = DependentRelationship.child;
  String? _gender;
  bool _hasBhyt = false;
  bool _consentConfirmed = false;
  bool _initialized = false;
  bool _initializationScheduled = false;

  @override
  void initState() {
    super.initState();
    if (widget.dependentId == null) _initialized = true;
  }

  @override
  void dispose() {
    _scrollController.dispose();
    for (final controller in [
      _name,
      _phone,
      _email,
      _dateOfBirth,
      _cccd,
      _address,
      _insuranceCode,
      _registeredHospital,
      _allergies,
      _medicalHistory,
      _familyHistory,
    ]) {
      controller.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(dependentProfilesControllerProvider);
    final existing = widget.dependentId == null
        ? null
        : _findById(state.items, widget.dependentId!);
    if (!_initialized && existing != null && !_initializationScheduled) {
      _initializationScheduled = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        _apply(existing);
        setState(() => _initialized = true);
      });
    }

    if (!_initialized) {
      return Scaffold(
        appBar: AppBar(title: const Text('Chỉnh sửa người thân')),
        body: state.loaded && existing == null
            ? AppEmptyState(
                icon: Icons.person_off_outlined,
                title: 'Không tìm thấy hồ sơ',
                message: 'Hồ sơ có thể đã ngừng được quản lý.',
                action: FilledButton(
                  onPressed: context.pop,
                  child: const Text('Quay lại'),
                ),
              )
            : const Center(child: CircularProgressIndicator()),
      );
    }

    final editing = widget.dependentId != null;
    return Scaffold(
      appBar: AppBar(
        title: Text(editing ? 'Chỉnh sửa người thân' : 'Thêm người thân'),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.page,
            AppSpacing.xs,
            AppSpacing.page,
            AppSpacing.sm,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (!editing)
                CheckboxListTile(
                  key: const ValueKey('dependent-consent'),
                  contentPadding: EdgeInsets.zero,
                  dense: true,
                  visualDensity: VisualDensity.compact,
                  value: _consentConfirmed,
                  onChanged: state.isSaving
                      ? null
                      : (value) =>
                            setState(() => _consentConfirmed = value ?? false),
                  title: const Text(
                    'Tôi xác nhận có quyền quản lý hồ sơ này *',
                  ),
                  subtitle: const Text(
                    'Tôi có quyền cung cấp thông tin và đặt lịch khám cho người này.',
                  ),
                  controlAffinity: ListTileControlAffinity.leading,
                ),
              FilledButton.icon(
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(
                    AppSize.primaryControlHeight,
                  ),
                ),
                onPressed: state.isSaving ? null : _save,
                icon: state.isSaving
                    ? const SizedBox.square(
                        dimension: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.save_outlined),
                label: Text(state.isSaving ? 'Đang lưu…' : 'Lưu hồ sơ'),
              ),
            ],
          ),
        ),
      ),
      body: SafeArea(
        child: Form(
          key: _formKey,
          // SingleChildScrollView để mọi ô luôn nằm trong cây widget: form kiểm tra đủ mọi ô, các dòng mở rộng giữ trạng thái.
          child: SingleChildScrollView(
            controller: _scrollController,
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.page,
              AppSpacing.xs,
              AppSpacing.page,
              AppSpacing.xl,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (state.error != null) ...[
                  AppErrorBanner(
                    error: state.error!,
                    onDismiss: ref
                        .read(dependentProfilesControllerProvider.notifier)
                        .dismissError,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                ],
                Text(
                  'Mối quan hệ *',
                  style: Theme.of(context).textTheme.titleSmall,
                ),
                const SizedBox(height: AppSpacing.xs),
                AppChoiceChips<DependentRelationship>(
                  items: DependentRelationship.values,
                  selected: _relationship,
                  labelOf: (item) => item.label,
                  onChanged: (value) => setState(() => _relationship = value),
                ),
                const SizedBox(height: AppSpacing.md),
                TextFormField(
                  controller: _name,
                  textInputAction: TextInputAction.next,
                  textCapitalization: TextCapitalization.words,
                  maxLength: 120,
                  buildCounter: nearLimitCounter,
                  decoration: const InputDecoration(labelText: 'Họ và tên *'),
                  validator: (value) => (value?.trim().length ?? 0) < 2
                      ? 'Họ tên tối thiểu 2 ký tự.'
                      : null,
                ),
                const SizedBox(height: AppSpacing.sm),
                AppPickerField(
                  label: 'Ngày sinh',
                  placeholder: 'Chọn ngày sinh',
                  value: _dateOfBirth.text.isEmpty
                      ? null
                      : formatDateVi(_dateOfBirth.text),
                  icon: Icons.calendar_month_outlined,
                  onTap: _pickDate,
                  onClear: () => setState(() => _dateOfBirth.clear()),
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
                AppFormGroupRow(
                  icon: Icons.phone_outlined,
                  title: 'Số điện thoại, email riêng',
                  summary:
                      _phone.text.trim().isEmpty && _email.text.trim().isEmpty
                      ? 'Nếu có'
                      : 'Đã nhập',
                  expanded: _expanded['contact'] ?? false,
                  onToggle: () => _toggle('contact'),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      TextFormField(
                        controller: _phone,
                        keyboardType: TextInputType.phone,
                        maxLength: 12,
                        buildCounter: nearLimitCounter,
                        decoration: const InputDecoration(
                          labelText: 'Số điện thoại riêng',
                        ),
                        validator: (value) {
                          final phone = value?.trim() ?? '';
                          if (phone.isEmpty) return null;
                          return RegExp(
                                r'^(0|\+84)[0-9]{9,10}$',
                              ).hasMatch(phone)
                              ? null
                              : 'Số điện thoại không hợp lệ.';
                        },
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      TextFormField(
                        controller: _email,
                        keyboardType: TextInputType.emailAddress,
                        decoration: const InputDecoration(
                          labelText: 'Email riêng',
                        ),
                        validator: (value) {
                          final email = value?.trim() ?? '';
                          if (email.isEmpty) return null;
                          return RegExp(
                                r'^[^\s@]+@[^\s@]+\.[^\s@]+$',
                              ).hasMatch(email)
                              ? null
                              : 'Email không hợp lệ.';
                        },
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                AppFormGroupRow(
                  icon: Icons.badge_outlined,
                  title: 'CCCD và địa chỉ',
                  summary:
                      _cccd.text.trim().isEmpty && _address.text.trim().isEmpty
                      ? 'Nếu có'
                      : 'Đã nhập',
                  expanded: _expanded['identity'] ?? false,
                  onToggle: () => _toggle('identity'),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      TextFormField(
                        controller: _cccd,
                        keyboardType: TextInputType.number,
                        maxLength: 20,
                        buildCounter: nearLimitCounter,
                        decoration: const InputDecoration(labelText: 'CCCD'),
                        validator: (value) {
                          final cccd = value?.trim() ?? '';
                          if (cccd.isEmpty) return null;
                          return cccd.length >= 9 && cccd.length <= 20
                              ? null
                              : 'CCCD cần từ 9 đến 20 ký tự.';
                        },
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      TextFormField(
                        controller: _address,
                        maxLength: 300,
                        buildCounter: nearLimitCounter,
                        minLines: 2,
                        maxLines: 3,
                        decoration: const InputDecoration(
                          labelText: 'Địa chỉ',
                          alignLabelWithHint: true,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                AppFormToggleRow(
                  icon: Icons.health_and_safety_outlined,
                  title: 'Có thẻ BHYT',
                  value: _hasBhyt,
                  onChanged: (value) => setState(() => _hasBhyt = value),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      TextFormField(
                        controller: _insuranceCode,
                        maxLength: 50,
                        buildCounter: nearLimitCounter,
                        textCapitalization: TextCapitalization.characters,
                        decoration: const InputDecoration(
                          labelText: 'Mã thẻ BHYT *',
                        ),
                        validator: (value) =>
                            _hasBhyt && (value?.trim().isEmpty ?? true)
                            ? 'Vui lòng nhập mã thẻ BHYT.'
                            : null,
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      TextFormField(
                        controller: _registeredHospital,
                        maxLength: 200,
                        buildCounter: nearLimitCounter,
                        decoration: const InputDecoration(
                          labelText: 'Nơi đăng ký khám ban đầu',
                          helperText:
                              'Tắt công tắc BHYT sẽ xóa mã thẻ và nơi đăng ký đã lưu.',
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                AppFormGroupRow(
                  icon: Icons.monitor_heart_outlined,
                  title: 'Thông tin sức khỏe',
                  summary:
                      _allergies.text.trim().isEmpty &&
                          _medicalHistory.text.trim().isEmpty &&
                          _familyHistory.text.trim().isEmpty
                      ? 'Tùy chọn'
                      : 'Đã nhập',
                  expanded: _expanded['health'] ?? false,
                  onToggle: () => _toggle('health'),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      TextFormField(
                        controller: _allergies,
                        minLines: 1,
                        maxLines: 3,
                        maxLength: 2000,
                        buildCounter: nearLimitCounter,
                        decoration: const InputDecoration(labelText: 'Dị ứng'),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      TextFormField(
                        controller: _medicalHistory,
                        minLines: 2,
                        maxLines: 4,
                        maxLength: 5000,
                        buildCounter: nearLimitCounter,
                        decoration: const InputDecoration(
                          labelText: 'Tiền sử sức khỏe',
                        ),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      TextFormField(
                        controller: _familyHistory,
                        minLines: 2,
                        maxLines: 4,
                        maxLength: 5000,
                        buildCounter: nearLimitCounter,
                        decoration: const InputDecoration(
                          labelText: 'Tiền sử gia đình',
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// Dòng nào đang mở ('contact', 'identity', 'health'); mặc định thu gọn, tự mở khi lưu mà có ô báo lỗi.
  final Map<String, bool> _expanded = {};

  void _toggle(String key) =>
      setState(() => _expanded[key] = !(_expanded[key] ?? false));

  void _apply(DependentProfile profile) {
    _name.text = profile.fullName;
    _phone.text = profile.phone ?? '';
    _email.text = profile.email ?? '';
    _dateOfBirth.text = profile.dateOfBirth ?? '';
    _cccd.text = profile.cccd ?? '';
    _address.text = profile.address ?? '';
    _insuranceCode.text = profile.healthInsuranceCode ?? '';
    _registeredHospital.text = profile.registeredHospital ?? '';
    _allergies.text = profile.allergies ?? '';
    _medicalHistory.text = profile.medicalHistory ?? '';
    _familyHistory.text = profile.familyHistory ?? '';
    _relationship = profile.relationship;
    _gender = profile.gender;
    _hasBhyt = profile.hasBhyt;
    _expanded
      ..['contact'] = _phone.text.isNotEmpty || _email.text.isNotEmpty
      ..['identity'] = _cccd.text.isNotEmpty || _address.text.isNotEmpty
      ..['health'] =
          _allergies.text.isNotEmpty ||
          _medicalHistory.text.isNotEmpty ||
          _familyHistory.text.isNotEmpty;
  }

  Future<void> _pickDate() async {
    final selected = await showBirthDatePicker(
      context,
      initial: DateTime.tryParse(_dateOfBirth.text),
    );
    if (selected == null || !mounted) return;
    setState(() {
      _dateOfBirth.text =
          '${selected.year.toString().padLeft(4, '0')}-${selected.month.toString().padLeft(2, '0')}-${selected.day.toString().padLeft(2, '0')}';
    });
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) {
      // Ô báo lỗi thường nằm ở đầu form, ngoài màn hình khi bấm Lưu ở cuối trang.
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          const SnackBar(content: Text('Vui lòng kiểm tra các ô báo lỗi.')),
        );
      setState(() {
        _expanded['contact'] = true;
        _expanded['identity'] = true;
        _expanded['health'] = true;
      });
      return;
    }
    if (widget.dependentId == null && !_consentConfirmed) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Vui lòng xác nhận quyền quản lý hồ sơ người thân.'),
        ),
      );
      return;
    }
    FocusScope.of(context).unfocus();
    final success = await ref
        .read(dependentProfilesControllerProvider.notifier)
        .save(
          DependentProfileDraft(
            fullName: _name.text,
            relationship: _relationship,
            phone: _phone.text,
            email: _email.text,
            dateOfBirth: _dateOfBirth.text,
            gender: _gender,
            cccd: _cccd.text,
            address: _address.text,
            hasBhyt: _hasBhyt,
            healthInsuranceCode: _insuranceCode.text,
            registeredHospital: _registeredHospital.text,
            allergies: _allergies.text,
            medicalHistory: _medicalHistory.text,
            familyHistory: _familyHistory.text,
            consentConfirmed: _consentConfirmed,
          ),
          id: widget.dependentId,
        );
    if (!mounted || !success) return;
    context.pop(true);
  }
}

DependentProfile? _findById(List<DependentProfile> items, String id) {
  for (final item in items) {
    if (item.id == id) return item;
  }
  return null;
}
