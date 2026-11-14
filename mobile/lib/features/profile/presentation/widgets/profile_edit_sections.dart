import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:hospital_booking_mobile/features/profile/domain/patient_profile.dart';
import 'package:hospital_booking_mobile/features/profile/presentation/widgets/profile_edit_fields.dart';

/// Nhóm thông tin cá nhân của form chỉnh sửa hồ sơ.
class ProfilePersonalSection extends StatelessWidget {
  const ProfilePersonalSection({
    super.key,
    required this.fullName,
    required this.phone,
    required this.email,
    required this.dateOfBirth,
    required this.onSelectDateOfBirth,
    required this.onClearDateOfBirth,
    required this.gender,
    required this.onGenderChanged,
    required this.cccd,
    required this.address,
    required this.isSaving,
  });

  final TextEditingController fullName;
  final String phone;
  final TextEditingController email;
  final String? dateOfBirth;
  final VoidCallback onSelectDateOfBirth;
  final VoidCallback onClearDateOfBirth;
  final PatientGender? gender;
  final ValueChanged<PatientGender?>? onGenderChanged;
  final TextEditingController cccd;
  final TextEditingController address;
  final bool isSaving;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      const ProfileEditSectionHeader(
        icon: Icons.person_outline,
        title: 'Thông tin cá nhân',
        description: 'Số điện thoại đã xác thực không thể thay đổi tại đây.',
      ),
      const SizedBox(height: 12),
      TextFormField(
        controller: fullName,
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
        initialValue: phone,
        enabled: false,
        decoration: const InputDecoration(
          labelText: 'Số điện thoại đã xác thực',
          prefixIcon: Icon(Icons.verified_user_outlined),
        ),
      ),
      const SizedBox(height: 12),
      TextFormField(
        controller: email,
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
          if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(email)) {
            return 'Email không đúng định dạng.';
          }
          return null;
        },
      ),
      const SizedBox(height: 12),
      ProfileDateField(
        value: dateOfBirth,
        onSelect: onSelectDateOfBirth,
        onClear: onClearDateOfBirth,
      ),
      const SizedBox(height: 12),
      DropdownButtonFormField<PatientGender>(
        initialValue: gender,
        decoration: const InputDecoration(
          labelText: 'Giới tính',
          prefixIcon: Icon(Icons.wc_outlined),
        ),
        items: PatientGender.values
            .map(
              (gender) =>
                  DropdownMenuItem(value: gender, child: Text(gender.label)),
            )
            .toList(growable: false),
        onChanged: isSaving ? null : onGenderChanged,
      ),
      const SizedBox(height: 12),
      TextFormField(
        controller: cccd,
        keyboardType: TextInputType.number,
        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
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
        controller: address,
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
    ],
  );
}

/// Nhóm bảo hiểm y tế của form chỉnh sửa hồ sơ.
class ProfileInsuranceSection extends StatelessWidget {
  const ProfileInsuranceSection({
    super.key,
    required this.hasBhyt,
    required this.onHasBhytChanged,
    required this.healthInsuranceCode,
    required this.registeredHospital,
    required this.isSaving,
  });

  final bool hasBhyt;
  final ValueChanged<bool>? onHasBhytChanged;
  final TextEditingController healthInsuranceCode;
  final TextEditingController registeredHospital;
  final bool isSaving;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      const ProfileEditSectionHeader(
        icon: Icons.health_and_safety_outlined,
        title: 'Bảo hiểm y tế',
        description:
            'Thông tin này hỗ trợ cơ sở khám chuẩn bị thủ tục tiếp nhận.',
      ),
      const SizedBox(height: 10),
      Card(
        margin: EdgeInsets.zero,
        child: SwitchListTile(
          title: const Text('Tôi có sử dụng BHYT'),
          subtitle: const Text(
            'Tắt mục này sẽ xóa mã thẻ và nơi đăng ký đã lưu.',
          ),
          value: hasBhyt,
          onChanged: isSaving ? null : onHasBhytChanged,
        ),
      ),
      if (hasBhyt) ...[
        const SizedBox(height: 12),
        TextFormField(
          controller: healthInsuranceCode,
          maxLength: 50,
          textCapitalization: TextCapitalization.characters,
          decoration: const InputDecoration(
            labelText: 'Mã thẻ BHYT',
            prefixIcon: Icon(Icons.badge_outlined),
          ),
        ),
        const SizedBox(height: 12),
        TextFormField(
          controller: registeredHospital,
          maxLength: 200,
          textCapitalization: TextCapitalization.sentences,
          decoration: const InputDecoration(
            labelText: 'Nơi đăng ký KCB ban đầu',
            prefixIcon: Icon(Icons.local_hospital_outlined),
          ),
        ),
      ],
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
      const ProfileEditSectionHeader(
        icon: Icons.monitor_heart_outlined,
        title: 'Thông tin sức khỏe',
        description:
            'Chỉ nhập thông tin bạn biết chính xác; đây không thay thế chẩn đoán của bác sĩ.',
      ),
      const SizedBox(height: 12),
      TextFormField(
        controller: bloodType,
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
            child: ProfileDecimalField(
              controller: height,
              label: 'Chiều cao (cm)',
              max: 300,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: ProfileDecimalField(
              controller: weight,
              label: 'Cân nặng (kg)',
              max: 500,
            ),
          ),
        ],
      ),
      const SizedBox(height: 12),
      TextFormField(
        controller: bloodPressure,
        maxLength: 40,
        decoration: const InputDecoration(
          labelText: 'Huyết áp',
          hintText: 'Ví dụ: 120/80 mmHg',
          prefixIcon: Icon(Icons.speed_outlined),
        ),
      ),
      const SizedBox(height: 12),
      ProfileLongTextField(
        controller: allergies,
        label: 'Dị ứng',
        maxLength: 2000,
      ),
      const SizedBox(height: 12),
      ProfileLongTextField(
        controller: medicalHistory,
        label: 'Tiền sử sức khỏe',
        maxLength: 5000,
      ),
      const SizedBox(height: 12),
      ProfileLongTextField(
        controller: familyHistory,
        label: 'Tiền sử gia đình',
        maxLength: 5000,
      ),
      if (askConsent) ...[
        const SizedBox(height: 12),
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
