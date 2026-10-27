import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:hospital_booking_mobile/core/widgets/app_error_banner.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/medical_records/application/medical_records_controller.dart';
import 'package:hospital_booking_mobile/features/medical_records/domain/patient_medical_record.dart';

class MedicalRecordsScreen extends ConsumerWidget {
  const MedicalRecordsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(medicalRecordsControllerProvider);
    final controller = ref.read(medicalRecordsControllerProvider.notifier);

    return Scaffold(
      appBar: AppBar(
        leading: Navigator.of(context).canPop()
            ? null
            : IconButton(
                tooltip: 'Trang chủ',
                onPressed: () => context.go('/home'),
                icon: const Icon(Icons.home_outlined),
              ),
        title: const Text('Kết quả khám'),
        actions: [
          IconButton(
            tooltip: 'Làm mới',
            onPressed: state.isRefreshing ? null : controller.refresh,
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: SafeArea(
        child: state.isInitialLoading && !state.hasItems
            ? const _MedicalRecordsLoading()
            : RefreshIndicator(
                onRefresh: controller.refresh,
                child: CustomScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  slivers: [
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 14),
                      sliver: SliverList.list(
                        children: [
                          AppGradientOverviewCard(
                            icon: Icons.folder_shared_outlined,
                            title: '${state.total} hồ sơ đã công bố',
                            subtitle: state.items.length < state.total
                                ? 'Đang hiển thị ${state.items.length} kết quả gần nhất'
                                : 'Dữ liệu được bảo vệ theo tài khoản bệnh nhân',
                          ),
                          if (state.error != null) ...[
                            const SizedBox(height: 14),
                            AppErrorBanner(
                              error: state.error!,
                              onDismiss: controller.dismissError,
                            ),
                          ],
                          if (state.isRefreshing) ...[
                            const SizedBox(height: 12),
                            const LinearProgressIndicator(minHeight: 2),
                          ],
                        ],
                      ),
                    ),
                    if (!state.hasItems)
                      const SliverFillRemaining(
                        hasScrollBody: false,
                        child: AppEmptyState(
                          icon: Icons.folder_open_outlined,
                          title: 'Chưa có kết quả khám',
                          message:
                              'Kết quả sẽ xuất hiện tại đây sau khi bác sĩ hoàn tất và bệnh viện công bố hồ sơ.',
                        ),
                      )
                    else
                      SliverPadding(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
                        sliver: SliverList.separated(
                          itemCount: state.items.length,
                          separatorBuilder: (_, _) =>
                              const SizedBox(height: 12),
                          itemBuilder: (context, index) {
                            final record = state.items[index];
                            return _MedicalRecordCard(
                              record: record,
                              onTap: () =>
                                  context.push('/medical-records/${record.id}'),
                            );
                          },
                        ),
                      ),
                    if (state.hasNextPage)
                      SliverPadding(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
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
                                : const Icon(Icons.expand_more_rounded),
                            label: Text(
                              state.isLoadingMore
                                  ? 'Đang tải thêm…'
                                  : 'Xem thêm kết quả',
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

class _MedicalRecordCard extends StatelessWidget {
  const _MedicalRecordCard({required this.record, required this.onTap});

  final PatientMedicalRecord record;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Card(
    margin: EdgeInsets.zero,
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(18),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const AppStatusBadge(
                  label: 'Đã công bố',
                  tone: AppStatusTone.success,
                  icon: Icons.verified_outlined,
                ),
                const Spacer(),
                Text(
                  record.recordCode,
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Text(
              record.diagnosis ?? 'Kết quả khám đã được công bố',
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 5),
            Text(
              record.doctorName.isEmpty
                  ? 'Bác sĩ phụ trách'
                  : record.doctorName,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
            if (record.careUnit.isNotEmpty) ...[
              const SizedBox(height: 2),
              Text(
                record.careUnit,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
            ],
            if (record.isDependentRecord && record.patientName != null) ...[
              const SizedBox(height: 7),
              _CareRecipientLabel(name: record.patientName!),
            ],
            const SizedBox(height: 14),
            DecoratedBox(
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.primaryContainer,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Row(
                  children: [
                    Icon(
                      Icons.calendar_today_outlined,
                      size: 20,
                      color: Theme.of(context).colorScheme.primary,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        '${formatDateVi(record.appointmentDate)} · ${formatTimeRange(record.startTime, record.endTime)}',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    if (record.resultFile.available ||
                        record.labResults.isNotEmpty)
                      Icon(
                        Icons.attach_file_rounded,
                        size: 18,
                        color: Theme.of(context).colorScheme.primary,
                      ),
                    const SizedBox(width: 4),
                    const Icon(Icons.chevron_right_rounded),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class _CareRecipientLabel extends StatelessWidget {
  const _CareRecipientLabel({required this.name});

  final String name;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Icon(
        Icons.family_restroom_outlined,
        size: 17,
        color: Theme.of(context).colorScheme.primary,
      ),
      const SizedBox(width: 6),
      Expanded(
        child: Text(
          'Người khám: $name',
          style: Theme.of(
            context,
          ).textTheme.labelMedium?.copyWith(fontWeight: FontWeight.w700),
        ),
      ),
    ],
  );
}

class _MedicalRecordsLoading extends StatelessWidget {
  const _MedicalRecordsLoading();

  @override
  Widget build(BuildContext context) => ListView.separated(
    padding: const EdgeInsets.all(16),
    itemCount: 4,
    separatorBuilder: (_, _) => const SizedBox(height: 12),
    itemBuilder: (_, index) =>
        AppLoadingSkeleton(height: index == 0 ? 112 : 210),
  );
}
