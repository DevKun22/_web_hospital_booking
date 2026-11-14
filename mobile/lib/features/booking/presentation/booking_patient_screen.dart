import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/booking/application/booking_flow_controller.dart';
import 'package:hospital_booking_mobile/features/booking/application/otp_channels_provider.dart';
import 'package:hospital_booking_mobile/features/booking/application/booking_patient_prefill.dart';
import 'package:hospital_booking_mobile/features/booking/application/booking_submission_controller.dart';
import 'package:hospital_booking_mobile/features/booking/domain/booking_submission.dart';
import 'package:hospital_booking_mobile/features/booking/presentation/booking_date_format.dart';
import 'package:hospital_booking_mobile/features/booking/presentation/widgets/booking_patient_type_selector.dart';
import 'package:hospital_booking_mobile/features/booking/presentation/widgets/booking_journey_indicator.dart';
import 'package:hospital_booking_mobile/features/dependents/application/dependent_profiles_controller.dart';
import 'package:hospital_booking_mobile/features/dependents/domain/dependent_profile.dart';
import 'package:hospital_booking_mobile/features/profile/application/patient_profile_controller.dart';
import 'package:hospital_booking_mobile/features/profile/domain/patient_profile.dart';
import 'package:hospital_booking_mobile/features/booking/presentation/widgets/booking_patient_dialogs.dart';

import 'package:hospital_booking_mobile/features/booking/presentation/widgets/booking_patient_sections.dart';
import 'package:hospital_booking_mobile/features/booking/presentation/widgets/booking_compact_selection_card.dart';

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
  BookingOtpChannel _otpChannel = BookingOtpChannel.email;
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

  /// Kênh thực gửi: nếu kênh đang chọn không còn được hỗ trợ thì dùng kênh đầu tiên.
  BookingOtpChannel _effectiveOtpChannel() {
    final available =
        ref.read(otpChannelsProvider).value ?? const [BookingOtpChannel.email];
    return available.contains(_otpChannel) ? _otpChannel : available.first;
  }

  @override
  Widget build(BuildContext context) {
    final availableOtpChannels =
        ref.watch(otpChannelsProvider).value ?? const [BookingOtpChannel.email];
    // Đã đăng nhập và đặt cho chính mình: máy chủ không đòi OTP đặt lịch.
    final skipsOtp =
        ref.watch(authControllerProvider).isAuthenticated &&
        _patientType != BookingPatientType.relative;
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
        } else if (next == BookingSubmissionStatus.success &&
            previous != BookingSubmissionStatus.success) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) context.go('/booking/success');
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
        appBar: AppBar(title: const Text('Thông tin người khám')),
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
        appBar: AppBar(title: const Text('Thông tin người khám')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    if (submission.pending != null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Thông tin người khám')),
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
      appBar: AppBar(title: const Text('Thông tin người khám')),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
            children: [
              const BookingJourneyIndicator(currentStep: 1),
              const SizedBox(height: 20),
              BookingCompactSelectionCard(
                doctorName: selectedDoctor.displayName,
                departmentName: selectedDoctor.departmentName,
                packageName: selectedPackage?.name,
                packagePrice: selectedPackage?.finalPrice,
                date: selectedSlot.date,
                time:
                    '${shortTime(selectedSlot.startTime)} – ${shortTime(selectedSlot.endTime)}',
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
              BookingPatientContactFields(
                name: _nameController,
                phone: _phoneController,
                email: _emailController,
                isRelative: _patientType == BookingPatientType.relative,
                otpChannel: _otpChannel,
                availableOtpChannels: availableOtpChannels,
                onOtpChannelChanged: (value) =>
                    setState(() => _otpChannel = value),
                isSubmitting: isSubmitting,
                skipsOtp: skipsOtp,
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
              BookingPatientExtraSection(
                isRelative: _patientType == BookingPatientType.relative,
                gender: _gender,
                onGenderChanged: _patientType == BookingPatientType.relative
                    ? null
                    : (value) => setState(() {
                        _genderEdited = true;
                        _gender = value;
                      }),
                dateOfBirth: _dateOfBirthController,
                onPickDateOfBirth: _pickDateOfBirth,
                cccd: _cccdController,
                address: _addressController,
                hasBhyt: _hasBhyt,
                onHasBhytChanged: _patientType == BookingPatientType.relative
                    ? null
                    : (value) => setState(() {
                        _bhytEdited = true;
                        _hasBhyt = value;
                      }),
                insuranceCode: _insuranceCodeController,
                registeredHospital: _registeredHospitalController,
              ),
              BookingPatientSubmitSection(
                error: submission.error,
                onDismissError: ref
                    .read(bookingSubmissionControllerProvider.notifier)
                    .dismissError,
                onReselectSlot: _reselectSlot,
                isBusy: isBusy,
                isSubmitting: isSubmitting,
                isRevalidatingSlot: _isRevalidatingSlot,
                onSubmit: _submit,
                skipsOtp: skipsOtp,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _reselectSlot() async {
    await ref.read(bookingFlowControllerProvider.notifier).refreshSlots();
    if (mounted) context.go('/booking');
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
      _dateOfBirthController.text = formatApiDate(selected);
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
      final create = await showNoDependentDialog(context);
      if (create != true || !mounted) return;
      final created = await context.push<bool>('/dependents/new');
      if (!mounted || created != true) return;
      items = ref.read(dependentProfilesControllerProvider).items;
      if (items.isEmpty) return;
    }

    final selected = await showDependentPicker(
      context,
      items: items,
      selectedId: _selectedDependent?.id,
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

  Future<void> _showRelativeLoginNotice() => showRelativeLoginNotice(context);

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
          authenticated: ref.read(authControllerProvider).isAuthenticated,
          patient: BookingPatientDraft(
            dependentProfileId: _selectedDependent?.id,
            patientName: _nameController.text,
            patientPhone: _phoneController.text,
            patientEmail: _emailController.text,
            otpChannel: _effectiveOtpChannel(),
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
