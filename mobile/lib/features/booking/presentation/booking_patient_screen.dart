import 'package:hospital_booking_mobile/features/booking/presentation/booking_patient_form_model.dart';
import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/core/widgets/birth_date_picker.dart';
import 'package:hospital_booking_mobile/features/legal/legal.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/booking/application/booking_flow_controller.dart';
import 'package:hospital_booking_mobile/features/booking/application/booking_patient_prefill.dart';
import 'package:hospital_booking_mobile/features/booking/application/booking_submission_controller.dart';
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

class BookingPatientScreen extends ConsumerStatefulWidget {
  const BookingPatientScreen({super.key});

  @override
  ConsumerState<BookingPatientScreen> createState() =>
      _BookingPatientScreenState();
}

class _BookingPatientScreenState extends ConsumerState<BookingPatientScreen> {
  final _formKey = GlobalKey<FormState>();
  final _form = BookingPatientFormModel();
  bool _termsAccepted = false;
  bool _prefilled = false;
  bool _isRevalidatingSlot = false;
  BookingPatientType _patientType = BookingPatientType.self;
  DependentProfile? _selectedDependent;

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
    _form.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Đã đăng nhập và đặt cho chính mình: máy chủ không đòi OTP đặt lịch.
    final skipsOtp = !bookingNeedsOtp(
      authenticated: ref.watch(authControllerProvider).isAuthenticated,
      forRelative: _patientType == BookingPatientType.relative,
    );
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
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.lg,
              AppSpacing.xs,
              AppSpacing.lg,
              AppSpacing.xxl,
            ),
            children: [
              BookingJourneyIndicator(
                currentStep: 1,
                finalStepLabel: skipsOtp ? 'Hoàn tất' : 'Xác thực',
              ),
              const SizedBox(height: AppSpacing.lg),
              BookingCompactSelectionCard(
                doctorName: selectedDoctor.displayName,
                departmentName: selectedDoctor.departmentName,
                packageName: selectedPackage?.name,
                packagePrice: selectedPackage?.finalPrice,
                date: selectedSlot.date,
                time:
                    '${formatTimeShort(selectedSlot.startTime)} – ${formatTimeShort(selectedSlot.endTime)}',
              ),
              const SizedBox(height: AppSpacing.lg),
              Text(
                'Người đến khám',
                style: Theme.of(context).textTheme.titleSmall,
              ),
              const SizedBox(height: AppSpacing.sm),
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
                const SizedBox(height: AppSpacing.sm),
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
              const SizedBox(height: AppSpacing.lg),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'Thông tin liên hệ',
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                  ),
                  if (profileState.isInitialLoading)
                    const SizedBox.square(
                      dimension: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  else if (_form.profilePrefillApplied)
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
              const SizedBox(height: AppSpacing.sm),
              BookingPatientContactFields(
                name: _form.name,
                phone: _form.phone,
                email: _form.email,
                isRelative: _patientType == BookingPatientType.relative,
                isSubmitting: isSubmitting,
                skipsOtp: skipsOtp,
                accountPhone:
                    profileState.profile?.phone ?? authenticatedUser?.phone,
              ),
              const SizedBox(height: AppSpacing.lg),
              TextFormField(
                controller: _form.reason,
                minLines: 2,
                maxLines: 4,
                decoration: const InputDecoration(
                  labelText: 'Lý do khám (không bắt buộc)',
                  alignLabelWithHint: true,
                  prefixIcon: Icon(Icons.notes_outlined),
                ),
              ),
              const SizedBox(height: AppSpacing.xs),
              BookingReasonChips(controller: _form.reason),
              const SizedBox(height: AppSpacing.lg),
              BookingPatientExtraSection(
                isRelative: _patientType == BookingPatientType.relative,
                gender: _form.gender,
                onGenderChanged: _patientType == BookingPatientType.relative
                    ? null
                    : (value) => setState(() {
                        _form.genderEdited = true;
                        _form.gender = value;
                      }),
                dateOfBirth: _form.dateOfBirth,
                onPickDateOfBirth: _pickDateOfBirth,
                cccd: _form.cccd,
                address: _form.address,
                hasBhyt: _form.hasBhyt,
                onHasBhytChanged: _patientType == BookingPatientType.relative
                    ? null
                    : (value) => setState(() {
                        _form.bhytEdited = true;
                        _form.hasBhyt = value;
                      }),
                insuranceCode: _form.insuranceCode,
                registeredHospital: _form.registeredHospital,
              ),
            ],
          ),
        ),
      ),
      bottomNavigationBar: Material(
        color: Theme.of(context).colorScheme.surface,
        elevation: 8,
        child: SafeArea(
          top: false,
          minimum: const EdgeInsets.fromLTRB(
            AppSpacing.lg,
            AppSpacing.sm,
            AppSpacing.lg,
            AppSpacing.sm,
          ),
          child: ConstrainedBox(
            constraints: BoxConstraints(
              maxHeight: MediaQuery.sizeOf(context).height * 0.4,
            ),
            child: SingleChildScrollView(
              child: BookingPatientSubmitSection(
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
                termsConsent: skipsOtp
                    ? null
                    : TermsConsentTile(
                        value: _termsAccepted,
                        onChanged: (value) =>
                            setState(() => _termsAccepted = value),
                      ),
                priceLabel: selectedPackage == null
                    ? 'Chi phí dự kiến'
                    : 'Giá gói',
                price: formatVnd(
                  selectedPackage?.finalPrice ?? selectedDoctor.consultationFee,
                ),
              ),
            ),
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
    final selected = await showBirthDatePicker(
      context,
      initial: DateTime.tryParse(_form.dateOfBirth.text),
    );
    if (selected != null) {
      _form.dateOfBirth.text = formatApiDate(selected);
    }
  }

  void _applyPrefill(BookingPatientPrefill prefill) {
    if (!mounted) return;
    if (_form.applyPrefill(prefill)) setState(() {});
  }

  void _selectSelf() {
    if (_patientType == BookingPatientType.self) return;
    _form.resetForSelf();
    _patientType = BookingPatientType.self;
    _selectedDependent = null;
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
    _form.applyDependent(
      dependent,
      BookingPatientPrefill.from(
        user: ref.read(authControllerProvider).user,
        profile: ref.read(patientProfileControllerProvider).profile,
      ),
    );
    setState(() {
      _patientType = BookingPatientType.relative;
      _selectedDependent = dependent;
    });
  }

  Future<void> _showRelativeLoginNotice() => showRelativeLoginNotice(context);

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    FocusScope.of(context).unfocus();
    // Đặt lịch có bước OTP (khách, hoặc người đã đăng nhập đặt cho người thân) phải đồng ý điều khoản nếu cơ sở khám đã soạn.
    final authenticated = ref.read(authControllerProvider).isAuthenticated;
    final needsOtp = bookingNeedsOtp(
      authenticated: authenticated,
      forRelative: _patientType == BookingPatientType.relative,
    );
    final terms = requiredTerms(ref, authenticated: !needsOtp);
    if (terms != null && !_termsAccepted) return showTermsRequired(context);
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
          authenticated: authenticated,
          termsVersion: terms?.version,
          patient: _form.toDraft(dependentProfileId: _selectedDependent?.id),
        );
    if (!mounted) return;
    final code = ref.read(bookingSubmissionControllerProvider).error?.code;
    if (refreshIfTermsOutdated(ref, code)) {
      setState(() => _termsAccepted = false);
    }
  }
}
