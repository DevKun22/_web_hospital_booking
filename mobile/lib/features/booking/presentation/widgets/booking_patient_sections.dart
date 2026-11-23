import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/core/widgets/app_form.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/design/app_design_tokens.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/widgets/app_error_banner.dart';

/// Họ tên, số điện thoại và email (nơi nhận OTP) của người đến khám.
class BookingPatientContactFields extends StatelessWidget {
  const BookingPatientContactFields({
    super.key,
    required this.name,
    required this.phone,
    required this.email,
    required this.isRelative,
    required this.isSubmitting,
    this.skipsOtp = false,
  });

  final TextEditingController name;
  final TextEditingController phone;
  final TextEditingController email;

  /// Đặt cho người thân: các trường lấy từ hồ sơ người thân nên chỉ đọc.
  final bool isRelative;
  final bool isSubmitting;

  /// Người đã đăng nhập đặt cho chính mình: không cần OTP nên không hiện dòng nhắc gửi mã.
  final bool skipsOtp;

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
          prefixIcon: Icon(Icons.person_outline_outlined),
        ),
        validator: (value) => (value?.trim().length ?? 0) < 2
            ? 'Họ tên tối thiểu 2 ký tự.'
            : null,
      ),
      const SizedBox(height: AppSpacing.sm),
      TextFormField(
        controller: phone,
        readOnly: isRelative || skipsOtp,
        keyboardType: TextInputType.phone,
        textInputAction: TextInputAction.next,
        autofillHints: const [AutofillHints.telephoneNumber],
        decoration: InputDecoration(
          labelText: 'Số điện thoại *',
          prefixIcon: const Icon(Icons.phone_outlined),
          // Người đã đăng nhập luôn đặt bằng số của tài khoản.
          helperText: skipsOtp ? 'Số điện thoại của tài khoản bạn.' : null,
          suffixIcon: skipsOtp ? const Icon(Icons.lock_outline) : null,
        ),
        validator: (value) =>
            RegExp(r'^(0|\+84)[0-9]{9,10}$').hasMatch(value?.trim() ?? '')
            ? null
            : 'Số điện thoại không hợp lệ.',
      ),
      const SizedBox(height: AppSpacing.sm),
      TextFormField(
        controller: email,
        readOnly: isRelative,
        keyboardType: TextInputType.emailAddress,
        textInputAction: TextInputAction.next,
        autofillHints: const [AutofillHints.email],
        decoration: const InputDecoration(
          labelText: 'Email *',
          prefixIcon: Icon(Icons.email_outlined),
        ),
        validator: (value) {
          final email = value?.trim() ?? '';
          if (email.isEmpty) return 'Email là bắt buộc.';
          if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(email)) {
            return 'Email không hợp lệ.';
          }
          return null;
        },
      ),
      if (!skipsOtp) ...[
        const SizedBox(height: AppSpacing.lg),
        Row(
          children: [
            Icon(
              Icons.email_outlined,
              size: 18,
              color: Theme.of(context).colorScheme.primary,
            ),
            const SizedBox(width: AppSpacing.xs),
            Expanded(
              child: Text(
                'Mã xác thực sẽ gửi qua email.',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ),
          ],
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
      childrenPadding: const EdgeInsets.fromLTRB(
        AppSpacing.md,
        AppSpacing.xs,
        AppSpacing.md,
        AppSpacing.md,
      ),
      children: [
        AppSegmentedChoice<String>(
          label: 'Giới tính',
          items: const ['MALE', 'FEMALE', 'OTHER'],
          selected: gender,
          labelOf: (value) => switch (value) {
            'MALE' => 'Nam',
            'FEMALE' => 'Nữ',
            _ => 'Khác',
          },
          onChanged: isRelative ? null : onGenderChanged,
        ),
        const SizedBox(height: AppSpacing.md),
        ValueListenableBuilder<TextEditingValue>(
          valueListenable: dateOfBirth,
          builder: (context, value, _) {
            final text = value.text.trim();
            return AppPickerField(
              label: 'Ngày sinh',
              placeholder: 'Chọn ngày sinh',
              value: text.isEmpty ? null : formatDateVi(text),
              icon: Icons.calendar_month_outlined,
              onTap: isRelative ? null : onPickDateOfBirth,
            );
          },
        ),
        const SizedBox(height: AppSpacing.md),
        TextFormField(
          controller: cccd,
          readOnly: isRelative,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(
            labelText: 'CCCD',
            prefixIcon: Icon(Icons.credit_card_outlined),
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        TextFormField(
          controller: address,
          readOnly: isRelative,
          decoration: const InputDecoration(
            labelText: 'Địa chỉ',
            prefixIcon: Icon(Icons.location_on_outlined),
          ),
        ),
        const SizedBox(height: AppSpacing.xs),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          value: hasBhyt,
          title: const Text('Có thẻ BHYT'),
          subtitle: const Text('Nhập mã thẻ để cơ sở khám chuẩn bị thủ tục.'),
          onChanged: isRelative ? null : onHasBhytChanged,
        ),
        if (hasBhyt) const SizedBox(height: AppSpacing.xs),
        if (hasBhyt) ...[
          TextFormField(
            controller: insuranceCode,
            readOnly: isRelative,
            decoration: const InputDecoration(labelText: 'Mã thẻ BHYT *'),
            validator: (value) => hasBhyt && (value?.trim().isEmpty ?? true)
                ? 'Vui lòng nhập mã thẻ BHYT.'
                : null,
          ),
          const SizedBox(height: AppSpacing.sm),
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
    required this.priceLabel,
    required this.price,
    this.skipsOtp = false,
    this.termsConsent,
  });

  /// Dòng giá cố định trên nút đặt lịch, vd. "Chi phí dự kiến".
  final String priceLabel;
  final String price;

  final ApiException? error;
  final VoidCallback onDismissError;
  final VoidCallback onReselectSlot;
  final bool isBusy;
  final bool isSubmitting;
  final bool isRevalidatingSlot;
  final VoidCallback onSubmit;

  /// Không có bước OTP: nút ghi "Đặt lịch" và ghi chú nói cơ sở khám sẽ xác nhận.
  final bool skipsOtp;

  /// Ô đồng ý điều khoản (chỉ khi có bước OTP); tự ẩn khi cơ sở khám chưa soạn điều khoản.
  final Widget? termsConsent;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final text = Theme.of(context).textTheme;
    final slotTaken = error?.kind == ApiErrorKind.conflict;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (error != null && !slotTaken) ...[
          const SizedBox(height: AppSpacing.xs),
          AppErrorBanner(error: error!, onDismiss: onDismissError),
        ],
        if (slotTaken) ...[
          const SizedBox(height: AppSpacing.xs),
          Container(
            padding: const EdgeInsets.all(AppSpacing.sm),
            decoration: BoxDecoration(
              color: colors.warningContainer,
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            child: Row(
              children: [
                Icon(Icons.event_busy_outlined, color: colors.warning),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Giờ này vừa có người đặt',
                        style: text.titleSmall?.copyWith(color: colors.warning),
                      ),
                      Text(
                        'Hãy chọn một khung giờ trống khác.',
                        style: text.bodySmall?.copyWith(color: colors.ink),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.xs),
                FilledButton.tonal(
                  onPressed: onReselectSlot,
                  child: const Text('Chọn giờ khác'),
                ),
              ],
            ),
          ),
        ],
        if (termsConsent != null) ...[
          const SizedBox(height: AppSpacing.xxs),
          termsConsent!,
        ],
        const SizedBox(height: AppSpacing.xs),
        Row(
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  priceLabel,
                  style: text.labelMedium?.copyWith(color: colors.muted),
                ),
                Text(
                  price,
                  style: text.titleMedium?.copyWith(color: colors.primaryDark),
                ),
              ],
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: FilledButton.icon(
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(
                    AppSize.primaryControlHeight,
                  ),
                ),
                onPressed: isBusy ? null : onSubmit,
                icon: isBusy
                    ? const SizedBox.square(
                        dimension: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.lock_clock_outlined),
                label: Text(
                  isRevalidatingSlot
                      ? 'Đang kiểm tra giờ…'
                      : isSubmitting
                      ? (skipsOtp ? 'Đang đặt lịch…' : 'Đang giữ lịch…')
                      : (skipsOtp ? 'Đặt lịch' : 'Giữ lịch, gửi OTP'),
                ),
              ),
            ),
          ],
        ),
        if (skipsOtp || termsConsent == null) ...[
          const SizedBox(height: AppSpacing.xs),
          Text(
            skipsOtp
                ? 'Cơ sở khám sẽ xác nhận lịch của bạn sau khi tiếp nhận.'
                : 'Khung giờ chỉ được giữ tạm thời cho đến khi bạn xác thực OTP.',
            textAlign: TextAlign.center,
            style: text.bodySmall?.copyWith(color: colors.muted),
          ),
        ],
      ],
    );
  }
}

/// Gợi ý nhanh cho ô "Lý do khám": chạm để điền hoặc nối thêm.
class BookingReasonChips extends StatelessWidget {
  const BookingReasonChips({super.key, required this.controller});

  final TextEditingController controller;

  static const suggestions = [
    'Khám tổng quát',
    'Tái khám',
    'Tư vấn sức khỏe',
    'Kiểm tra định kỳ',
  ];

  void _apply(String value) {
    final current = controller.text.trim();
    if (current.contains(value)) return;
    controller.text = current.isEmpty ? value : '$current, $value';
    controller.selection = TextSelection.collapsed(
      offset: controller.text.length,
    );
  }

  @override
  Widget build(BuildContext context) => Wrap(
    spacing: 8,
    runSpacing: 4,
    children: [
      for (final value in suggestions)
        ActionChip(
          label: Text(value),
          visualDensity: VisualDensity.compact,
          onPressed: () => _apply(value),
        ),
    ],
  );
}
