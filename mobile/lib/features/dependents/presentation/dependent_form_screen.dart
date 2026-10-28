import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/core/widgets/app_error_banner.dart';
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
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
            children: [
              if (state.error != null) ...[
                AppErrorBanner(
                  error: state.error!,
                  onDismiss: ref
                      .read(dependentProfilesControllerProvider.notifier)
                      .dismissError,
                ),
                const SizedBox(height: 14),
              ],
              TextFormField(
                controller: _name,
                textInputAction: TextInputAction.next,
                decoration: const InputDecoration(
                  labelText: 'Họ và tên *',
                  prefixIcon: Icon(Icons.person_outline_rounded),
                ),
                validator: (value) => (value?.trim().length ?? 0) < 2
                    ? 'Họ tên tối thiểu 2 ký tự.'
                    : null,
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<DependentRelationship>(
                initialValue: _relationship,
                decoration: const InputDecoration(
                  labelText: 'Mối quan hệ *',
                  prefixIcon: Icon(Icons.family_restroom_outlined),
                ),
                items: DependentRelationship.values
                    .map(
                      (item) => DropdownMenuItem(
                        value: item,
                        child: Text(item.label),
                      ),
                    )
                    .toList(),
                onChanged: (value) => setState(
                  () => _relationship = value ?? DependentRelationship.other,
                ),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _dateOfBirth,
                readOnly: true,
                decoration: const InputDecoration(
                  labelText: 'Ngày sinh',
                  prefixIcon: Icon(Icons.cake_outlined),
                ),
                onTap: _pickDate,
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: _gender,
                decoration: const InputDecoration(labelText: 'Giới tính'),
                items: const [
                  DropdownMenuItem(value: 'MALE', child: Text('Nam')),
                  DropdownMenuItem(value: 'FEMALE', child: Text('Nữ')),
                  DropdownMenuItem(value: 'OTHER', child: Text('Khác')),
                ],
                onChanged: (value) => setState(() => _gender = value),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _phone,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(
                  labelText: 'Số điện thoại riêng (nếu có)',
                  prefixIcon: Icon(Icons.phone_outlined),
                ),
                validator: (value) {
                  final phone = value?.trim() ?? '';
                  if (phone.isEmpty) return null;
                  return RegExp(r'^(0|\+84)[0-9]{9,10}$').hasMatch(phone)
                      ? null
                      : 'Số điện thoại không hợp lệ.';
                },
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(
                  labelText: 'Email riêng (nếu có)',
                  prefixIcon: Icon(Icons.email_outlined),
                ),
                validator: (value) {
                  final email = value?.trim() ?? '';
                  if (email.isEmpty) return null;
                  return RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(email)
                      ? null
                      : 'Email không hợp lệ.';
                },
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _cccd,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'CCCD (nếu có)',
                  prefixIcon: Icon(Icons.badge_outlined),
                ),
                validator: (value) {
                  final cccd = value?.trim() ?? '';
                  if (cccd.isEmpty) return null;
                  return cccd.length >= 9 && cccd.length <= 20
                      ? null
                      : 'CCCD cần từ 9 đến 20 ký tự.';
                },
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _address,
                decoration: const InputDecoration(
                  labelText: 'Địa chỉ',
                  prefixIcon: Icon(Icons.location_on_outlined),
                ),
              ),
              const SizedBox(height: 12),
              Card(
                margin: EdgeInsets.zero,
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    children: [
                      SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        value: _hasBhyt,
                        title: const Text('Có thẻ BHYT'),
                        onChanged: (value) => setState(() => _hasBhyt = value),
                      ),
                      if (_hasBhyt) ...[
                        TextFormField(
                          controller: _insuranceCode,
                          decoration: const InputDecoration(
                            labelText: 'Mã thẻ BHYT *',
                          ),
                          validator: (value) =>
                              _hasBhyt && (value?.trim().isEmpty ?? true)
                              ? 'Vui lòng nhập mã thẻ BHYT.'
                              : null,
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: _registeredHospital,
                          decoration: const InputDecoration(
                            labelText: 'Nơi đăng ký khám ban đầu',
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Card(
                margin: EdgeInsets.zero,
                child: ExpansionTile(
                  leading: const Icon(Icons.monitor_heart_outlined),
                  title: const Text('Thông tin sức khỏe'),
                  subtitle: const Text('Không bắt buộc'),
                  childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                  children: [
                    TextFormField(
                      controller: _allergies,
                      minLines: 1,
                      maxLines: 3,
                      decoration: const InputDecoration(labelText: 'Dị ứng'),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _medicalHistory,
                      minLines: 2,
                      maxLines: 4,
                      decoration: const InputDecoration(
                        labelText: 'Tiền sử bệnh',
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _familyHistory,
                      minLines: 2,
                      maxLines: 4,
                      decoration: const InputDecoration(
                        labelText: 'Tiền sử gia đình',
                      ),
                    ),
                  ],
                ),
              ),
              if (!editing) ...[
                const SizedBox(height: 12),
                CheckboxListTile(
                  contentPadding: const EdgeInsets.symmetric(horizontal: 4),
                  value: _consentConfirmed,
                  onChanged: state.isSaving
                      ? null
                      : (value) =>
                            setState(() => _consentConfirmed = value ?? false),
                  title: const Text('Xác nhận quyền quản lý hồ sơ'),
                  subtitle: const Text(
                    'Tôi xác nhận có quyền cung cấp thông tin và đặt lịch khám cho người này.',
                  ),
                  controlAffinity: ListTileControlAffinity.leading,
                ),
              ],
              const SizedBox(height: 22),
              FilledButton.icon(
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
    );
  }

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
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final current = DateTime.tryParse(_dateOfBirth.text);
    final selected = await showDatePicker(
      context: context,
      firstDate: DateTime(1900),
      lastDate: DateTime(
        now.year,
        now.month,
        now.day,
      ).subtract(const Duration(days: 1)),
      initialDate: current ?? DateTime(now.year - 10, now.month, now.day),
      helpText: 'Chọn ngày sinh',
    );
    if (selected != null) {
      _dateOfBirth.text =
          '${selected.year.toString().padLeft(4, '0')}-${selected.month.toString().padLeft(2, '0')}-${selected.day.toString().padLeft(2, '0')}';
    }
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
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
