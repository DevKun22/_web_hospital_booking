import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:hospital_booking_mobile/core/widgets/app_edit_sheets.dart';
import 'package:hospital_booking_mobile/core/widgets/app_info_list.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/core/widgets/birth_date_picker.dart';
import 'package:hospital_booking_mobile/features/dependents/application/dependent_profiles_controller.dart';
import 'package:hospital_booking_mobile/features/dependents/domain/dependent_profile.dart';
import 'package:hospital_booking_mobile/features/profile/presentation/profile_actions.dart';

String _genderLabel(String? value) => switch (value) {
  'MALE' => 'Nam',
  'FEMALE' => 'Nữ',
  'OTHER' => 'Khác',
  _ => '',
};

final _phonePattern = RegExp(r'^(0|\+84)[0-9]{9,10}$');
final _emailPattern = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');

/// Hồ sơ người thân dạng xem: chạm một dòng để sửa riêng dòng đó; cuối trang có nút ngừng quản lý.
class DependentDetailScreen extends ConsumerWidget {
  const DependentDetailScreen({super.key, required this.dependentId});

  final String dependentId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(dependentProfilesControllerProvider);
    DependentProfile? dependent;
    for (final item in state.items) {
      if (item.id == dependentId) dependent = item;
    }
    if (dependent == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Hồ sơ người thân')),
        body: state.loaded
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
    final saving = state.isSaving;
    final person = dependent;

    Future<void> save(Map<String, Object?> fields) async {
      final controller = ref.read(dependentProfilesControllerProvider.notifier);
      final ok = await controller.updateFields(person.id, fields);
      if (!context.mounted) return;
      final message = ok
          ? 'Đã lưu.'
          : (ref.read(dependentProfilesControllerProvider).error?.message ??
                'Chưa lưu được. Vui lòng thử lại.');
      controller.dismissError();
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(message)));
    }

    Future<void> text({
      required String field,
      required String title,
      String? current,
      String? description,
      TextInputType keyboardType = TextInputType.text,
      TextCapitalization capitalization = TextCapitalization.none,
      List<TextInputFormatter>? formatters,
      int? maxLength,
      int maxLines = 1,
      bool allowEmpty = true,
      String? Function(String)? validator,
      Map<String, Object?> extra = const {},
    }) async {
      final result = await showTextEditSheet(
        context,
        title: title,
        label: title,
        description: description,
        initial: current,
        keyboardType: keyboardType,
        capitalization: capitalization,
        inputFormatters: formatters,
        maxLength: maxLength,
        minLines: maxLines == 1 ? 1 : 2,
        maxLines: maxLines,
        allowEmpty: allowEmpty,
        validator: validator,
      );
      if (result == null || !context.mounted) return;
      await save({field: result.text.isEmpty ? null : result.text, ...extra});
    }

    VoidCallback? tap(Future<void> Function() action) =>
        saving ? null : () => action();

    return Scaffold(
      appBar: AppBar(title: Text(person.fullName)),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.page,
            0,
            AppSpacing.page,
            AppSpacing.xxl,
          ),
          children: [
            AppInfoSection(
              title: 'Cơ bản',
              children: [
                AppInfoRow(
                  key: const ValueKey('row-fullName'),
                  label: 'Họ và tên',
                  value: person.fullName,
                  onTap: tap(
                    () => text(
                      field: 'fullName',
                      title: 'Họ và tên',
                      current: person.fullName,
                      capitalization: TextCapitalization.words,
                      maxLength: 120,
                      allowEmpty: false,
                      validator: (value) =>
                          value.length < 2 ? 'Họ tên tối thiểu 2 ký tự.' : null,
                    ),
                  ),
                ),
                AppInfoRow(
                  key: const ValueKey('row-relationship'),
                  label: 'Mối quan hệ',
                  value: person.relationship.label,
                  onTap: tap(() async {
                    final pick = await showOptionSheet<DependentRelationship>(
                      context,
                      title: 'Mối quan hệ',
                      options: DependentRelationship.values,
                      labelOf: (item) => item.label,
                      selected: person.relationship,
                    );
                    if (pick?.value == null || !context.mounted) return;
                    await save({'relationship': pick!.value!.apiValue});
                  }),
                ),
                AppInfoRow(
                  key: const ValueKey('row-dateOfBirth'),
                  label: 'Ngày sinh',
                  value: person.dateOfBirth == null
                      ? null
                      : formatDateVi(person.dateOfBirth!),
                  addLabel: 'Thêm ngày sinh',
                  onTap: tap(() async {
                    final picked = await showBirthDatePicker(
                      context,
                      initial: DateTime.tryParse(person.dateOfBirth ?? ''),
                    );
                    if (picked == null || !context.mounted) return;
                    await save({'dateOfBirth': apiDateOf(picked)});
                  }),
                ),
                AppInfoRow(
                  key: const ValueKey('row-gender'),
                  label: 'Giới tính',
                  value: _genderLabel(person.gender),
                  addLabel: 'Thêm giới tính',
                  onTap: tap(() async {
                    final pick = await showOptionSheet<String>(
                      context,
                      title: 'Giới tính',
                      options: const ['MALE', 'FEMALE', 'OTHER'],
                      labelOf: _genderLabel,
                      selected: person.gender,
                      allowClear: true,
                    );
                    if (pick == null || !context.mounted) return;
                    await save({'gender': pick.value});
                  }),
                ),
              ],
            ),
            AppInfoSection(
              title: 'Liên hệ riêng',
              children: [
                AppInfoRow(
                  key: const ValueKey('row-phone'),
                  label: 'Số điện thoại',
                  value: person.phone,
                  addLabel: 'Thêm số điện thoại',
                  onTap: tap(
                    () => text(
                      field: 'phone',
                      title: 'Số điện thoại riêng',
                      current: person.phone,
                      keyboardType: TextInputType.phone,
                      maxLength: 12,
                      validator: (value) => _phonePattern.hasMatch(value)
                          ? null
                          : 'Số điện thoại không hợp lệ.',
                    ),
                  ),
                ),
                AppInfoRow(
                  key: const ValueKey('row-email'),
                  label: 'Email',
                  value: person.email,
                  addLabel: 'Thêm email',
                  onTap: tap(
                    () => text(
                      field: 'email',
                      title: 'Email riêng',
                      current: person.email,
                      keyboardType: TextInputType.emailAddress,
                      validator: (value) => _emailPattern.hasMatch(value)
                          ? null
                          : 'Email không hợp lệ.',
                    ),
                  ),
                ),
              ],
            ),
            AppInfoSection(
              title: 'Giấy tờ và địa chỉ',
              children: [
                AppInfoRow(
                  key: const ValueKey('row-cccd'),
                  label: 'CCCD',
                  value: person.cccd,
                  addLabel: 'Thêm số CCCD',
                  onTap: tap(
                    () => text(
                      field: 'cccd',
                      title: 'Số CCCD',
                      current: person.cccd,
                      keyboardType: TextInputType.number,
                      formatters: [FilteringTextInputFormatter.digitsOnly],
                      maxLength: 20,
                      validator: (value) => value.length < 9
                          ? 'CCCD phải có từ 9 đến 20 chữ số.'
                          : null,
                    ),
                  ),
                ),
                AppInfoRow(
                  key: const ValueKey('row-address'),
                  label: 'Địa chỉ',
                  value: person.address,
                  addLabel: 'Thêm địa chỉ',
                  onTap: tap(
                    () => text(
                      field: 'address',
                      title: 'Địa chỉ',
                      current: person.address,
                      capitalization: TextCapitalization.sentences,
                      maxLength: 300,
                      maxLines: 3,
                    ),
                  ),
                ),
              ],
            ),
            const AppInfoSectionTitle('Bảo hiểm y tế'),
            AppInfoCard(
              children: [
                AppInfoSwitchRow(
                  key: const ValueKey('switch-bhyt'),
                  title: 'Có thẻ BHYT',
                  value: person.hasBhyt,
                  onChanged: saving
                      ? null
                      : (value) async {
                          if (!value) {
                            await save({'hasBHYT': false});
                            return;
                          }
                          // Máy chủ bắt buộc kèm mã thẻ khi bật BHYT cho người thân.
                          final result = await showTextEditSheet(
                            context,
                            title: 'Mã thẻ BHYT',
                            label: 'Mã thẻ BHYT',
                            initial: person.healthInsuranceCode,
                            capitalization: TextCapitalization.characters,
                            maxLength: 50,
                            allowEmpty: false,
                          );
                          if (result == null || !context.mounted) return;
                          await save({
                            'hasBHYT': true,
                            'healthInsuranceCode': result.text,
                          });
                        },
                ),
                if (person.hasBhyt) ...[
                  AppInfoRow(
                    key: const ValueKey('row-insuranceCode'),
                    label: 'Mã thẻ',
                    value: person.healthInsuranceCode,
                    addLabel: 'Thêm mã thẻ',
                    onTap: tap(
                      () => text(
                        field: 'healthInsuranceCode',
                        title: 'Mã thẻ BHYT',
                        current: person.healthInsuranceCode,
                        capitalization: TextCapitalization.characters,
                        maxLength: 50,
                        allowEmpty: false,
                        extra: const {'hasBHYT': true},
                      ),
                    ),
                  ),
                  AppInfoRow(
                    key: const ValueKey('row-registeredHospital'),
                    label: 'Nơi đăng ký khám ban đầu',
                    value: person.registeredHospital,
                    addLabel: 'Thêm nơi đăng ký',
                    onTap: tap(
                      () => text(
                        field: 'registeredHospital',
                        title: 'Nơi đăng ký khám ban đầu',
                        current: person.registeredHospital,
                        capitalization: TextCapitalization.sentences,
                        maxLength: 200,
                        extra: {
                          'hasBHYT': true,
                          'healthInsuranceCode': person.healthInsuranceCode,
                        },
                      ),
                    ),
                  ),
                ],
              ],
            ),
            AppInfoSection(
              title: 'Dị ứng và tiền sử',
              children: [
                for (final entry in [
                  ('allergies', 'Dị ứng', person.allergies, 2000),
                  (
                    'medicalHistory',
                    'Tiền sử bệnh',
                    person.medicalHistory,
                    5000,
                  ),
                  (
                    'familyHistory',
                    'Tiền sử gia đình',
                    person.familyHistory,
                    5000,
                  ),
                ])
                  AppInfoRow(
                    key: ValueKey('row-${entry.$1}'),
                    label: entry.$2,
                    value: entry.$3,
                    addLabel: 'Thêm ${entry.$2.toLowerCase()}',
                    onTap: tap(
                      () => text(
                        field: entry.$1,
                        title: entry.$2,
                        current: entry.$3,
                        capitalization: TextCapitalization.sentences,
                        maxLength: entry.$4,
                        maxLines: 6,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: AppSpacing.lg),
            TextButton.icon(
              key: const ValueKey('dependent-archive'),
              style: TextButton.styleFrom(
                foregroundColor: context.colors.danger,
              ),
              onPressed: saving ? null : () => _archive(context, ref, person),
              icon: const Icon(Icons.person_remove_outlined),
              label: const Text('Ngừng quản lý hồ sơ này'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _archive(
    BuildContext context,
    WidgetRef ref,
    DependentProfile dependent,
  ) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        icon: const Icon(Icons.person_remove_outlined),
        title: const Text('Ngừng quản lý hồ sơ?'),
        content: Text(
          'Hồ sơ ${dependent.fullName} sẽ không còn xuất hiện khi đặt lịch. Các lịch và kết quả đã có vẫn được giữ nguyên.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Giữ lại'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Ngừng quản lý'),
          ),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;
    final success = await ref
        .read(dependentProfilesControllerProvider.notifier)
        .archive(dependent.id);
    if (!context.mounted || !success) return;
    context.pop();
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Đã ngừng quản lý hồ sơ người thân.')),
    );
  }
}
