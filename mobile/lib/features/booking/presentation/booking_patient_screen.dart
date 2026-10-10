import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:hospital_booking_mobile/core/widgets/app_error_banner.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/booking/application/booking_flow_controller.dart';
import 'package:hospital_booking_mobile/features/booking/application/booking_submission_controller.dart';
import 'package:hospital_booking_mobile/features/booking/domain/booking_submission.dart';

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

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_prefilled) return;
    _prefilled = true;
    final user = ref.read(authControllerProvider).user;
    if (user != null) {
      _nameController.text = user.fullName;
      _phoneController.text = user.phone ?? '';
      _emailController.text = user.email ?? '';
    }
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
    return Scaffold(
      appBar: AppBar(title: const Text('Thông tin bệnh nhân')),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
            children: [
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
                'Thông tin liên hệ',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _nameController,
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
                      onChanged: (value) => setState(() => _gender = value),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _dateOfBirthController,
                      readOnly: true,
                      decoration: const InputDecoration(
                        labelText: 'Ngày sinh',
                        prefixIcon: Icon(Icons.cake_outlined),
                      ),
                      onTap: _pickDateOfBirth,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _cccdController,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'CCCD',
                        prefixIcon: Icon(Icons.credit_card_outlined),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _addressController,
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
                      onChanged: (value) => setState(() => _hasBhyt = value),
                    ),
                    if (_hasBhyt) ...[
                      TextFormField(
                        controller: _insuranceCodeController,
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
                onPressed: isSubmitting ? null : _submit,
                icon: isSubmitting
                    ? const SizedBox.square(
                        dimension: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.lock_clock_outlined),
                label: Text(
                  isSubmitting ? 'Đang giữ lịch…' : 'Giữ lịch và gửi OTP',
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

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    FocusScope.of(context).unfocus();
    final selection = ref.read(bookingFlowControllerProvider).selection;
    await ref
        .read(bookingSubmissionControllerProvider.notifier)
        .submit(
          selection: selection,
          patient: BookingPatientDraft(
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
