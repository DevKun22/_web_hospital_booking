import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:hospital_booking_mobile/core/widgets/app_error_banner.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/profile/application/patient_profile_controller.dart';
import 'package:hospital_booking_mobile/features/profile/domain/patient_profile.dart';

class ProfileEditScreen extends ConsumerStatefulWidget {
  const ProfileEditScreen({super.key});

  @override
  ConsumerState<ProfileEditScreen> createState() => _ProfileEditScreenState();
}

class _ProfileEditScreenState extends ConsumerState<ProfileEditScreen> {
  final _formKey = GlobalKey<FormState>();
  final _fullName = TextEditingController();
  final _email = TextEditingController();
  final _cccd = TextEditingController();
  final _address = TextEditingController();
  final _healthInsuranceCode = TextEditingController();
  final _registeredHospital = TextEditingController();
  final _bloodType = TextEditingController();
  final _height = TextEditingController();
  final _weight = TextEditingController();
  final _bloodPressure = TextEditingController();
  final _allergies = TextEditingController();
  final _medicalHistory = TextEditingController();
  final _familyHistory = TextEditingController();

  String? _hydratedProfileId;
  String? _dateOfBirth;
  PatientGender? _gender;
  bool _hasBhyt = false;
  _ProfileFormSnapshot? _baseline;
  bool _isHydrating = false;
  bool _allowPop = false;
  bool _discardDialogOpen = false;

  @override
  void initState() {
    super.initState();
    for (final controller in _textControllers) {
      controller.addListener(_handleFieldChanged);
    }
  }

  List<TextEditingController> get _textControllers => [
    _fullName,
    _email,
    _cccd,
    _address,
    _healthInsuranceCode,
    _registeredHospital,
    _bloodType,
    _height,
    _weight,
    _bloodPressure,
    _allergies,
    _medicalHistory,
    _familyHistory,
  ];

  @override
  void dispose() {
    for (final controller in _textControllers) {
      controller.removeListener(_handleFieldChanged);
      controller.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(patientProfileControllerProvider);
    final profile = state.profile;
    if (profile != null && _hydratedProfileId != profile.id) {
      _hydrate(profile);
    }

    final hasUnsavedChanges = _hasUnsavedChanges;

    return PopScope<void>(
      canPop: !state.isSaving && (!hasUnsavedChanges || _allowPop),
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _handleBlockedPop(state.isSaving);
      },
      child: Scaffold(
        appBar: AppBar(title: const Text('Chỉnh sửa hồ sơ')),
        body: SafeArea(
          child: profile == null
              ? state.isInitialLoading
                    ? const _EditLoading()
                    : AppEmptyState(
                        icon: Icons.person_off_outlined,
                        title: 'Chưa có dữ liệu hồ sơ',
                        message: 'Quay lại và thử đồng bộ hồ sơ một lần nữa.',
                        action: FilledButton(
                          onPressed: () => Navigator.of(context).pop(),
                          child: const Text('Quay lại'),
                        ),
                      )
              : Form(
                  key: _formKey,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                    children: [
                      if (state.error != null) ...[
                        AppErrorBanner(
                          error: state.error!,
                          onDismiss: ref
                              .read(patientProfileControllerProvider.notifier)
                              .dismissError,
                        ),
                        const SizedBox(height: 14),
                      ],
                      const _EditSectionHeader(
                        icon: Icons.person_outline,
                        title: 'Thông tin cá nhân',
                        description:
                            'Số điện thoại đã xác thực không thể thay đổi tại đây.',
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _fullName,
                        textInputAction: TextInputAction.next,
                        textCapitalization: TextCapitalization.words,
                        maxLength: 120,
                        decoration: const InputDecoration(
                          labelText: 'Họ và tên *',
                          prefixIcon: Icon(Icons.badge_outlined),
                        ),
                        validator: (value) {
                          final length = value?.trim().length ?? 0;
                          if (length < 2) {
                            return 'Họ và tên phải có ít nhất 2 ký tự.';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        initialValue: profile.phone ?? '',
                        enabled: false,
                        decoration: const InputDecoration(
                          labelText: 'Số điện thoại đã xác thực',
                          prefixIcon: Icon(Icons.verified_user_outlined),
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _email,
                        keyboardType: TextInputType.emailAddress,
                        textInputAction: TextInputAction.next,
                        maxLength: 254,
                        decoration: const InputDecoration(
                          labelText: 'Email',
                          prefixIcon: Icon(Icons.email_outlined),
                        ),
                        validator: (value) {
                          final email = value?.trim() ?? '';
                          if (email.isEmpty) return null;
                          if (!RegExp(
                            r'^[^\s@]+@[^\s@]+\.[^\s@]+$',
                          ).hasMatch(email)) {
                            return 'Email không đúng định dạng.';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 12),
                      _DateField(
                        value: _dateOfBirth,
                        onSelect: _selectDateOfBirth,
                        onClear: () => setState(() => _dateOfBirth = null),
                      ),
                      const SizedBox(height: 12),
                      DropdownButtonFormField<PatientGender>(
                        initialValue: _gender,
                        decoration: const InputDecoration(
                          labelText: 'Giới tính',
                          prefixIcon: Icon(Icons.wc_outlined),
                        ),
                        items: PatientGender.values
                            .map(
                              (gender) => DropdownMenuItem(
                                value: gender,
                                child: Text(gender.label),
                              ),
                            )
                            .toList(growable: false),
                        onChanged: state.isSaving
                            ? null
                            : (value) => setState(() => _gender = value),
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _cccd,
                        keyboardType: TextInputType.number,
                        inputFormatters: [
                          FilteringTextInputFormatter.digitsOnly,
                        ],
                        maxLength: 20,
                        textInputAction: TextInputAction.next,
                        decoration: const InputDecoration(
                          labelText: 'CCCD',
                          prefixIcon: Icon(Icons.credit_card_outlined),
                        ),
                        validator: (value) {
                          final length = value?.trim().length ?? 0;
                          if (length != 0 && length < 9) {
                            return 'CCCD phải có từ 9 đến 20 chữ số.';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _address,
                        textCapitalization: TextCapitalization.sentences,
                        maxLength: 300,
                        minLines: 2,
                        maxLines: 3,
                        decoration: const InputDecoration(
                          labelText: 'Địa chỉ',
                          prefixIcon: Icon(Icons.location_on_outlined),
                          alignLabelWithHint: true,
                        ),
                      ),
                      const SizedBox(height: 22),
                      const _EditSectionHeader(
                        icon: Icons.health_and_safety_outlined,
                        title: 'Bảo hiểm y tế',
                        description:
                            'Thông tin này hỗ trợ bệnh viện chuẩn bị thủ tục tiếp nhận.',
                      ),
                      const SizedBox(height: 10),
                      Card(
                        margin: EdgeInsets.zero,
                        child: SwitchListTile(
                          title: const Text('Tôi có sử dụng BHYT'),
                          subtitle: const Text(
                            'Tắt mục này sẽ xóa mã thẻ và nơi đăng ký đã lưu.',
                          ),
                          value: _hasBhyt,
                          onChanged: state.isSaving
                              ? null
                              : (value) => setState(() => _hasBhyt = value),
                        ),
                      ),
                      if (_hasBhyt) ...[
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: _healthInsuranceCode,
                          maxLength: 50,
                          textCapitalization: TextCapitalization.characters,
                          decoration: const InputDecoration(
                            labelText: 'Mã thẻ BHYT',
                            prefixIcon: Icon(Icons.badge_outlined),
                          ),
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: _registeredHospital,
                          maxLength: 200,
                          textCapitalization: TextCapitalization.sentences,
                          decoration: const InputDecoration(
                            labelText: 'Nơi đăng ký khám chữa bệnh',
                            prefixIcon: Icon(Icons.local_hospital_outlined),
                          ),
                        ),
                      ],
                      const SizedBox(height: 22),
                      const _EditSectionHeader(
                        icon: Icons.monitor_heart_outlined,
                        title: 'Thông tin sức khỏe',
                        description:
                            'Chỉ nhập thông tin bạn biết chính xác; đây không thay thế chẩn đoán của bác sĩ.',
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _bloodType,
                        maxLength: 10,
                        textCapitalization: TextCapitalization.characters,
                        decoration: const InputDecoration(
                          labelText: 'Nhóm máu',
                          hintText: 'Ví dụ: O+',
                          prefixIcon: Icon(Icons.bloodtype_outlined),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: _DecimalField(
                              controller: _height,
                              label: 'Chiều cao (cm)',
                              max: 300,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: _DecimalField(
                              controller: _weight,
                              label: 'Cân nặng (kg)',
                              max: 500,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _bloodPressure,
                        maxLength: 40,
                        decoration: const InputDecoration(
                          labelText: 'Huyết áp',
                          hintText: 'Ví dụ: 120/80 mmHg',
                          prefixIcon: Icon(Icons.speed_outlined),
                        ),
                      ),
                      const SizedBox(height: 12),
                      _LongTextField(
                        controller: _allergies,
                        label: 'Dị ứng',
                        maxLength: 2000,
                      ),
                      const SizedBox(height: 12),
                      _LongTextField(
                        controller: _medicalHistory,
                        label: 'Tiền sử bệnh',
                        maxLength: 5000,
                      ),
                      const SizedBox(height: 12),
                      _LongTextField(
                        controller: _familyHistory,
                        label: 'Tiền sử gia đình',
                        maxLength: 5000,
                      ),
                      const SizedBox(height: 24),
                      AppPrimaryButton(
                        label: state.isSaving
                            ? 'Đang lưu hồ sơ…'
                            : 'Lưu thay đổi',
                        icon: Icons.save_outlined,
                        loading: state.isSaving,
                        onPressed: state.isSaving ? null : _save,
                      ),
                    ],
                  ),
                ),
        ),
      ),
    );
  }

  void _hydrate(PatientProfile profile) {
    _isHydrating = true;
    _hydratedProfileId = profile.id;
    _fullName.text = profile.fullName;
    _email.text = profile.email ?? '';
    _cccd.text = profile.cccd ?? '';
    _address.text = profile.address ?? '';
    _healthInsuranceCode.text = profile.healthInsuranceCode ?? '';
    _registeredHospital.text = profile.registeredHospital ?? '';
    _bloodType.text = profile.bloodType ?? '';
    _height.text = _displayNumber(profile.height);
    _weight.text = _displayNumber(profile.weight);
    _bloodPressure.text = profile.bloodPressure ?? '';
    _allergies.text = profile.allergies ?? '';
    _medicalHistory.text = profile.medicalHistory ?? '';
    _familyHistory.text = profile.familyHistory ?? '';
    _dateOfBirth = profile.dateOfBirth;
    _gender = profile.gender;
    _hasBhyt = profile.hasBhyt;
    _baseline = _snapshot();
    _isHydrating = false;
  }

  bool get _hasUnsavedChanges => _baseline != null && _snapshot() != _baseline;

  _ProfileFormSnapshot _snapshot() => (
    fullName: _fullName.text.trim(),
    email: _email.text.trim(),
    cccd: _cccd.text.trim(),
    address: _address.text.trim(),
    healthInsuranceCode: _hasBhyt ? _healthInsuranceCode.text.trim() : '',
    registeredHospital: _hasBhyt ? _registeredHospital.text.trim() : '',
    bloodType: _bloodType.text.trim(),
    height: _parseDecimal(_height.text),
    weight: _parseDecimal(_weight.text),
    bloodPressure: _bloodPressure.text.trim(),
    allergies: _allergies.text.trim(),
    medicalHistory: _medicalHistory.text.trim(),
    familyHistory: _familyHistory.text.trim(),
    dateOfBirth: _dateOfBirth,
    gender: _gender,
    hasBhyt: _hasBhyt,
  );

  void _handleFieldChanged() {
    if (!mounted || _isHydrating) return;
    setState(() {});
  }

  Future<void> _handleBlockedPop(bool isSaving) async {
    if (isSaving) {
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          const SnackBar(content: Text('Hồ sơ đang được lưu, vui lòng chờ.')),
        );
      return;
    }
    if (!_hasUnsavedChanges || _discardDialogOpen) return;
    _discardDialogOpen = true;
    final discard = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Bỏ các thay đổi?'),
        content: const Text(
          'Thông tin bạn vừa chỉnh sửa chưa được lưu và sẽ bị mất.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Tiếp tục chỉnh sửa'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Bỏ thay đổi'),
          ),
        ],
      ),
    );
    _discardDialogOpen = false;
    if (discard != true || !mounted) return;
    setState(() => _allowPop = true);
    await Future<void>.delayed(Duration.zero);
    if (mounted) Navigator.of(context).pop();
  }

  Future<void> _selectDateOfBirth() async {
    final now = DateTime.now();
    final current = DateTime.tryParse(_dateOfBirth ?? '');
    final selected = await showDatePicker(
      context: context,
      initialDate: current ?? DateTime(now.year - 25, now.month, now.day),
      firstDate: DateTime(now.year - 120),
      lastDate: DateTime(
        now.year,
        now.month,
        now.day,
      ).subtract(const Duration(days: 1)),
      helpText: 'Chọn ngày sinh',
    );
    if (selected == null || !mounted) return;
    setState(() {
      _dateOfBirth =
          '${selected.year.toString().padLeft(4, '0')}-${selected.month.toString().padLeft(2, '0')}-${selected.day.toString().padLeft(2, '0')}';
    });
  }

  Future<void> _save() async {
    FocusManager.instance.primaryFocus?.unfocus();
    if (_formKey.currentState?.validate() != true) return;
    final draft = PatientProfileDraft(
      fullName: _fullName.text,
      email: _email.text,
      dateOfBirth: _dateOfBirth,
      gender: _gender,
      cccd: _cccd.text,
      address: _address.text,
      hasBhyt: _hasBhyt,
      healthInsuranceCode: _healthInsuranceCode.text,
      registeredHospital: _registeredHospital.text,
      bloodType: _bloodType.text,
      height: _parseDecimal(_height.text),
      weight: _parseDecimal(_weight.text),
      bloodPressure: _bloodPressure.text,
      allergies: _allergies.text,
      medicalHistory: _medicalHistory.text,
      familyHistory: _familyHistory.text,
    );
    final saved = await ref
        .read(patientProfileControllerProvider.notifier)
        .save(draft);
    if (mounted && saved) {
      setState(() => _allowPop = true);
      await Future<void>.delayed(Duration.zero);
      if (mounted) Navigator.of(context).pop(true);
    }
  }
}

typedef _ProfileFormSnapshot = ({
  String fullName,
  String email,
  String cccd,
  String address,
  String healthInsuranceCode,
  String registeredHospital,
  String bloodType,
  double? height,
  double? weight,
  String bloodPressure,
  String allergies,
  String medicalHistory,
  String familyHistory,
  String? dateOfBirth,
  PatientGender? gender,
  bool hasBhyt,
});

class _DateField extends StatelessWidget {
  const _DateField({
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

class _DecimalField extends StatelessWidget {
  const _DecimalField({
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
      final number = _parseDecimal(raw);
      if (number == null || number <= 0 || number > max) {
        return 'Giá trị không hợp lệ';
      }
      return null;
    },
  );
}

class _LongTextField extends StatelessWidget {
  const _LongTextField({
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

class _EditSectionHeader extends StatelessWidget {
  const _EditSectionHeader({
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

class _EditLoading extends StatelessWidget {
  const _EditLoading();

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

double? _parseDecimal(String value) =>
    double.tryParse(value.trim().replaceAll(',', '.'));

String _displayNumber(double? value) {
  if (value == null) return '';
  return value == value.roundToDouble()
      ? value.toInt().toString()
      : value.toStringAsFixed(1);
}
