import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/widgets/app_error_banner.dart';
import 'package:hospital_booking_mobile/features/booking/domain/booking_submission.dart';

/// Họ tên, số điện thoại, email và kênh nhận OTP của người đến khám.
class BookingPatientContactFields extends StatelessWidget {
  const BookingPatientContactFields({
    super.key,
    required this.name,
    required this.phone,
    required this.email,
    required this.isRelative,
    required this.otpChannel,
    required this.availableOtpChannels,
    required this.onOtpChannelChanged,
    required this.isSubmitting,
  });

  final TextEditingController name;
  final TextEditingController phone;
  final TextEditingController email;

  /// Đặt cho người thân: các trường lấy từ hồ sơ người thân nên chỉ đọc.
  final bool isRelative;
  final BookingOtpChannel otpChannel;
  final List<BookingOtpChannel> availableOtpChannels;
  final ValueChanged<BookingOtpChannel> onOtpChannelChanged;
  final bool isSubmitting;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      TextFormField(
        controller: name,
        readOnly: isRelative,
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
        controller: phone,
        readOnly: isRelative,
        keyboardType: TextInputType.phone,
        textInputAction: TextInputAction.next,
        autofillHints: const [AutofillHints.telephoneNumber],
        decoration: const InputDecoration(
          labelText: 'Số điện thoại *',
          prefixIcon: Icon(Icons.phone_outlined),
        ),
        validator: (value) =>
            RegExp(r'^(0|\+84)[0-9]{9,10}$').hasMatch(value?.trim() ?? '')
            ? null
            : 'Số điện thoại không hợp lệ.',
      ),
      const SizedBox(height: 12),
      TextFormField(
        controller: email,
        readOnly: isRelative,
        keyboardType: TextInputType.emailAddress,
        textInputAction: TextInputAction.next,
        autofillHints: const [AutofillHints.email],
        decoration: InputDecoration(
          labelText: otpChannel == BookingOtpChannel.email
              ? 'Email *'
              : 'Email (không bắt buộc)',
          prefixIcon: const Icon(Icons.email_outlined),
        ),
        validator: (value) {
          final email = value?.trim() ?? '';
          if (otpChannel == BookingOtpChannel.email && email.isEmpty) {
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
      if (availableOtpChannels.length == 1)
        Row(
          children: [
            Icon(
              availableOtpChannels.first == BookingOtpChannel.sms
                  ? Icons.sms_outlined
                  : Icons.email_outlined,
              size: 18,
              color: Theme.of(context).colorScheme.primary,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                availableOtpChannels.first == BookingOtpChannel.sms
                    ? 'Mã xác thực sẽ gửi qua SMS.'
                    : 'Mã xác thực sẽ gửi qua email.',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ),
          ],
        )
      else ...[
        Text(
          'Nhận mã xác thực qua',
          style: Theme.of(context).textTheme.labelLarge,
        ),
        const SizedBox(height: 8),
        SegmentedButton<BookingOtpChannel>(
          segments: [
            for (final channel in availableOtpChannels)
              ButtonSegment(
                value: channel,
                icon: Icon(
                  channel == BookingOtpChannel.sms
                      ? Icons.sms_outlined
                      : Icons.email_outlined,
                ),
                label: Text(channel == BookingOtpChannel.sms ? 'SMS' : 'Email'),
              ),
          ],
          selected: {
            availableOtpChannels.contains(otpChannel)
                ? otpChannel
                : availableOtpChannels.first,
          },
          onSelectionChanged: isSubmitting
              ? null
              : (value) => onOtpChannelChanged(value.first),
        ),
      ],
    ],
  );
}

/// Thông tin bổ sung (giới tính, ngày sinh, CCCD, địa chỉ, BHYT) thu gọn trong một thẻ.
class BookingPatientExtraSection extends StatelessWidget {
  const BookingPatientExtraSection({
    super.key,
    required this.isRelative,
    required this.gender,
    required this.onGenderChanged,
    required this.dateOfBirth,
    required this.onPickDateOfBirth,
    required this.cccd,
    required this.address,
    required this.hasBhyt,
    required this.onHasBhytChanged,
    required this.insuranceCode,
    required this.registeredHospital,
  });

  final bool isRelative;
  final String? gender;
  final ValueChanged<String?>? onGenderChanged;
  final TextEditingController dateOfBirth;
  final VoidCallback onPickDateOfBirth;
  final TextEditingController cccd;
  final TextEditingController address;
  final bool hasBhyt;
  final ValueChanged<bool>? onHasBhytChanged;
  final TextEditingController insuranceCode;
  final TextEditingController registeredHospital;

  @override
  Widget build(BuildContext context) => Card(
    clipBehavior: Clip.antiAlias,
    child: ExpansionTile(
      leading: const Icon(Icons.badge_outlined),
      title: const Text('Thông tin bổ sung'),
      subtitle: const Text('BHYT và thông tin tiếp nhận'),
      childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      children: [
        DropdownButtonFormField<String>(
          initialValue: gender,
          decoration: const InputDecoration(labelText: 'Giới tính'),
          items: const [
            DropdownMenuItem(value: 'MALE', child: Text('Nam')),
            DropdownMenuItem(value: 'FEMALE', child: Text('Nữ')),
            DropdownMenuItem(value: 'OTHER', child: Text('Khác')),
          ],
          onChanged: isRelative ? null : onGenderChanged,
        ),
        const SizedBox(height: 12),
        TextFormField(
          controller: dateOfBirth,
          readOnly: true,
          decoration: const InputDecoration(
            labelText: 'Ngày sinh',
            prefixIcon: Icon(Icons.cake_outlined),
          ),
          onTap: isRelative ? null : onPickDateOfBirth,
        ),
        const SizedBox(height: 12),
        TextFormField(
          controller: cccd,
          readOnly: isRelative,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(
            labelText: 'CCCD',
            prefixIcon: Icon(Icons.credit_card_outlined),
          ),
        ),
        const SizedBox(height: 12),
        TextFormField(
          controller: address,
          readOnly: isRelative,
          decoration: const InputDecoration(
            labelText: 'Địa chỉ',
            prefixIcon: Icon(Icons.location_on_outlined),
          ),
        ),
        const SizedBox(height: 8),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          value: hasBhyt,
          title: const Text('Có thẻ BHYT'),
          onChanged: isRelative ? null : onHasBhytChanged,
        ),
        if (hasBhyt) ...[
          TextFormField(
            controller: insuranceCode,
            readOnly: isRelative,
            decoration: const InputDecoration(labelText: 'Mã thẻ BHYT *'),
            validator: (value) => hasBhyt && (value?.trim().isEmpty ?? true)
                ? 'Vui lòng nhập mã thẻ BHYT.'
                : null,
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: registeredHospital,
            readOnly: isRelative,
            decoration: const InputDecoration(
              labelText: 'Nơi đăng ký khám ban đầu',
            ),
          ),
        ],
      ],
    ),
  );
}

/// Lỗi gửi, nút giữ lịch và ghi chú ở cuối form đặt lịch.
class BookingPatientSubmitSection extends StatelessWidget {
  const BookingPatientSubmitSection({
    super.key,
    required this.error,
    required this.onDismissError,
    required this.onReselectSlot,
    required this.isBusy,
    required this.isSubmitting,
    required this.isRevalidatingSlot,
    required this.onSubmit,
  });

  final ApiException? error;
  final VoidCallback onDismissError;
  final VoidCallback onReselectSlot;
  final bool isBusy;
  final bool isSubmitting;
  final bool isRevalidatingSlot;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      if (error != null) ...[
        const SizedBox(height: 16),
        AppErrorBanner(error: error!, onDismiss: onDismissError),
        if (error!.kind == ApiErrorKind.conflict) ...[
          const SizedBox(height: 8),
          TextButton.icon(
            onPressed: onReselectSlot,
            icon: const Icon(Icons.schedule_rounded),
            label: const Text('Chọn lại khung giờ'),
          ),
        ],
      ],
      const SizedBox(height: 22),
      FilledButton.icon(
        onPressed: isBusy ? null : onSubmit,
        icon: isBusy
            ? const SizedBox.square(
                dimension: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : const Icon(Icons.lock_clock_outlined),
        label: Text(
          isRevalidatingSlot
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
  );
}
