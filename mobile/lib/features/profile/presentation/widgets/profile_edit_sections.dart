import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/design/app_design_tokens.dart';
import 'package:hospital_booking_mobile/core/widgets/app_form.dart';
import 'package:hospital_booking_mobile/features/profile/domain/patient_profile.dart';
import 'package:hospital_booking_mobile/features/profile/presentation/widgets/profile_edit_fields.dart';

/// Hai nhóm luôn mở của form hồ sơ: thông tin cơ bản (tên, ngày sinh, giới tính) và liên hệ (email khóa, số điện thoại).
class ProfileBasicsSection extends StatelessWidget {
  const ProfileBasicsSection({
    super.key,
    required this.fullName,
    required this.phone,
    required this.email,
    required this.dateOfBirth,
    required this.onSelectDateOfBirth,
    required this.onClearDateOfBirth,
    required this.gender,
    required this.onGenderChanged,
  });

  final TextEditingController fullName;
  final TextEditingController phone;

  /// Email đăng nhập, đã xác thực bằng OTP; không đổi được ở đây.
  final String email;
  final String? dateOfBirth;
  final VoidCallback onSelectDateOfBirth;
  final VoidCallback onClearDateOfBirth;
  final PatientGender? gender;
  final ValueChanged<PatientGender?>? onGenderChanged;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      const AppFormGroupTitle('Thông tin cơ bản'),
      TextFormField(
        controller: fullName,
        textInputAction: TextInputAction.next,
        textCapitalization: TextCapitalization.words,
        maxLength: 120,
        buildCounter: nearLimitCounter,
        decoration: const InputDecoration(labelText: 'Họ và tên *'),
        validator: (value) {
          final length = value?.trim().length ?? 0;
          if (length < 2) {
            return 'Họ và tên phải có ít nhất 2 ký tự.';
          }
          return null;
        },
      ),
      const SizedBox(height: AppSpacing.sm),
      ProfileDateField(
        value: dateOfBirth,
        onSelect: onSelectDateOfBirth,
        onClear: onClearDateOfBirth,
      ),
      const SizedBox(height: AppSpacing.sm),
      AppSegmentedChoice<PatientGender>(
        label: 'Giới tính',
        items: PatientGender.values,
        selected: gender,
        labelOf: (item) => item.label,
        onChanged: onGenderChanged,
      ),
      const AppFormGroupTitle('Liên hệ'),
      TextFormField(
        initialValue: email,
        enabled: false,
        decoration: InputDecoration(
          labelText: 'Email đăng nhập',
          helperText: 'Đã xác thực bằng OTP, không đổi được ở đây.',
          suffixIcon: Icon(
            Icons.verified_user_outlined,
            color: context.colors.success,
          ),
        ),
      ),
      const SizedBox(height: AppSpacing.sm),
      TextFormField(
        controller: phone,
        keyboardType: TextInputType.phone,
        textInputAction: TextInputAction.next,
        maxLength: 12,
        buildCounter: nearLimitCounter,
        decoration: const InputDecoration(
          labelText: 'Số điện thoại liên hệ',
          helperText: 'Cơ sở khám dùng để liên hệ khi cần.',
        ),
        validator: (value) {
          final text = value?.trim() ?? '';
          if (text.isEmpty) return null;
          if (!RegExp(r'^(0|\+84)[0-9]{9,10}$').hasMatch(text)) {
            return 'Số điện thoại không đúng định dạng.';
          }
          return null;
        },
      ),
    ],
  );
}

/// CCCD và địa chỉ (nằm trong dòng thu gọn "CCCD và địa chỉ").
class ProfileIdentitySection extends StatelessWidget {
  const ProfileIdentitySection({
    super.key,
    required this.cccd,
    required this.address,
  });

  final TextEditingController cccd;
  final TextEditingController address;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      TextFormField(
        controller: cccd,
        keyboardType: TextInputType.number,
        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        maxLength: 20,
        buildCounter: nearLimitCounter,
        textInputAction: TextInputAction.next,
        decoration: const InputDecoration(labelText: 'CCCD'),
        validator: (value) {
          final length = value?.trim().length ?? 0;
          if (length != 0 && length < 9) {
            return 'CCCD phải có từ 9 đến 20 chữ số.';
          }
          return null;
        },
      ),
      const SizedBox(height: AppSpacing.sm),
      TextFormField(
        controller: address,
        textCapitalization: TextCapitalization.sentences,
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
  );
}

/// Ô mã thẻ BHYT và nơi đăng ký; hiện khi công tắc "Có thẻ BHYT" bật. Tắt công tắc thì hai giá trị bị xóa khi lưu.
class ProfileInsuranceFields extends StatelessWidget {
  const ProfileInsuranceFields({
    super.key,
    required this.healthInsuranceCode,
    required this.registeredHospital,
  });

  final TextEditingController healthInsuranceCode;
  final TextEditingController registeredHospital;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      TextFormField(
        controller: healthInsuranceCode,
        maxLength: 50,
        buildCounter: nearLimitCounter,
        textCapitalization: TextCapitalization.characters,
        decoration: const InputDecoration(labelText: 'Mã thẻ BHYT'),
      ),
      const SizedBox(height: AppSpacing.sm),
      TextFormField(
        controller: registeredHospital,
        maxLength: 200,
        buildCounter: nearLimitCounter,
        textCapitalization: TextCapitalization.sentences,
        decoration: const InputDecoration(
          labelText: 'Nơi đăng ký khám ban đầu',
          helperText: 'Tắt công tắc BHYT sẽ xóa mã thẻ và nơi đăng ký đã lưu.',
        ),
      ),
    ],
  );
}

/// Nhóm thông tin sức khỏe (kèm ô đồng ý lưu khi có nội dung nhạy cảm mới) của form chỉnh sửa hồ sơ.
class ProfileHealthSection extends StatelessWidget {
  const ProfileHealthSection({
    super.key,
    required this.bloodType,
    required this.height,
    required this.weight,
    required this.bloodPressure,
    required this.allergies,
    required this.medicalHistory,
    required this.familyHistory,
    required this.askConsent,
    required this.healthConsent,
    required this.onHealthConsentChanged,
    required this.isSaving,
  });

  final TextEditingController bloodType;
  final TextEditingController height;
  final TextEditingController weight;
  final TextEditingController bloodPressure;
  final TextEditingController allergies;
  final TextEditingController medicalHistory;
  final TextEditingController familyHistory;

  /// Có nội dung sức khỏe và chưa từng đồng ý: hiện ô đồng ý lưu.
  final bool askConsent;
  final bool healthConsent;
  final ValueChanged<bool?>? onHealthConsentChanged;
  final bool isSaving;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Text(
        'Chỉ nhập điều bạn biết chính xác; không thay thế chẩn đoán của bác sĩ.',
        style: Theme.of(
          context,
        ).textTheme.bodySmall?.copyWith(color: context.colors.muted),
      ),
      const SizedBox(height: AppSpacing.sm),
      TextFormField(
        controller: bloodType,
        maxLength: 10,
        buildCounter: nearLimitCounter,
        textCapitalization: TextCapitalization.characters,
        decoration: const InputDecoration(
          labelText: 'Nhóm máu',
          hintText: 'Ví dụ: O+',
        ),
      ),
      const SizedBox(height: AppSpacing.sm),
      Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: ProfileDecimalField(
              controller: height,
              label: 'Chiều cao (cm)',
              max: 300,
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: ProfileDecimalField(
              controller: weight,
              label: 'Cân nặng (kg)',
              max: 500,
            ),
          ),
        ],
      ),
      const SizedBox(height: AppSpacing.sm),
      TextFormField(
        controller: bloodPressure,
        maxLength: 40,
        buildCounter: nearLimitCounter,
        decoration: const InputDecoration(
          labelText: 'Huyết áp',
          hintText: 'Ví dụ: 120/80 mmHg',
        ),
      ),
      const SizedBox(height: AppSpacing.sm),
      ProfileLongTextField(
        controller: allergies,
        label: 'Dị ứng',
        maxLength: 2000,
      ),
      const SizedBox(height: AppSpacing.sm),
      ProfileLongTextField(
        controller: medicalHistory,
        label: 'Tiền sử sức khỏe',
        maxLength: 5000,
      ),
      const SizedBox(height: AppSpacing.sm),
      ProfileLongTextField(
        controller: familyHistory,
        label: 'Tiền sử gia đình',
        maxLength: 5000,
      ),
      if (askConsent) ...[
        const SizedBox(height: AppSpacing.sm),
        CheckboxListTile(
          key: const ValueKey('health-consent-checkbox'),
          contentPadding: const EdgeInsets.symmetric(horizontal: 4),
          value: healthConsent,
          onChanged: isSaving ? null : onHealthConsentChanged,
          title: const Text('Đồng ý lưu thông tin sức khỏe'),
          subtitle: const Text(
            'Tôi đồng ý cho cơ sở khám lưu dị ứng, tiền sử sức khỏe và '
            'tiền sử gia đình để phục vụ việc khám. '
            'Tôi có thể xóa các nội dung này bất cứ lúc nào.',
          ),
          controlAffinity: ListTileControlAffinity.leading,
        ),
      ],
    ],
  );
}
