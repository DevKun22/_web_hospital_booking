import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:hospital_booking_mobile/core/widgets/app_error_banner.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/prescriptions/application/prescriptions_controller.dart';
import 'package:hospital_booking_mobile/features/prescriptions/domain/patient_prescription.dart';

class PrescriptionsScreen extends ConsumerWidget {
  const PrescriptionsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(prescriptionsControllerProvider);
    final controller = ref.read(prescriptionsControllerProvider.notifier);
    return Scaffold(
      appBar: AppBar(
        leading: Navigator.of(context).canPop()
            ? null
            : IconButton(
                tooltip: 'Trang chủ',
                onPressed: () => context.go('/home'),
                icon: const Icon(Icons.home_outlined),
              ),
        title: const Text('Đơn thuốc'),
        actions: [
          IconButton(
            tooltip: 'Làm mới',
            onPressed: state.isRefreshing ? null : controller.refresh,
            icon: const Icon(Icons.refresh_outlined),
          ),
        ],
      ),
      body: SafeArea(
        child: state.isInitialLoading && !state.hasItems
            ? const _PrescriptionsLoading()
            : RefreshIndicator(
                onRefresh: controller.refresh,
                child: CustomScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  slivers: [
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(
                        AppSpacing.md,
                        AppSpacing.xs,
                        AppSpacing.md,
                        AppSpacing.md,
                      ),
                      sliver: SliverList.list(
                        children: [
                          AppGradientOverviewCard(
                            icon: Icons.medication_outlined,
                            title: '${state.total} đơn thuốc đã phát hành',
                            subtitle: state.items.length < state.total
                                ? 'Đang hiển thị ${state.items.length} đơn gần nhất'
                                : 'Theo dõi đúng liều lượng và hướng dẫn của bác sĩ',
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          const _SafetyNotice(),
                          if (state.error != null) ...[
                            const SizedBox(height: AppSpacing.md),
                            AppErrorBanner(
                              error: state.error!,
                              onDismiss: controller.dismissError,
                            ),
                          ],
                          if (state.isRefreshing) ...[
                            const SizedBox(height: AppSpacing.sm),
                            const LinearProgressIndicator(minHeight: 2),
                          ],
                        ],
                      ),
                    ),
                    if (!state.hasItems)
                      const SliverFillRemaining(
                        hasScrollBody: false,
                        child: AppEmptyState(
                          icon: Icons.medication_outlined,
                          title: 'Chưa có đơn thuốc',
                          message:
                              'Đơn thuốc sẽ xuất hiện sau khi bác sĩ phát hành trên hệ thống.',
                        ),
                      )
                    else
                      SliverPadding(
                        padding: const EdgeInsets.fromLTRB(
                          AppSpacing.md,
                          0,
                          AppSpacing.md,
                          AppSpacing.lg,
                        ),
                        sliver: SliverList.separated(
                          itemCount: state.items.length,
                          separatorBuilder: (_, _) =>
                              const SizedBox(height: AppSpacing.sm),
                          itemBuilder: (context, index) {
                            final prescription = state.items[index];
                            return _PrescriptionCard(
                              prescription: prescription,
                              onTap: () => context.push(
                                '/prescriptions/${prescription.id}',
                              ),
                            );
                          },
                        ),
                      ),
                    if (state.hasNextPage)
                      SliverPadding(
                        padding: const EdgeInsets.fromLTRB(
                          AppSpacing.md,
                          0,
                          AppSpacing.md,
                          AppSpacing.xxl,
                        ),
                        sliver: SliverToBoxAdapter(
                          child: OutlinedButton.icon(
                            onPressed: state.isLoadingMore
                                ? null
                                : controller.loadMore,
                            icon: state.isLoadingMore
                                ? const SizedBox.square(
                                    dimension: 18,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                    ),
                                  )
                                : const Icon(Icons.expand_more_outlined),
                            label: Text(
                              state.isLoadingMore
                                  ? 'Đang tải thêm…'
                                  : 'Xem thêm đơn thuốc',
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
      ),
    );
  }
}

class _SafetyNotice extends StatelessWidget {
  const _SafetyNotice();

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(AppSpacing.sm),
    decoration: BoxDecoration(
      color: Theme.of(context).colorScheme.tertiaryContainer,
      borderRadius: BorderRadius.circular(AppRadius.lg),
    ),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(
          Icons.health_and_safety_outlined,
          color: Theme.of(context).colorScheme.onTertiaryContainer,
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Text(
            'Không tự ý đổi liều, ngừng thuốc hoặc dùng lại đơn cũ nếu chưa hỏi bác sĩ.',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Theme.of(context).colorScheme.onTertiaryContainer,
            ),
          ),
        ),
      ],
    ),
  );
}

class _PrescriptionCard extends StatelessWidget {
  const _PrescriptionCard({required this.prescription, required this.onTap});

  final PatientPrescription prescription;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Card(
    margin: EdgeInsets.zero,
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const AppStatusBadge(
                  label: 'Đã phát hành',
                  tone: AppStatusTone.success,
                  icon: Icons.verified_outlined,
                ),
                const Spacer(),
                Text(
                  prescription.prescriptionCode,
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                    fontWeight: AppFontWeight.strong,
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              prescription.doctorName.isEmpty
                  ? 'Bác sĩ kê đơn'
                  : prescription.doctorName,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: AppFontWeight.strong,
              ),
            ),
            if (prescription.specialization != null) ...[
              const SizedBox(height: AppSpacing.xxs),
              Text(
                prescription.specialization!,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
            ],
            if (prescription.isDependentPrescription &&
                prescription.patientName != null) ...[
              const SizedBox(height: AppSpacing.xs),
              Row(
                children: [
                  Icon(
                    Icons.family_restroom_outlined,
                    size: 17,
                    color: Theme.of(context).colorScheme.primary,
                  ),
                  const SizedBox(width: AppSpacing.xs),
                  Expanded(
                    child: Text(
                      'Người khám: ${prescription.patientName}',
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        fontWeight: AppFontWeight.strong,
                      ),
                    ),
                  ),
                ],
              ),
            ],
            const SizedBox(height: AppSpacing.sm),
            Row(
              children: [
                Icon(
                  Icons.medication_liquid_outlined,
                  size: 20,
                  color: Theme.of(context).colorScheme.primary,
                ),
                const SizedBox(width: AppSpacing.xs),
                Expanded(
                  child: Text(
                    '${prescription.items.length} loại thuốc',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      fontWeight: AppFontWeight.strong,
                    ),
                  ),
                ),
                Text(formatDateVi(prescription.appointmentDate)),
                const SizedBox(width: AppSpacing.xxs),
                const Icon(Icons.chevron_right_outlined),
              ],
            ),
            if (prescription.items.isNotEmpty) ...[
              const Divider(height: 24),
              for (final item in prescription.items.take(2))
                Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.xxs),
                  child: Text(
                    '• ${item.medicineName}${item.usageSummary == null ? '' : ' — ${item.usageSummary}'}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              if (prescription.items.length > 2)
                Text(
                  '+ ${prescription.items.length - 2} thuốc khác',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.primary,
                    fontWeight: AppFontWeight.strong,
                  ),
                ),
            ],
          ],
        ),
      ),
    ),
  );
}

class _PrescriptionsLoading extends StatelessWidget {
  const _PrescriptionsLoading();

  @override
  Widget build(BuildContext context) => ListView.separated(
    padding: const EdgeInsets.all(AppSpacing.md),
    itemCount: 4,
    separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
    itemBuilder: (_, index) =>
        AppLoadingSkeleton(height: index == 0 ? 112 : 210),
  );
}
