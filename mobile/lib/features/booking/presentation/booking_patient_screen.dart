import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:hospital_booking_mobile/core/widgets/app_error_banner.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/booking/application/booking_flow_controller.dart';
import 'package:hospital_booking_mobile/features/booking/application/booking_patient_prefill.dart';
import 'package:hospital_booking_mobile/features/booking/application/booking_submission_controller.dart';
import 'package:hospital_booking_mobile/features/booking/domain/booking_submission.dart';
import 'package:hospital_booking_mobile/features/booking/presentation/widgets/booking_patient_type_selector.dart';
import 'package:hospital_booking_mobile/features/booking/presentation/widgets/booking_journey_indicator.dart';
import 'package:hospital_booking_mobile/features/dependents/application/dependent_profiles_controller.dart';
import 'package:hospital_booking_mobile/features/dependents/domain/dependent_profile.dart';
import 'package:hospital_booking_mobile/features/profile/application/patient_profile_controller.dart';
import 'package:hospital_booking_mobile/features/profile/domain/patient_profile.dart';

enum _BookingPatientField {
  fullName,
  phone,
  email,
  dateOfBirth,
  cccd,
  address,
  healthInsuranceCode,
  registeredHospital,
}

class BookingPatientScreen extends ConsumerStatefulWidget {
  const BookingPatientScreen({super.key});

  @override
  ConsumerState<BookingPatientScreen> createState() =>
      _BookingPatientScreenState();
}

class _BookingPatientScreenState extends ConsumerState<BookingPatientScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _emailController = TextEditingController();
  final _reasonController = TextEditingController();
  final _dateOfBirthController = TextEditingController();
  final _cccdController = TextEditingController();
  final _addressController = TextEditingController();
  final _insuranceCodeController = TextEditingController();
  final _registeredHospitalController = TextEditingController();
  BookingOtpChannel _otpChannel = BookingOtpChannel.sms;
  String? _gender;
  bool _hasBhyt = false;
  bool _prefilled = false;
  bool _isRevalidatingSlot = false;
  bool _applyingPrefill = false;
  bool _genderEdited = false;
  bool _bhytEdited = false;
  bool _profilePrefillApplied = false;
  BookingPatientType _patientType = BookingPatientType.self;
  DependentProfile? _selectedDependent;
  final Set<_BookingPatientField> _editedFields = {};

  late final Map<_BookingPatientField, TextEditingController>
  _prefillControllers = {
    _BookingPatientField.fullName: _nameController,
    _BookingPatientField.phone: _phoneController,
    _BookingPatientField.email: _emailController,
    _BookingPatientField.dateOfBirth: _dateOfBirthController,
    _BookingPatientField.cccd: _cccdController,
    _BookingPatientField.address: _addressController,
    _BookingPatientField.healthInsuranceCode: _insuranceCodeController,
    _BookingPatientField.registeredHospital: _registeredHospitalController,
  };

  @override
  void initState() {
    super.initState();
    for (final entry in _prefillControllers.entries) {
      entry.value.addListener(() {
        if (!_applyingPrefill) _editedFields.add(entry.key);
      });
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_prefilled) return;
    _prefilled = true;
    final user = ref.read(authControllerProvider).user;
    final profile = ref.read(patientProfileControllerProvider).profile;
    _applyPrefill(BookingPatientPrefill.from(user: user, profile: profile));
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _reasonController.dispose();
    _dateOfBirthController.dispose();
    _cccdController.dispose();
    _addressController.dispose();
    _insuranceCodeController.dispose();
    _registeredHospitalController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final booking = ref.watch(bookingFlowControllerProvider);
    final submission = ref.watch(bookingSubmissionControllerProvider);
    final profileState = ref.watch(patientProfileControllerProvider);
    final authenticatedUser = ref.watch(
      authControllerProvider.select((state) => state.user),
    );
    final selectedDoctor = booking.selectedDoctor;
    final selectedSlot = booking.selectedSlot;
    final selectedPackage = booking.selectedPackage;

    ref.listen(
      bookingSubmissionControllerProvider.select((state) => state.status),
      (previous, next) {
        if (next == BookingSubmissionStatus.awaitingOtp &&
            previous != BookingSubmissionStatus.awaitingOtp) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) context.go('/booking/verify');
          });
        }
      },
    );
    ref.listen<PatientProfile?>(
      patientProfileControllerProvider.select((state) => state.profile),
      (previous, next) {
        if (next == null || identical(previous, next)) return;
        _applyPrefill(
          BookingPatientPrefill.from(
            user: ref.read(authControllerProvider).user,
            profile: next,
          ),
        );
      },
    );

    if (!booking.selection.isComplete ||
        selectedDoctor == null ||
        selectedSlot == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Thông tin bệnh nhân')),
        body: AppEmptyState(
          icon: Icons.event_busy_outlined,
          title: 'Chưa chọn đủ lịch khám',
          message: 'Vui lòng chọn chuyên khoa, bác sĩ, ngày và khung giờ.',
          action: FilledButton(
            onPressed: () => context.go('/booking'),
            child: const Text('Quay lại chọn lịch'),
          ),
        ),
      );
    }

    if (submission.status == BookingSubmissionStatus.restoring) {
      return Scaffold(
        appBar: AppBar(title: const Text('Thông tin bệnh nhân')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    if (submission.pending != null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Thông tin bệnh nhân')),
        body: AppEmptyState(
          icon: Icons.mark_email_unread_outlined,
          title: 'Đã có lịch chờ xác thực',
          message:
              'Lịch ${submission.pending!.bookingCode} đang được giữ. Hãy hoàn tất OTP trước khi tạo lịch khác.',
          action: FilledButton(
            onPressed: () => context.go('/booking/verify'),
            child: const Text('Tiếp tục xác thực'),
          ),
        ),
      );
    }

    final isSubmitting =
        submission.status == BookingSubmissionStatus.submitting;
    final isBusy = isSubmitting || _isRevalidatingSlot;
    return Scaffold(
      appBar: AppBar(title: const Text('Thông tin bệnh nhân')),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
            children: [
              const BookingJourneyIndicator(currentStep: 1),
              const SizedBox(height: 20),
              _CompactSelectionCard(
                doctorName: selectedDoctor.displayName,
                departmentName: selectedDoctor.departmentName,
                packageName: selectedPackage?.name,
                packagePrice: selectedPackage?.finalPrice,
                date: selectedSlot.date,
                time:
                    '${_shortTime(selectedSlot.startTime)} – ${_shortTime(selectedSlot.endTime)}',
              ),
              const SizedBox(height: 20),
              Text(
                'Người đến khám',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 10),
              BookingPatientTypeSelector(
                selected: _patientType,
                relativeEnabled: authenticatedUser != null,
                relativeUnavailableLabel: 'Cần đăng nhập',
                onChanged: (value) => value == BookingPatientType.self
                    ? _selectSelf()
                    : _chooseDependent(),
                onUnavailableRelativeTap: _showRelativeLoginNotice,
              ),
              if (_selectedDependent != null) ...[
                const SizedBox(height: 10),
                Card(
                  margin: EdgeInsets.zero,
                  color: Theme.of(context).colorScheme.primaryContainer,
                  child: ListTile(
                    leading: const Icon(Icons.family_restroom_outlined),
                    title: Text(_selectedDependent!.fullName),
                    subtitle: Text(_selectedDependent!.relationship.label),
                    trailing: TextButton(
                      onPressed: isBusy ? null : _chooseDependent,
                      child: const Text('Đổi'),
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'Thông tin liên hệ',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                  ),
                  if (profileState.isInitialLoading)
                    const SizedBox.square(
                      dimension: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  else if (_profilePrefillApplied)
                    Chip(
                      avatar: const Icon(
                        Icons.verified_user_outlined,
                        size: 16,
                      ),
                      label: Text(
                        _patientType == BookingPatientType.relative
                            ? 'Hồ sơ người thân'
                            : 'Hồ sơ có sẵn',
                      ),
                      visualDensity: VisualDensity.compact,
                    ),
                ],
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _nameController,
                readOnly: _patientType == BookingPatientType.relative,
                textInputAction: TextInputAction.next,
                autofillHints: const [AutofillHints.name],
                decoration: const InputDecoration(
                  labelText: 'Họ và tên *',
                  prefixIcon: Icon(Icons.person_outline_rounded),
                ),
                validator: (value) => (value?.trim().length ?? 0) < 2
                    ? 'Họ tên tối thiểu 2 ký tự.'
                    : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _phoneController,
                readOnly: _patientType == BookingPatientType.relative,
                keyboardType: TextInputType.phone,
                textInputAction: TextInputAction.next,
                autofillHints: const [AutofillHints.telephoneNumber],
                decoration: const InputDecoration(
                  labelText: 'Số điện thoại *',
                  prefixIcon: Icon(Icons.phone_outlined),
                ),
                validator: (value) =>
                    RegExp(
                      r'^(0|\+84)[0-9]{9,10}$',
                    ).hasMatch(value?.trim() ?? '')
                    ? null
                    : 'Số điện thoại không hợp lệ.',
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _emailController,
                readOnly: _patientType == BookingPatientType.relative,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.next,
                autofillHints: const [AutofillHints.email],
                decoration: InputDecoration(
                  labelText: _otpChannel == BookingOtpChannel.email
                      ? 'Email *'
                      : 'Email (không bắt buộc)',
                  prefixIcon: const Icon(Icons.email_outlined),
                ),
                validator: (value) {
                  final email = value?.trim() ?? '';
                  if (_otpChannel == BookingOtpChannel.email && email.isEmpty) {
                    return 'Email là bắt buộc khi nhận OTP qua email.';
                  }
                  if (email.isNotEmpty &&
                      !RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(email)) {
                    return 'Email không hợp lệ.';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 18),
              Text(
                'Nhận mã xác thực qua',
                style: Theme.of(context).textTheme.labelLarge,
              ),
              const SizedBox(height: 8),
              SegmentedButton<BookingOtpChannel>(
                segments: const [
                  ButtonSegment(
                    value: BookingOtpChannel.sms,
                    icon: Icon(Icons.sms_outlined),
                    label: Text('SMS'),
                  ),
                  ButtonSegment(
                    value: BookingOtpChannel.email,
                    icon: Icon(Icons.email_outlined),
                    label: Text('Email'),
                  ),
                ],
                selected: {_otpChannel},
                onSelectionChanged: isSubmitting
                    ? null
                    : (value) => setState(() => _otpChannel = value.first),
              ),
              const SizedBox(height: 20),
              TextFormField(
                controller: _reasonController,
                minLines: 2,
                maxLines: 4,
                decoration: const InputDecoration(
                  labelText: 'Lý do khám (không bắt buộc)',
                  alignLabelWithHint: true,
                  prefixIcon: Icon(Icons.notes_rounded),
                ),
              ),
              const SizedBox(height: 18),
              Card(
                clipBehavior: Clip.antiAlias,
                child: ExpansionTile(
                  leading: const Icon(Icons.badge_outlined),
                  title: const Text('Thông tin bổ sung'),
                  subtitle: const Text('BHYT và thông tin tiếp nhận'),
                  childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                  children: [
                    DropdownButtonFormField<String>(
                      initialValue: _gender,
                      decoration: const InputDecoration(labelText: 'Giới tính'),
                      items: const [
                        DropdownMenuItem(value: 'MALE', child: Text('Nam')),
                        DropdownMenuItem(value: 'FEMALE', child: Text('Nữ')),
                        DropdownMenuItem(value: 'OTHER', child: Text('Khác')),
                      ],
                      onChanged: _patientType == BookingPatientType.relative
                          ? null
                          : (value) => setState(() {
                              _genderEdited = true;
                              _gender = value;
                            }),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _dateOfBirthController,
                      readOnly: true,
                      decoration: const InputDecoration(
                        labelText: 'Ngày sinh',
                        prefixIcon: Icon(Icons.cake_outlined),
                      ),
                      onTap: _patientType == BookingPatientType.relative
                          ? null
                          : _pickDateOfBirth,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _cccdController,
                      readOnly: _patientType == BookingPatientType.relative,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'CCCD',
                        prefixIcon: Icon(Icons.credit_card_outlined),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _addressController,
                      readOnly: _patientType == BookingPatientType.relative,
                      decoration: const InputDecoration(
                        labelText: 'Địa chỉ',
                        prefixIcon: Icon(Icons.location_on_outlined),
                      ),
                    ),
                    const SizedBox(height: 8),
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      value: _hasBhyt,
                      title: const Text('Có thẻ BHYT'),
                      onChanged: _patientType == BookingPatientType.relative
                          ? null
                          : (value) => setState(() {
                              _bhytEdited = true;
                              _hasBhyt = value;
                            }),
                    ),
                    if (_hasBhyt) ...[
                      TextFormField(
                        controller: _insuranceCodeController,
                        readOnly: _patientType == BookingPatientType.relative,
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
                        controller: _registeredHospitalController,
                        readOnly: _patientType == BookingPatientType.relative,
                        decoration: const InputDecoration(
                          labelText: 'Nơi đăng ký khám ban đầu',
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              if (submission.error != null) ...[
                const SizedBox(height: 16),
                AppErrorBanner(
                  error: submission.error!,
                  onDismiss: ref
                      .read(bookingSubmissionControllerProvider.notifier)
                      .dismissError,
                ),
                if (submission.error!.kind == ApiErrorKind.conflict) ...[
                  const SizedBox(height: 8),
                  TextButton.icon(
                    onPressed: () async {
                      await ref
                          .read(bookingFlowControllerProvider.notifier)
                          .refreshSlots();
                      if (context.mounted) context.go('/booking');
                    },
                    icon: const Icon(Icons.schedule_rounded),
                    label: const Text('Chọn lại khung giờ'),
                  ),
                ],
              ],
              const SizedBox(height: 22),
              FilledButton.icon(
                onPressed: isBusy ? null : _submit,
                icon: isBusy
                    ? const SizedBox.square(
                        dimension: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.lock_clock_outlined),
                label: Text(
                  _isRevalidatingSlot
                      ? 'Đang kiểm tra khung giờ…'
                      : isSubmitting
                      ? 'Đang giữ lịch…'
                      : 'Giữ lịch và gửi OTP',
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Khung giờ chỉ được giữ tạm thời cho đến khi bạn xác thực OTP.',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _pickDateOfBirth() async {
    final now = DateTime.now();
    final selected = await showDatePicker(
      context: context,
      firstDate: DateTime(1900),
      lastDate: DateTime(
        now.year,
        now.month,
        now.day,
      ).subtract(const Duration(days: 1)),
      initialDate: DateTime(now.year - 25, now.month, now.day),
      helpText: 'Chọn ngày sinh',
    );
    if (selected != null) {
      _dateOfBirthController.text = _formatApiDate(selected);
    }
  }

  void _applyPrefill(BookingPatientPrefill prefill) {
    if (!mounted) return;
    var stateChanged = false;
    _applyingPrefill = true;
    try {
      _setPrefillText(_BookingPatientField.fullName, prefill.fullName);
      _setPrefillText(_BookingPatientField.phone, prefill.phone);
      _setPrefillText(_BookingPatientField.email, prefill.email);
      _setPrefillText(_BookingPatientField.dateOfBirth, prefill.dateOfBirth);
      _setPrefillText(_BookingPatientField.cccd, prefill.cccd);
      _setPrefillText(_BookingPatientField.address, prefill.address);
      _setPrefillText(
        _BookingPatientField.healthInsuranceCode,
        prefill.healthInsuranceCode,
      );
      _setPrefillText(
        _BookingPatientField.registeredHospital,
        prefill.registeredHospital,
      );
      if (!_genderEdited &&
          prefill.gender != null &&
          _gender != prefill.gender) {
        _gender = prefill.gender;
        stateChanged = true;
      }
      if (!_bhytEdited && _hasBhyt != prefill.hasBhyt) {
        _hasBhyt = prefill.hasBhyt;
        stateChanged = true;
      }
      if (prefill.fromProfile && !_profilePrefillApplied) {
        _profilePrefillApplied = true;
        stateChanged = true;
      }
    } finally {
      _applyingPrefill = false;
    }
    if (stateChanged) setState(() {});
  }

  void _setPrefillText(_BookingPatientField field, String? value) {
    if (value == null || _editedFields.contains(field)) return;
    final controller = _prefillControllers[field]!;
    if (controller.text != value) controller.text = value;
  }

  void _selectSelf() {
    if (_patientType == BookingPatientType.self) return;
    _clearPatientSnapshot();
    _patientType = BookingPatientType.self;
    _selectedDependent = null;
    _genderEdited = false;
    _bhytEdited = false;
    _profilePrefillApplied = false;
    _editedFields.clear();
    _applyPrefill(
      BookingPatientPrefill.from(
        user: ref.read(authControllerProvider).user,
        profile: ref.read(patientProfileControllerProvider).profile,
      ),
    );
    setState(() {});
  }

  Future<void> _chooseDependent() async {
    final controller = ref.read(dependentProfilesControllerProvider.notifier);
    await controller.load();
    if (!mounted) return;
    var items = ref.read(dependentProfilesControllerProvider).items;

    if (items.isEmpty) {
      final create = await showDialog<bool>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          icon: const Icon(Icons.group_add_outlined),
          title: const Text('Chưa có hồ sơ người thân'),
          content: const Text(
            'Hãy tạo hồ sơ trước để hệ thống liên kết đúng lịch khám và dữ liệu y tế.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('Để sau'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(dialogContext, true),
              child: const Text('Thêm hồ sơ'),
            ),
          ],
        ),
      );
      if (create != true || !mounted) return;
      final created = await context.push<bool>('/dependents/new');
      if (!mounted || created != true) return;
      items = ref.read(dependentProfilesControllerProvider).items;
      if (items.isEmpty) return;
    }

    final selected = await showModalBottomSheet<DependentProfile>(
      context: context,
      showDragHandle: true,
      useSafeArea: true,
      builder: (sheetContext) => ListView(
        shrinkWrap: true,
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
        children: [
          Text(
            'Chọn người đến khám',
            style: Theme.of(
              sheetContext,
            ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          for (final dependent in items)
            ListTile(
              leading: const CircleAvatar(
                child: Icon(Icons.person_outline_rounded),
              ),
              title: Text(dependent.fullName),
              subtitle: Text(dependent.relationship.label),
              trailing: dependent.id == _selectedDependent?.id
                  ? const Icon(Icons.check_circle_rounded)
                  : const Icon(Icons.chevron_right_rounded),
              onTap: () => Navigator.pop(sheetContext, dependent),
            ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.manage_accounts_outlined),
            title: const Text('Quản lý hồ sơ người thân'),
            trailing: const Icon(Icons.open_in_new_rounded),
            onTap: () {
              Navigator.pop(sheetContext);
              context.push('/dependents');
            },
          ),
        ],
      ),
    );
    if (selected == null || !mounted) return;
    _applyDependent(selected);
  }

  void _applyDependent(DependentProfile dependent) {
    final ownerPrefill = BookingPatientPrefill.from(
      user: ref.read(authControllerProvider).user,
      profile: ref.read(patientProfileControllerProvider).profile,
    );
    _applyingPrefill = true;
    try {
      _nameController.text = dependent.fullName;
      _phoneController.text = ownerPrefill.phone ?? '';
      _emailController.text = ownerPrefill.email ?? '';
      _dateOfBirthController.text = dependent.dateOfBirth ?? '';
      _cccdController.text = dependent.cccd ?? '';
      _addressController.text = dependent.address ?? '';
      _insuranceCodeController.text = dependent.healthInsuranceCode ?? '';
      _registeredHospitalController.text = dependent.registeredHospital ?? '';
    } finally {
      _applyingPrefill = false;
    }
    _editedFields.addAll(_BookingPatientField.values);
    setState(() {
      _patientType = BookingPatientType.relative;
      _selectedDependent = dependent;
      _gender = dependent.gender;
      _hasBhyt = dependent.hasBhyt;
      _genderEdited = true;
      _bhytEdited = true;
      _profilePrefillApplied = true;
    });
  }

  void _clearPatientSnapshot() {
    _applyingPrefill = true;
    try {
      for (final controller in _prefillControllers.values) {
        controller.clear();
      }
    } finally {
      _applyingPrefill = false;
    }
    _gender = null;
    _hasBhyt = false;
  }

  Future<void> _showRelativeLoginNotice() => showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    useSafeArea: true,
    builder: (sheetContext) => Padding(
      padding: const EdgeInsets.fromLTRB(24, 4, 24, 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          CircleAvatar(
            radius: 26,
            backgroundColor: Theme.of(
              sheetContext,
            ).colorScheme.primaryContainer,
            child: Icon(
              Icons.group_outlined,
              color: Theme.of(sheetContext).colorScheme.primary,
            ),
          ),
          const SizedBox(height: 14),
          Text(
            'Đặt lịch cho người thân',
            style: Theme.of(
              sheetContext,
            ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          Text(
            'Đăng nhập giúp hệ thống xác nhận bạn là người quản lý hồ sơ, nhận OTP và xem lịch hoặc kết quả khám của người thân.',
            textAlign: TextAlign.center,
            style: Theme.of(sheetContext).textTheme.bodyMedium?.copyWith(
              color: Theme.of(sheetContext).colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: () {
                Navigator.of(sheetContext).pop();
                context.push('/login?from=%2Fbooking%2Fpatient');
              },
              child: const Text('Đăng nhập để tiếp tục'),
            ),
          ),
        ],
      ),
    ),
  );

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    FocusScope.of(context).unfocus();
    setState(() => _isRevalidatingSlot = true);
    final slotValidation = await ref
        .read(bookingFlowControllerProvider.notifier)
        .revalidateSelectedSlot();
    if (!mounted) return;
    setState(() => _isRevalidatingSlot = false);

    if (slotValidation == SelectedSlotValidation.failed) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Chưa thể kiểm tra khung giờ. Vui lòng kiểm tra mạng và thử lại.',
          ),
        ),
      );
      return;
    }
    if (slotValidation == SelectedSlotValidation.unavailable) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Khung giờ vừa chọn không còn khả dụng. Vui lòng chọn giờ khác.',
          ),
        ),
      );
      context.go('/booking');
      return;
    }

    final selection = ref.read(bookingFlowControllerProvider).selection;
    await ref
        .read(bookingSubmissionControllerProvider.notifier)
        .submit(
          selection: selection,
          patient: BookingPatientDraft(
            dependentProfileId: _selectedDependent?.id,
            patientName: _nameController.text,
            patientPhone: _phoneController.text,
            patientEmail: _emailController.text,
            otpChannel: _otpChannel,
            reason: _reasonController.text,
            gender: _gender,
            dateOfBirth: _dateOfBirthController.text,
            cccd: _cccdController.text,
            address: _addressController.text,
            hasBhyt: _hasBhyt,
            healthInsuranceCode: _insuranceCodeController.text,
            registeredHospital: _registeredHospitalController.text,
          ),
        );
  }
}

class _CompactSelectionCard extends StatelessWidget {
  const _CompactSelectionCard({
    required this.doctorName,
    required this.departmentName,
    required this.date,
    required this.time,
    this.packageName,
    this.packagePrice,
  });

  final String doctorName;
  final String departmentName;
  final String? packageName;
  final double? packagePrice;
  final String date;
  final String time;

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          const CircleAvatar(child: Icon(Icons.event_available_outlined)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (packageName != null) ...[
                  Text(
                    packageName!,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      color: Theme.of(context).colorScheme.primary,
                    ),
                  ),
                  if (packagePrice != null)
                    Text(
                      formatVnd(packagePrice!),
                      style: Theme.of(context).textTheme.labelMedium,
                    ),
                  const SizedBox(height: 5),
                ],
                Text(doctorName, style: Theme.of(context).textTheme.titleSmall),
                const SizedBox(height: 3),
                Text('$departmentName · ${_displayDate(date)} · $time'),
              ],
            ),
          ),
          IconButton(
            onPressed: () => context.go('/booking'),
            tooltip: 'Đổi lịch',
            icon: const Icon(Icons.edit_calendar_outlined),
          ),
        ],
      ),
    ),
  );
}

String _shortTime(String value) =>
    value.length >= 5 ? value.substring(0, 5) : value;

String _displayDate(String value) {
  final parts = value.split('-');
  return parts.length == 3 ? '${parts[2]}/${parts[1]}/${parts[0]}' : value;
}

String _formatApiDate(DateTime date) =>
    '${date.year.toString().padLeft(4, '0')}-'
    '${date.month.toString().padLeft(2, '0')}-'
    '${date.day.toString().padLeft(2, '0')}';
