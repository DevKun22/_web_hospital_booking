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
    padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
    children: [
      Text(
        'Chọn người đến khám',
        style: Theme.of(
          sheetContext,
        ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
      ),
      const SizedBox(height: 8),
      for (final dependent in items)
        ListTile(
          leading: const CircleAvatar(
            child: Icon(Icons.person_outline_rounded),
          ),
          title: Text(dependent.fullName),
          subtitle: Text(dependent.relationship.label),
          trailing: dependent.id == selectedId
              ? const Icon(Icons.check_circle_rounded)
              : const Icon(Icons.chevron_right_rounded),
          onTap: () => Navigator.pop(sheetContext, dependent),
        ),
      const Divider(),
      ListTile(
        leading: const Icon(Icons.manage_accounts_outlined),
        title: const Text('Quản lý hồ sơ người thân'),
        trailing: const Icon(Icons.open_in_new_rounded),
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
    padding: const EdgeInsets.fromLTRB(24, 4, 24, 24),
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
        const SizedBox(height: 14),
        Text(
          'Đặt lịch cho người thân',
          style: Theme.of(
            sheetContext,
          ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 8),
        Text(
          'Đăng nhập giúp hệ thống xác nhận bạn là người quản lý hồ sơ, nhận OTP và xem lịch hoặc kết quả khám của người thân.',
          textAlign: TextAlign.center,
          style: Theme.of(sheetContext).textTheme.bodyMedium?.copyWith(
            color: Theme.of(sheetContext).colorScheme.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: 20),
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
