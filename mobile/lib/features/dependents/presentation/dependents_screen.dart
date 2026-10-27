import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:hospital_booking_mobile/core/widgets/app_error_banner.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/dependents/application/dependent_profiles_controller.dart';
import 'package:hospital_booking_mobile/features/dependents/domain/dependent_profile.dart';

class DependentsScreen extends ConsumerWidget {
  const DependentsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(dependentProfilesControllerProvider);
    final controller = ref.read(dependentProfilesControllerProvider.notifier);

    return Scaffold(
      appBar: AppBar(title: const Text('Hồ sơ người thân')),
      floatingActionButton: state.items.isEmpty
          ? null
          : FloatingActionButton.extended(
              // The screen can be opened above the persistent navigation shell;
              // opt out of the default FAB Hero tag to avoid route collisions.
              heroTag: null,
              onPressed: state.isSaving
                  ? null
                  : () => context.push('/dependents/new'),
              icon: const Icon(Icons.person_add_alt_1_outlined),
              label: const Text('Thêm hồ sơ'),
            ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () => controller.load(force: true),
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 112),
            children: [
              if (state.error != null) ...[
                AppErrorBanner(
                  error: state.error!,
                  onDismiss: controller.dismissError,
                ),
                const SizedBox(height: 12),
              ],
              if (state.isLoading && state.items.isEmpty)
                const Padding(
                  padding: EdgeInsets.only(top: 120),
                  child: Center(child: CircularProgressIndicator()),
                )
              else if (state.items.isEmpty)
                AppEmptyState(
                  icon: Icons.group_add_outlined,
                  title: 'Chưa có hồ sơ người thân',
                  message:
                      'Tạo hồ sơ một lần để chọn nhanh và liên kết đúng lịch khám, kết quả và thông báo.',
                  action: FilledButton.icon(
                    onPressed: () => context.push('/dependents/new'),
                    icon: const Icon(Icons.person_add_alt_1_outlined),
                    label: const Text('Thêm người thân'),
                  ),
                )
              else ...[
                Text(
                  'Bạn đang quản lý ${state.items.length} hồ sơ',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 12),
                for (final dependent in state.items) ...[
                  _DependentCard(
                    dependent: dependent,
                    disabled: state.isSaving,
                    onEdit: () =>
                        context.push('/dependents/${dependent.id}/edit'),
                    onArchive: () => _archive(context, ref, dependent),
                  ),
                  const SizedBox(height: 10),
                ],
              ],
            ],
          ),
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
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Đã ngừng quản lý hồ sơ người thân.')),
    );
  }
}

class _DependentCard extends StatelessWidget {
  const _DependentCard({
    required this.dependent,
    required this.disabled,
    required this.onEdit,
    required this.onArchive,
  });

  final DependentProfile dependent;
  final bool disabled;
  final VoidCallback onEdit;
  final VoidCallback onArchive;

  @override
  Widget build(BuildContext context) => Card(
    margin: EdgeInsets.zero,
    child: Padding(
      padding: const EdgeInsets.fromLTRB(16, 14, 8, 14),
      child: Row(
        children: [
          CircleAvatar(
            child: Text(
              dependent.fullName.isEmpty
                  ? '?'
                  : dependent.fullName.substring(0, 1).toUpperCase(),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  dependent.fullName,
                  style: Theme.of(
                    context,
                  ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 3),
                Text(
                  [
                    dependent.relationship.label,
                    if (dependent.dateOfBirth != null)
                      formatDateVi(dependent.dateOfBirth!),
                  ].join(' · '),
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
                if (dependent.hasBhyt) ...[
                  const SizedBox(height: 5),
                  const AppStatusBadge(
                    label: 'Có BHYT',
                    tone: AppStatusTone.info,
                    icon: Icons.health_and_safety_outlined,
                  ),
                ],
              ],
            ),
          ),
          PopupMenuButton<String>(
            enabled: !disabled,
            onSelected: (value) => value == 'edit' ? onEdit() : onArchive(),
            itemBuilder: (_) => const [
              PopupMenuItem(value: 'edit', child: Text('Chỉnh sửa')),
              PopupMenuItem(value: 'archive', child: Text('Ngừng quản lý')),
            ],
          ),
        ],
      ),
    ),
  );
}
