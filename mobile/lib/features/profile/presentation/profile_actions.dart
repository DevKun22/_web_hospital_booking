import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/widgets/app_edit_sheets.dart';
import 'package:hospital_booking_mobile/core/widgets/birth_date_picker.dart';
import 'package:hospital_booking_mobile/features/profile/application/patient_profile_controller.dart';
import 'package:hospital_booking_mobile/features/profile/domain/patient_profile.dart';

/// Lưu riêng các trường vừa sửa và báo kết quả bằng thông báo ngắn. Trả true khi máy chủ đã nhận.
Future<bool> saveProfileFields(
  BuildContext context,
  WidgetRef ref,
  Map<String, Object?> fields,
) async {
  final controller = ref.read(patientProfileControllerProvider.notifier);
  final saved = await controller.saveFields(fields);
  if (!context.mounted) return saved;
  final message = saved
      ? 'Đã lưu.'
      : (ref.read(patientProfileControllerProvider).error?.message ??
            'Chưa lưu được. Vui lòng thử lại.');
  controller.dismissError();
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(message)));
  return saved;
}

/// Ngày dạng yyyy-MM-dd gửi lên máy chủ.
String apiDateOf(DateTime date) =>
    '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';

final _phonePattern = RegExp(r'^(0|\+84)[0-9]{9,10}$');

/// Các hành động sửa một dòng của hồ sơ cá nhân; mỗi hàm mở bảng sửa phù hợp rồi lưu riêng trường đó.
class ProfileEdits {
  const ProfileEdits(this.context, this.ref, this.profile);

  final BuildContext context;
  final WidgetRef ref;
  final PatientProfile profile;

  Future<void> _text({
    required String field,
    required String title,
    required String label,
    String? current,
    String? description,
    String? hint,
    TextInputType keyboardType = TextInputType.text,
    TextCapitalization capitalization = TextCapitalization.none,
    List<TextInputFormatter>? formatters,
    int? maxLength,
    int maxLines = 1,
    bool allowEmpty = true,
    String? Function(String)? validator,
    String? consentText,
    Map<String, Object?> extra = const {},
  }) async {
    final result = await showTextEditSheet(
      context,
      title: title,
      label: label,
      description: description,
      initial: current,
      hint: hint,
      keyboardType: keyboardType,
      capitalization: capitalization,
      inputFormatters: formatters,
      maxLength: maxLength,
      minLines: maxLines == 1 ? 1 : 2,
      maxLines: maxLines,
      allowEmpty: allowEmpty,
      validator: validator,
      consentText: consentText,
    );
    if (result == null || !context.mounted) return;
    await saveProfileFields(context, ref, {
      field: result.text.isEmpty ? null : result.text,
      ...extra,
      if (result.consented) 'healthConsent': true,
    });
  }

  Future<void> fullName() => _text(
    field: 'fullName',
    title: 'Họ và tên',
    label: 'Họ và tên',
    current: profile.fullName,
    capitalization: TextCapitalization.words,
    maxLength: 120,
    allowEmpty: false,
    validator: (value) =>
        value.length < 2 ? 'Họ và tên phải có ít nhất 2 ký tự.' : null,
  );

  Future<void> phone() => _text(
    field: 'phone',
    title: 'Số điện thoại liên hệ',
    description: 'Cơ sở khám dùng để liên hệ khi cần.',
    label: 'Số điện thoại',
    current: profile.phone,
    keyboardType: TextInputType.phone,
    maxLength: 12,
    validator: (value) => _phonePattern.hasMatch(value)
        ? null
        : 'Số điện thoại không đúng định dạng.',
  );

  Future<void> cccd() => _text(
    field: 'cccd',
    title: 'Số CCCD',
    label: 'CCCD',
    current: profile.cccd,
    keyboardType: TextInputType.number,
    formatters: [FilteringTextInputFormatter.digitsOnly],
    maxLength: 20,
    validator: (value) =>
        value.length < 9 ? 'CCCD phải có từ 9 đến 20 chữ số.' : null,
  );

  Future<void> address() => _text(
    field: 'address',
    title: 'Địa chỉ',
    label: 'Địa chỉ',
    current: profile.address,
    capitalization: TextCapitalization.sentences,
    maxLength: 300,
    maxLines: 3,
  );

  Future<void> dateOfBirth() async {
    final picked = await showBirthDatePicker(
      context,
      initial: DateTime.tryParse(profile.dateOfBirth ?? ''),
    );
    if (picked == null || !context.mounted) return;
    await saveProfileFields(context, ref, {'dateOfBirth': apiDateOf(picked)});
  }

  Future<void> gender() async {
    final pick = await showOptionSheet<PatientGender>(
      context,
      title: 'Giới tính',
      options: PatientGender.values,
      labelOf: (item) => item.label,
      selected: profile.gender,
      allowClear: true,
    );
    if (pick == null || !context.mounted) return;
    await saveProfileFields(context, ref, {'gender': pick.value?.apiValue});
  }

  Future<void> bloodType() async {
    const groups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
    final current = profile.bloodType;
    final pick = await showOptionSheet<String>(
      context,
      title: 'Nhóm máu',
      // Giá trị cũ ngoài danh sách chuẩn vẫn hiện để không mất khi chọn lại.
      options: [
        if (current != null && !groups.contains(current)) current,
        ...groups,
      ],
      labelOf: (item) => item,
      selected: current,
      allowClear: true,
    );
    if (pick == null || !context.mounted) return;
    await saveProfileFields(context, ref, {'bloodType': pick.value});
  }

  Future<void> height() =>
      _decimal('height', 'Chiều cao (cm)', profile.height, 300);

  Future<void> weight() =>
      _decimal('weight', 'Cân nặng (kg)', profile.weight, 500);

  Future<void> _decimal(
    String field,
    String label,
    double? current,
    double max,
  ) async {
    final result = await showTextEditSheet(
      context,
      title: label,
      label: label,
      initial: current == null
          ? null
          : (current == current.roundToDouble()
                ? current.toInt().toString()
                : current.toString()),
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      inputFormatters: [
        FilteringTextInputFormatter.allow(RegExp(r'^\d{0,3}([.,]\d{0,2})?')),
      ],
      validator: (value) {
        final number = double.tryParse(value.replaceAll(',', '.'));
        return number == null || number <= 0 || number > max
            ? 'Giá trị không hợp lệ.'
            : null;
      },
    );
    if (result == null || !context.mounted) return;
    await saveProfileFields(context, ref, {
      field: result.text.isEmpty
          ? null
          : double.parse(result.text.replaceAll(',', '.')),
    });
  }

  Future<void> bloodPressure() => _text(
    field: 'bloodPressure',
    title: 'Huyết áp',
    label: 'Huyết áp',
    current: profile.bloodPressure,
    hint: 'Ví dụ: 120/80 mmHg',
    maxLength: 40,
  );

  /// Dị ứng, tiền sử bệnh, tiền sử gia đình: dữ liệu nhạy cảm, lần đầu lưu cần người dùng đồng ý.
  Future<void> healthText(String field, String title, String? current) => _text(
    field: field,
    title: title,
    label: title,
    current: current,
    capitalization: TextCapitalization.sentences,
    maxLength: field == 'allergies' ? 2000 : 5000,
    maxLines: 6,
    consentText: profile.hasHealthConsent
        ? null
        : 'Tôi đồng ý cho cơ sở khám lưu thông tin sức khỏe này để phục vụ việc khám. '
              'Tôi có thể xóa bất cứ lúc nào.',
  );

  Future<void> insuranceCode() => _text(
    field: 'healthInsuranceCode',
    title: 'Mã thẻ BHYT',
    label: 'Mã thẻ BHYT',
    current: profile.healthInsuranceCode,
    capitalization: TextCapitalization.characters,
    maxLength: 50,
  );

  Future<void> registeredHospital() => _text(
    field: 'registeredHospital',
    title: 'Nơi đăng ký khám ban đầu',
    label: 'Nơi đăng ký',
    current: profile.registeredHospital,
    description: 'Ghi tên cơ sở như trên thẻ BHYT.',
    capitalization: TextCapitalization.sentences,
    maxLength: 200,
  );
}
