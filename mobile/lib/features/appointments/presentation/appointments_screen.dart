import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/features/appointments/presentation/appointment_status_visuals.dart';
import 'package:hospital_booking_mobile/app/navigation/booking_navigation.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/widgets/app_error_banner.dart';
import 'package:hospital_booking_mobile/core/widgets/app_filter_tabs.dart';
import 'package:hospital_booking_mobile/core/widgets/app_route_back_scope.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/appointments/application/appointments_controller.dart';
import 'package:hospital_booking_mobile/features/appointments/application/appointment_device_actions.dart';
import 'package:hospital_booking_mobile/features/appointments/domain/patient_appointment.dart';
import 'package:hospital_booking_mobile/features/appointments/presentation/widgets/appointment_qr_ticket.dart';

import 'package:hospital_booking_mobile/core/lifecycle/foreground_poller.dart';

enum _AppointmentFilter {
  upcoming('Sắp tới'),
  history('Đã qua'),
  all('Tất cả');

  const _AppointmentFilter(this.label);

  final String label;
}

class AppointmentsScreen extends ConsumerStatefulWidget {
  const AppointmentsScreen({super.key});

  @override
  ConsumerState<AppointmentsScreen> createState() => _AppointmentsScreenState();
}

class _AppointmentsScreenState extends ConsumerState<AppointmentsScreen> {
  // Thay đổi lịch hẹn đã có thông báo đẩy báo về; thăm dò chỉ là lưới an toàn nên thưa hơn.
  static const _pollInterval = Duration(seconds: 60);
  static const _pollFreshness = Duration(seconds: 55);

  _AppointmentFilter _filter = _AppointmentFilter.upcoming;
  late final ForegroundPoller _poller = ForegroundPoller(
    interval: _pollInterval,
    onTick: _pollIfVisible,
  );

  @override
  void initState() {
    super.initState();
    _poller.start();
  }

  @override
  void dispose() {
    _poller.stop();
    super.dispose();
  }

  void _pollIfVisible() {
    if (!mounted ||
        !TickerMode.of(context) ||
        ModalRoute.of(context)?.isCurrent != true) {
      return;
    }
    unawaited(
      ref
          .read(appointmentsControllerProvider.notifier)
          .refreshIfStale(maxAge: _pollFreshness),
    );
  }

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

    final next = _nextAppointment(state.items);
    return Scaffold(
      appBar: AppBar(
        leading: const AppRouteBackButton(fallbackLocation: '/home'),
        title: const Text('Lịch khám của tôi'),
        actions: [
          IconButton(
            tooltip: 'Làm mới',
            onPressed: state.isRefreshing ? null : controller.refresh,
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: AppSwipeTabs<_AppointmentFilter>(
        items: _AppointmentFilter.values,
        selected: _filter,
        onChanged: (value) => setState(() => _filter = value),
        child: SafeArea(
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
                            if (next != null) ...[
                              // Thẻ dày nút và chữ: giới hạn cỡ chữ để nút không tràn ở máy đặt chữ rất lớn.
                              MediaQuery.withClampedTextScaling(
                                maxScaleFactor: 1.3,
                                child: _NextAppointmentCard(appointment: next),
                              ),
                              const SizedBox(height: AppSpacing.sm),
                            ],
                            AppFilterTabs<_AppointmentFilter>(
                              items: _AppointmentFilter.values,
                              selected: _filter,
                              labelOf: (item) => item.label,
                              onChanged: (value) =>
                                  setState(() => _filter = value),
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
                          sliver: SliverList.builder(
                            itemCount: visibleItems.length,
                            itemBuilder: (context, index) {
                              final item = visibleItems[index];
                              final previous = index == 0
                                  ? null
                                  : visibleItems[index - 1];
                              final newMonth =
                                  previous == null ||
                                  _monthKey(previous) != _monthKey(item);
                              return Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  if (newMonth)
                                    Padding(
                                      padding: EdgeInsets.only(
                                        top: index == 0 ? 4 : 12,
                                        bottom: 6,
                                      ),
                                      child: Text(
                                        _monthLabel(item),
                                        style: Theme.of(context)
                                            .textTheme
                                            .labelMedium
                                            ?.copyWith(
                                              color: context.colors.muted,
                                              fontWeight: FontWeight.w600,
                                            ),
                                      ),
                                    ),
                                  _AppointmentRow(
                                    appointment: item,
                                    onTap: () => context.push(
                                      '/appointments/${item.id}',
                                    ),
                                  ),
                                  const SizedBox(height: AppSpacing.xs),
                                ],
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
                                    : 'Xem thêm lịch khám',
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
        ),
      ),
    );
  }
}

/// Lịch sắp tới gần nhất còn hiệu lực (đã xác nhận hoặc chờ xác nhận); null khi không có.
PatientAppointment? _nextAppointment(List<PatientAppointment> items) {
  final upcoming =
      items
          .where(
            (item) =>
                !item.isHistory &&
                item.status != PatientAppointmentStatus.pendingOtp &&
                item.scheduledStart != null,
          )
          .toList()
        ..sort((a, b) => a.scheduledStart!.compareTo(b.scheduledStart!));
  return upcoming.isEmpty ? null : upcoming.first;
}

String _monthKey(PatientAppointment item) => item.appointmentDate.length >= 7
    ? item.appointmentDate.substring(0, 7)
    : '';

String _monthLabel(PatientAppointment item) {
  final parts = item.appointmentDate.split('-');
  return parts.length >= 2
      ? 'Tháng ${int.tryParse(parts[1]) ?? parts[1]}/${parts[0]}'
      : '';
}

String _weekday(PatientAppointment item) {
  final date = DateTime.tryParse(item.appointmentDate);
  if (date == null) return '';
  return switch (date.weekday) {
    DateTime.monday => 'T2',
    DateTime.tuesday => 'T3',
    DateTime.wednesday => 'T4',
    DateTime.thursday => 'T5',
    DateTime.friday => 'T6',
    DateTime.saturday => 'T7',
    _ => 'CN',
  };
}

String _countdown(PatientAppointment item) {
  final start = item.scheduledStart;
  if (start == null) return '';
  final now = DateTime.now();
  final days = DateTime(
    start.year,
    start.month,
    start.day,
  ).difference(DateTime(now.year, now.month, now.day)).inDays;
  if (days <= 0) return start.isAfter(now) ? 'Hôm nay' : 'Đang diễn ra';
  if (days == 1) return 'Ngày mai';
  return 'Còn $days ngày';
}

/// Thẻ xanh đầu trang: lịch khám gần nhất, kèm hai việc cần nhất là mở vé QR và thêm vào lịch máy.
class _NextAppointmentCard extends ConsumerWidget {
  const _NextAppointmentCard({required this.appointment});

  final PatientAppointment appointment;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;
    final text = Theme.of(context).textTheme;
    final actions = ref.read(appointmentDeviceActionsProvider);
    return Semantics(
      container: true,
      label:
          'Lịch khám sắp tới, ${appointment.doctorName}, ${formatDateVi(appointment.appointmentDate)}',
      child: Material(
        color: colors.primary,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        child: InkWell(
          borderRadius: BorderRadius.circular(AppRadius.lg),
          onTap: () => context.push('/appointments/${appointment.id}'),
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Lịch khám sắp tới',
                        style: text.labelMedium?.copyWith(
                          color: colors.onPrimary,
                        ),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 3,
                      ),
                      decoration: BoxDecoration(
                        color: colors.surface,
                        borderRadius: BorderRadius.circular(AppRadius.pill),
                      ),
                      child: Text(
                        _countdown(appointment),
                        style: text.labelMedium?.copyWith(
                          color: colors.primaryDark,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  '${_weekday(appointment)}, ${formatDateVi(appointment.appointmentDate)} · ${_hhmm(appointment.startTime)}',
                  style: text.titleMedium?.copyWith(color: colors.onPrimary),
                ),
                Text(
                  appointment.doctorName.isEmpty
                      ? appointment.careUnit
                      : '${appointment.doctorName} · ${appointment.careUnit}',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: text.bodySmall?.copyWith(color: colors.onPrimary),
                ),
                const SizedBox(height: AppSpacing.sm),
                Row(
                  children: [
                    Expanded(
                      child: FilledButton.icon(
                        key: const Key('appointment-next-qr'),
                        onPressed: () => showAppointmentQrTicket(
                          context,
                          appointment: appointment,
                          payload: actions.qrPayload(appointment),
                        ),
                        style: FilledButton.styleFrom(
                          backgroundColor: colors.surface,
                          foregroundColor: colors.primaryDark,
                        ),
                        icon: const Icon(Icons.qr_code_2_rounded, size: 20),
                        label: const Text('Mở vé QR'),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.xs),
                    Expanded(
                      child: OutlinedButton.icon(
                        key: const Key('appointment-next-calendar'),
                        onPressed: () async {
                          var opened = false;
                          try {
                            opened = await actions.addToCalendar(appointment);
                          } catch (_) {
                            opened = false;
                          }
                          if (!context.mounted || opened) return;
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text(
                                'Không thể mở ứng dụng lịch trên thiết bị này.',
                              ),
                            ),
                          );
                        },
                        style: OutlinedButton.styleFrom(
                          foregroundColor: colors.onPrimary,
                          side: BorderSide(
                            color: colors.onPrimary.withValues(alpha: 0.6),
                          ),
                        ),
                        icon: const Icon(
                          Icons.edit_calendar_outlined,
                          size: 20,
                        ),
                        label: const Text('Thêm vào lịch'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

String _hhmm(String value) => value.length >= 5 ? value.substring(0, 5) : value;

/// Một lịch khám dạng hàng: cột ngày bên trái, thẻ gọn có vạch màu theo trạng thái bên phải.
class _AppointmentRow extends StatelessWidget {
  const _AppointmentRow({required this.appointment, required this.onTap});

  final PatientAppointment appointment;
  final VoidCallback onTap;

  Color _accent(AppColors colors) => switch (appointment.status.tone) {
    AppStatusTone.success => colors.success,
    AppStatusTone.warning => colors.warning,
    AppStatusTone.danger => colors.danger,
    _ => colors.info,
  };

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final text = Theme.of(context).textTheme;
    final day = appointment.appointmentDate.split('-').last;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 40,
          child: Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Column(
              children: [
                Text(
                  int.tryParse(day)?.toString() ?? day,
                  style: text.titleMedium?.copyWith(color: colors.primaryDark),
                ),
                Text(
                  _weekday(appointment),
                  style: text.labelMedium?.copyWith(color: colors.muted),
                ),
              ],
            ),
          ),
        ),
        Expanded(
          child: Semantics(
            button: true,
            label:
                '${appointment.status.label}, ${appointment.doctorName}, ${formatDateVi(appointment.appointmentDate)}',
            child: ExcludeSemantics(
              child: Material(
                color: colors.surface,
                borderRadius: BorderRadius.circular(AppRadius.md),
                clipBehavior: Clip.antiAlias,
                child: InkWell(
                  onTap: onTap,
                  child: Ink(
                    decoration: BoxDecoration(
                      border: Border(
                        left: BorderSide(color: _accent(colors), width: 4),
                      ),
                    ),
                    padding: const EdgeInsets.all(AppSpacing.sm),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                '${formatTimeRange(appointment.startTime, appointment.endTime)} · ${appointment.careUnit}',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: text.titleSmall,
                              ),
                            ),
                            const SizedBox(width: 6),
                            Flexible(
                              child: AppStatusBadge(
                                label: appointment.status.label,
                                tone: appointment.status.tone,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(
                          appointment.doctorName.isEmpty
                              ? 'Bác sĩ đang được cập nhật'
                              : appointment.doctorName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: text.bodySmall?.copyWith(color: colors.muted),
                        ),
                        if (appointment.isDependentBooking)
                          Text(
                            'Người khám: ${appointment.patientName}',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: text.labelMedium?.copyWith(
                              color: colors.primaryDark,
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
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
            onPressed: () => openBookingFromCurrentRoute(context, '/booking'),
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
