import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/widgets/app_error_banner.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/profile/application/patient_profile_controller.dart';
import 'package:hospital_booking_mobile/features/profile/domain/patient_profile.dart';
import 'package:hospital_booking_mobile/features/profile/presentation/widgets/profile_edit_fields.dart';

import 'package:hospital_booking_mobile/features/profile/presentation/widgets/profile_edit_sections.dart';

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
  bool _healthConsent = false;
  bool _hadHealthConsent = false;
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
                    ? const ProfileEditLoading()
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
                      ProfilePersonalSection(
                        fullName: _fullName,
                        phone: profile.phone ?? '',
                        email: _email,
                        dateOfBirth: _dateOfBirth,
                        onSelectDateOfBirth: _selectDateOfBirth,
                        onClearDateOfBirth: () =>
                            setState(() => _dateOfBirth = null),
                        gender: _gender,
                        onGenderChanged: state.isSaving
                            ? null
                            : (value) => setState(() => _gender = value),
                        cccd: _cccd,
                        address: _address,
                        isSaving: state.isSaving,
                      ),
                      const SizedBox(height: 22),
                      ProfileInsuranceSection(
                        hasBhyt: _hasBhyt,
                        onHasBhytChanged: state.isSaving
                            ? null
                            : (value) => setState(() => _hasBhyt = value),
                        healthInsuranceCode: _healthInsuranceCode,
                        registeredHospital: _registeredHospital,
                        isSaving: state.isSaving,
                      ),
                      const SizedBox(height: 22),
                      ProfileHealthSection(
                        bloodType: _bloodType,
                        height: _height,
                        weight: _weight,
                        bloodPressure: _bloodPressure,
                        allergies: _allergies,
                        medicalHistory: _medicalHistory,
                        familyHistory: _familyHistory,
                        askConsent: _hasHealthText && !_hadHealthConsent,
                        healthConsent: _healthConsent,
                        onHealthConsentChanged: state.isSaving
                            ? null
                            : (value) => setState(
                                () => _healthConsent = value ?? false,
                              ),
                        isSaving: state.isSaving,
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
    _height.text = displayProfileNumber(profile.height);
    _weight.text = displayProfileNumber(profile.weight);
    _bloodPressure.text = profile.bloodPressure ?? '';
    _allergies.text = profile.allergies ?? '';
    _medicalHistory.text = profile.medicalHistory ?? '';
    _familyHistory.text = profile.familyHistory ?? '';
    _dateOfBirth = profile.dateOfBirth;
    _gender = profile.gender;
    _hasBhyt = profile.hasBhyt;
    _hadHealthConsent = profile.hasHealthConsent;
    _healthConsent = false;
    _baseline = _snapshot();
    _isHydrating = false;
  }

  bool get _hasUnsavedChanges => _baseline != null && _snapshot() != _baseline;

  bool get _hasHealthText =>
      _allergies.text.trim().isNotEmpty ||
      _medicalHistory.text.trim().isNotEmpty ||
      _familyHistory.text.trim().isNotEmpty;

  /// Có nội dung sức khỏe mới hoặc đã đổi so với bản đã lưu (xóa nội dung không tính).
  bool get _changesHealthData {
    final baseline = _baseline;
    if (baseline == null) return false;
    bool changed(String current, String saved) =>
        current.trim().isNotEmpty && current.trim() != saved;
    return changed(_allergies.text, baseline.allergies) ||
        changed(_medicalHistory.text, baseline.medicalHistory) ||
        changed(_familyHistory.text, baseline.familyHistory);
  }

  bool get _needsHealthConsent => _changesHealthData && !_hadHealthConsent;

  _ProfileFormSnapshot _snapshot() => (
    fullName: _fullName.text.trim(),
    email: _email.text.trim(),
    cccd: _cccd.text.trim(),
    address: _address.text.trim(),
    healthInsuranceCode: _hasBhyt ? _healthInsuranceCode.text.trim() : '',
    registeredHospital: _hasBhyt ? _registeredHospital.text.trim() : '',
    bloodType: _bloodType.text.trim(),
    height: parseProfileDecimal(_height.text),
    weight: parseProfileDecimal(_weight.text),
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
    if (_needsHealthConsent && !_healthConsent) {
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          const SnackBar(
            content: Text(
              'Vui lòng đồng ý lưu thông tin sức khỏe để cập nhật dị ứng và tiền sử.',
            ),
          ),
        );
      return;
    }
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
      height: parseProfileDecimal(_height.text),
      weight: parseProfileDecimal(_weight.text),
      bloodPressure: _bloodPressure.text,
      allergies: _allergies.text,
      medicalHistory: _medicalHistory.text,
      familyHistory: _familyHistory.text,
      healthConsent: _healthConsent,
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
