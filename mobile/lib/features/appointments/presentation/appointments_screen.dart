import 'package:hospital_booking_mobile/features/appointments/presentation/widgets/appointment_list_widgets.dart';
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/widgets/app_error_banner.dart';
import 'package:hospital_booking_mobile/core/widgets/app_filter_tabs.dart';
import 'package:hospital_booking_mobile/core/widgets/app_route_back_scope.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/appointments/application/appointments_controller.dart';
import 'package:hospital_booking_mobile/features/appointments/domain/patient_appointment.dart';

import 'package:hospital_booking_mobile/core/lifecycle/foreground_poller.dart';

class AppointmentsScreen extends ConsumerStatefulWidget {
  const AppointmentsScreen({super.key});

  @override
  ConsumerState<AppointmentsScreen> createState() => _AppointmentsScreenState();
}

class _AppointmentsScreenState extends ConsumerState<AppointmentsScreen> {
  // Thay đổi lịch hẹn đã có thông báo đẩy báo về; thăm dò chỉ là lưới an toàn nên thưa hơn.
  static const _pollInterval = Duration(seconds: 60);
  static const _pollFreshness = Duration(seconds: 55);

  AppointmentListFilter _filter = AppointmentListFilter.upcoming;
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
            AppointmentListFilter.upcoming => !item.isHistory,
            AppointmentListFilter.history => item.isHistory,
            AppointmentListFilter.all => true,
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
            icon: const Icon(Icons.refresh_outlined),
          ),
        ],
      ),
      body: AppSwipeTabs<AppointmentListFilter>(
        items: AppointmentListFilter.values,
        selected: _filter,
        onChanged: (value) => setState(() => _filter = value),
        child: SafeArea(
          child: state.isInitialLoading && !state.hasItems
              ? const AppointmentsLoading()
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
                          AppSpacing.sm,
                        ),
                        sliver: SliverList.list(
                          children: [
                            if (next != null) ...[
                              // Thẻ dày nút và chữ: giới hạn cỡ chữ để nút không tràn ở máy đặt chữ rất lớn.
                              MediaQuery.withClampedTextScaling(
                                maxScaleFactor: 1.3,
                                child: AppointmentNextCard(appointment: next),
                              ),
                              const SizedBox(height: AppSpacing.sm),
                            ],
                            AppFilterTabs<AppointmentListFilter>(
                              items: AppointmentListFilter.values,
                              selected: _filter,
                              labelOf: (item) => item.label,
                              onChanged: (value) =>
                                  setState(() => _filter = value),
                            ),
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
                      if (visibleItems.isEmpty)
                        SliverPadding(
                          padding: const EdgeInsets.fromLTRB(
                            AppSpacing.md,
                            AppSpacing.xxs,
                            AppSpacing.md,
                            AppSpacing.xxl,
                          ),
                          sliver: SliverToBoxAdapter(
                            child: AppointmentsEmpty(filter: _filter),
                          ),
                        )
                      else
                        SliverPadding(
                          padding: const EdgeInsets.fromLTRB(
                            AppSpacing.md,
                            0,
                            AppSpacing.md,
                            AppSpacing.xl,
                          ),
                          sliver: SliverList.builder(
                            itemCount: visibleItems.length,
                            itemBuilder: (context, index) {
                              final item = visibleItems[index];
                              final previous = index == 0
                                  ? null
                                  : visibleItems[index - 1];
                              final newMonth =
                                  previous == null ||
                                  appointmentMonthKey(previous) !=
                                      appointmentMonthKey(item);
                              return Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  if (newMonth)
                                    Padding(
                                      padding: EdgeInsets.only(
                                        top: index == 0
                                            ? AppSpacing.xxs
                                            : AppSpacing.sm,
                                        bottom: AppSpacing.xs,
                                      ),
                                      child: Text(
                                        appointmentMonthLabel(item),
                                        style: Theme.of(context)
                                            .textTheme
                                            .labelMedium
                                            ?.copyWith(
                                              color: context.colors.muted,
                                              fontWeight: AppFontWeight.strong,
                                            ),
                                      ),
                                    ),
                                  AppointmentRow(
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
