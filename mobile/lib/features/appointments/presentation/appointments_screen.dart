import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/app/theme/app_theme.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:hospital_booking_mobile/core/widgets/app_error_banner.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/appointments/application/appointments_controller.dart';
import 'package:hospital_booking_mobile/features/appointments/domain/patient_appointment.dart';

enum _AppointmentFilter { upcoming, history, all }

class AppointmentsScreen extends ConsumerStatefulWidget {
  const AppointmentsScreen({super.key});

  @override
  ConsumerState<AppointmentsScreen> createState() => _AppointmentsScreenState();
}

class _AppointmentsScreenState extends ConsumerState<AppointmentsScreen> {
  _AppointmentFilter _filter = _AppointmentFilter.upcoming;

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(appointmentsControllerProvider);
    final controller = ref.read(appointmentsControllerProvider.notifier);
    final visibleItems = state.items
        .where(
          (item) => switch (_filter) {
            _AppointmentFilter.upcoming => !item.isHistory,
            _AppointmentFilter.history => item.isHistory,
            _AppointmentFilter.all => true,
          },
        )
        .toList(growable: false);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Lịch khám của tôi'),
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
            ? const _AppointmentsLoading()
            : RefreshIndicator(
                onRefresh: controller.refresh,
                child: CustomScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  slivers: [
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                      sliver: SliverList.list(
                        children: [
                          _OverviewCard(
                            upcoming: state.items
                                .where((item) => !item.isHistory)
                                .length,
                            history: state.items
                                .where((item) => item.isHistory)
                                .length,
                            total: state.total,
                          ),
                          const SizedBox(height: 16),
                          SegmentedButton<_AppointmentFilter>(
                            segments: const [
                              ButtonSegment(
                                value: _AppointmentFilter.upcoming,
                                label: Text('Sắp tới'),
                                icon: Icon(Icons.upcoming_outlined),
                              ),
                              ButtonSegment(
                                value: _AppointmentFilter.history,
                                label: Text('Đã qua'),
                                icon: Icon(Icons.history_rounded),
                              ),
                              ButtonSegment(
                                value: _AppointmentFilter.all,
                                label: Text('Tất cả'),
                              ),
                            ],
                            selected: {_filter},
                            showSelectedIcon: false,
                            onSelectionChanged: (selection) {
                              setState(() => _filter = selection.first);
                            },
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
                    if (visibleItems.isEmpty)
                      SliverPadding(
                        padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
                        sliver: SliverToBoxAdapter(
                          child: _EmptyAppointments(filter: _filter),
                        ),
                      )
                    else
                      SliverPadding(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                        sliver: SliverList.separated(
                          itemCount: visibleItems.length,
                          separatorBuilder: (_, _) =>
                              const SizedBox(height: 12),
                          itemBuilder: (context, index) => _AppointmentCard(
                            appointment: visibleItems[index],
                            onTap: () => context.push(
                              '/appointments/${visibleItems[index].id}',
                            ),
                          ),
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
                                  : 'Xem thêm lịch khám',
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

class _OverviewCard extends StatelessWidget {
  const _OverviewCard({
    required this.upcoming,
    required this.history,
    required this.total,
  });

  final int upcoming;
  final int history;
  final int total;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(18),
    decoration: BoxDecoration(
      gradient: const LinearGradient(
        colors: [AppTheme.primaryDark, AppTheme.primary],
      ),
      borderRadius: BorderRadius.circular(20),
    ),
    child: Row(
      children: [
        Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.14),
            borderRadius: BorderRadius.circular(15),
          ),
          child: const Icon(Icons.event_available_rounded, color: Colors.white),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '$upcoming lịch cần theo dõi',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                '$history lịch đã qua · $total lịch trên hệ thống',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Colors.white.withValues(alpha: 0.82),
                ),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

class _AppointmentCard extends StatelessWidget {
  const _AppointmentCard({required this.appointment, required this.onTap});

  final PatientAppointment appointment;
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
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: AppStatusBadge(
                    label: appointment.status.label,
                    tone: appointment.status.tone,
                    icon: appointment.status.icon,
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  appointment.bookingCode,
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Text(
              appointment.doctorName.isEmpty
                  ? 'Bác sĩ đang được cập nhật'
                  : appointment.doctorName,
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 4),
            Text(
              appointment.careUnit.isEmpty
                  ? 'Đơn vị khám đang được cập nhật'
                  : appointment.careUnit,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
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
                        '${formatDateVi(appointment.appointmentDate)} · ${formatTimeRange(appointment.startTime, appointment.endTime)}',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
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

class _EmptyAppointments extends StatelessWidget {
  const _EmptyAppointments({required this.filter});

  final _AppointmentFilter filter;

  @override
  Widget build(BuildContext context) => AppEmptyState(
    icon: filter == _AppointmentFilter.history
        ? Icons.history_rounded
        : Icons.event_available_outlined,
    title: switch (filter) {
      _AppointmentFilter.upcoming => 'Chưa có lịch sắp tới',
      _AppointmentFilter.history => 'Chưa có lịch đã qua',
      _AppointmentFilter.all => 'Chưa có lịch khám',
    },
    message: filter == _AppointmentFilter.history
        ? 'Các lịch hoàn tất hoặc đã hủy sẽ xuất hiện tại đây.'
        : 'Đặt lịch với bác sĩ phù hợp và theo dõi trạng thái ngay trên ứng dụng.',
    action: filter == _AppointmentFilter.history
        ? null
        : FilledButton.icon(
            onPressed: () => context.push('/booking'),
            icon: const Icon(Icons.add_rounded),
            label: const Text('Đặt lịch khám'),
          ),
  );
}

class _AppointmentsLoading extends StatelessWidget {
  const _AppointmentsLoading();

  @override
  Widget build(BuildContext context) => ListView.separated(
    padding: const EdgeInsets.all(16),
    itemCount: 4,
    separatorBuilder: (_, _) => const SizedBox(height: 12),
    itemBuilder: (_, index) =>
        AppLoadingSkeleton(height: index == 0 ? 112 : 190),
  );
}
