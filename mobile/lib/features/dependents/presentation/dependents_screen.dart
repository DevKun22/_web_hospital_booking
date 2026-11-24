import 'package:hospital_booking_mobile/core/widgets/app_zone.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
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
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.md,
              AppSpacing.sm,
              AppSpacing.md,
              appMainContentBottomInset,
            ),
            children: [
              if (state.error != null) ...[
                AppErrorBanner(
                  error: state.error!,
                  onDismiss: controller.dismissError,
                ),
                const SizedBox(height: AppSpacing.sm),
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
                const SizedBox(height: AppSpacing.sm),
                for (var i = 0; i < state.items.length; i += 1) ...[
                  _DependentCard(
                    dependent: state.items[i],
                    tint: context.colors.zone(AppZone.primary),
                    disabled: state.isSaving,
                    onOpen: () =>
                        context.push('/dependents/${state.items[i].id}'),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                ],
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _DependentCard extends StatelessWidget {
  const _DependentCard({
    required this.dependent,
    required this.tint,
    required this.disabled,
    required this.onOpen,
  });

  final DependentProfile dependent;
  final ({Color background, Color foreground}) tint;
  final bool disabled;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final text = Theme.of(context).textTheme;
    return Material(
      color: colors.surface,
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadius.lg),
        onTap: disabled ? null : onOpen,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.sm,
            AppSpacing.sm,
            AppSpacing.sm,
            AppSpacing.sm,
          ),
          child: Row(
            children: [
              CircleAvatar(
                radius: 22,
                backgroundColor: tint.background,
                child: Text(
                  dependent.fullName.isEmpty
                      ? '?'
                      : dependent.fullName.substring(0, 1).toUpperCase(),
                  style: text.titleSmall?.copyWith(color: tint.foreground),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      dependent.fullName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: text.titleSmall,
                    ),
                    const SizedBox(height: AppSpacing.xxs),
                    Wrap(
                      spacing: AppSpacing.xs,
                      runSpacing: 4,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        AppPill(
                          label: dependent.relationship.label,
                          tint: (
                            background: tint.background,
                            foreground: tint.foreground,
                          ),
                        ),
                        if (dependent.dateOfBirth != null)
                          Text(
                            formatDateVi(dependent.dateOfBirth!),
                            style: text.bodySmall?.copyWith(
                              color: colors.muted,
                            ),
                          ),
                        if (dependent.hasBhyt)
                          AppPill(
                            label: 'Có BHYT',
                            tint: (
                              background: colors.infoContainer,
                              foreground: colors.info,
                            ),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right_outlined, color: colors.muted),
            ],
          ),
        ),
      ),
    );
  }
}
