import 'package:hospital_booking_mobile/core/design/app_design_tokens.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/features/dependents/domain/dependent_profile.dart';

/// Hộp thoại và bảng chọn của bước nhập thông tin người khám.
Future<bool?> showNoDependentDialog(BuildContext context) => showDialog<bool>(
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

Future<DependentProfile?> showDependentPicker(
  BuildContext context, {
  required List<DependentProfile> items,
  required String? selectedId,
}) => showModalBottomSheet<DependentProfile>(
  context: context,
  showDragHandle: true,
  useSafeArea: true,
  builder: (sheetContext) => ListView(
    shrinkWrap: true,
    padding: const EdgeInsets.fromLTRB(
      AppSpacing.md,
      0,
      AppSpacing.md,
      AppSpacing.xl,
    ),
    children: [
      Text(
        'Chọn người đến khám',
        style: Theme.of(
          sheetContext,
        ).textTheme.titleLarge?.copyWith(fontWeight: AppFontWeight.strong),
      ),
      const SizedBox(height: AppSpacing.xs),
      for (final dependent in items)
        ListTile(
          leading: const CircleAvatar(
            child: Icon(Icons.person_outline_outlined),
          ),
          title: Text(dependent.fullName),
          subtitle: Text(dependent.relationship.label),
          trailing: dependent.id == selectedId
              ? const Icon(Icons.check_circle_outlined)
              : const Icon(Icons.chevron_right_outlined),
          onTap: () => Navigator.pop(sheetContext, dependent),
        ),
      const Divider(),
      ListTile(
        leading: const Icon(Icons.manage_accounts_outlined),
        title: const Text('Quản lý hồ sơ người thân'),
        trailing: const Icon(Icons.open_in_new_outlined),
        onTap: () {
          Navigator.pop(sheetContext);
          context.push('/dependents');
        },
      ),
    ],
  ),
);

Future<void> showRelativeLoginNotice(
  BuildContext context,
) => showModalBottomSheet<void>(
  context: context,
  showDragHandle: true,
  useSafeArea: true,
  builder: (sheetContext) => Padding(
    padding: const EdgeInsets.fromLTRB(
      AppSpacing.xl,
      AppSpacing.xxs,
      AppSpacing.xl,
      AppSpacing.xl,
    ),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        CircleAvatar(
          radius: 26,
          backgroundColor: Theme.of(sheetContext).colorScheme.primaryContainer,
          child: Icon(
            Icons.group_outlined,
            color: Theme.of(sheetContext).colorScheme.primary,
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        Text(
          'Đặt lịch cho người thân',
          style: Theme.of(
            sheetContext,
          ).textTheme.titleLarge?.copyWith(fontWeight: AppFontWeight.strong),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          'Đăng nhập giúp hệ thống xác nhận bạn là người quản lý hồ sơ, nhận OTP và xem lịch hoặc kết quả khám của người thân.',
          textAlign: TextAlign.center,
          style: Theme.of(sheetContext).textTheme.bodyMedium?.copyWith(
            color: Theme.of(sheetContext).colorScheme.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
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
