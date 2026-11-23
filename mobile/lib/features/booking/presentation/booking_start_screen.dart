import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:hospital_booking_mobile/core/widgets/app_error_banner.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/booking/application/booking_flow_controller.dart';
import 'package:hospital_booking_mobile/features/booking/application/booking_submission_controller.dart';
import 'package:hospital_booking_mobile/features/booking/domain/booking_catalog.dart';
import 'package:hospital_booking_mobile/features/booking/presentation/widgets/booking_journey_indicator.dart';
import 'package:hospital_booking_mobile/features/booking/presentation/widgets/booking_selection_widgets.dart';
import 'package:hospital_booking_mobile/features/booking/presentation/booking_date_format.dart';
import 'package:hospital_booking_mobile/features/booking/presentation/widgets/booking_calendar_dialog.dart';
import 'package:hospital_booking_mobile/features/booking/presentation/widgets/booking_pick_row.dart';
import 'package:hospital_booking_mobile/features/booking/presentation/widgets/booking_doctor_picker.dart';
import 'package:hospital_booking_mobile/features/booking/presentation/widgets/booking_package_picker.dart';
import 'package:hospital_booking_mobile/features/booking/presentation/widgets/booking_slot_picker.dart';
import 'package:hospital_booking_mobile/features/booking/presentation/widgets/booking_service_widgets.dart';
import 'package:hospital_booking_mobile/features/booking/presentation/widgets/booking_summary_widgets.dart';

import 'package:hospital_booking_mobile/core/lifecycle/foreground_poller.dart';

class BookingStartScreen extends ConsumerStatefulWidget {
  const BookingStartScreen({
    super.key,
    this.packageId,
    this.departmentId,
    this.doctorId,
    this.date,
    this.timeSlotId,
    this.returnTo,
  });

  final String? packageId;
  final String? departmentId;
  final String? doctorId;
  final String? date;
  final String? timeSlotId;
  final String? returnTo;

  @override
  ConsumerState<BookingStartScreen> createState() => _BookingStartScreenState();
}

class _BookingStartScreenState extends ConsumerState<BookingStartScreen> {
  static const _slotPollInterval = Duration(seconds: 30);
  late final ForegroundPoller _slotPoller = ForegroundPoller(
    interval: _slotPollInterval,
    onTick: _pollSlotsIfVisible,
  );

  final _slotKey = GlobalKey();

  @override
  void initState() {
    super.initState();
    _applyRoutePreset();
    _slotPoller.start();
  }

  @override
  void didUpdateWidget(covariant BookingStartScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.packageId != widget.packageId ||
        oldWidget.departmentId != widget.departmentId ||
        oldWidget.doctorId != widget.doctorId ||
        oldWidget.date != widget.date ||
        oldWidget.timeSlotId != widget.timeSlotId) {
      _applyRoutePreset();
    }
  }

  void _applyRoutePreset() {
    Future<void>.microtask(() async {
      if (!mounted) return;
      await ref
          .read(bookingFlowControllerProvider.notifier)
          .applyPreset(
            packageId: widget.packageId,
            departmentId: widget.departmentId,
            doctorId: widget.doctorId,
            date: widget.date,
            timeSlotId: widget.timeSlotId,
          );
    });
  }

  @override
  void dispose() {
    _slotPoller.stop();
    super.dispose();
  }

  /// Cuộn tới bước kế tiếp sau khi người dùng chọn xong một bước.
  void _reveal(GlobalKey key) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final target = key.currentContext;
      if (!mounted || target == null) return;
      unawaited(
        Scrollable.ensureVisible(
          target,
          duration: const Duration(milliseconds: 260),
          curve: Curves.easeOutCubic,
          alignment: 0.04,
        ),
      );
    });
  }

  void _revealNextStep(BookingSelection? previous, BookingSelection next) {
    if (previous == null) return;
    if (next.date != null && previous.date != next.date) _reveal(_slotKey);
  }

  Future<void> _pickPackage(BookingFlowState state) async {
    final controller = ref.read(bookingFlowControllerProvider.notifier);
    await showBookingPackagePicker(
      context,
      packages: state.packages,
      selectedId: state.selection.packageId,
      onSelected: (id) {
        unawaited(
          controller.selectPackage(id).then((_) {
            if (!mounted) return;
            unawaited(_pickDoctor(ref.read(bookingFlowControllerProvider)));
          }),
        );
      },
    );
  }

  Future<void> _pickDoctor(BookingFlowState state) async {
    if (!mounted) return;
    final controller = ref.read(bookingFlowControllerProvider.notifier);
    await showBookingDoctorPicker(
      context,
      doctors: state.doctors,
      departments: state.departments,
      selectedId: state.selection.doctorId,
      lockedDepartmentId: state.selectedPackage?.departmentId,
      onSelected: (id) {
        unawaited(
          controller.selectDoctor(id).then((_) {
            if (!mounted) return;
            final current = ref.read(bookingFlowControllerProvider);
            if (current.selection.date == null) {
              unawaited(_pickDate(current));
            }
          }),
        );
      },
    );
  }

  Future<void> _pickDate(BookingFlowState state) async {
    final doctorId = state.selection.doctorId;
    if (doctorId == null || !mounted) return;
    final value = await showBookingCalendar(
      context,
      doctorId: doctorId,
      selectedDate: state.selection.date,
    );
    if (value == null || !mounted) return;
    await ref.read(bookingFlowControllerProvider.notifier).selectDate(value);
  }

  void _pollSlotsIfVisible() {
    if (!mounted ||
        !TickerMode.of(context) ||
        ModalRoute.of(context)?.isCurrent != true) {
      return;
    }
    final state = ref.read(bookingFlowControllerProvider);
    if (state.selection.doctorId == null ||
        state.selection.date == null ||
        state.isSlotsLoading) {
      return;
    }
    unawaited(ref.read(bookingFlowControllerProvider.notifier).refreshSlots());
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(bookingFlowControllerProvider);
    final submission = ref.watch(bookingSubmissionControllerProvider);
    final controller = ref.read(bookingFlowControllerProvider.notifier);
    final isPackageMode =
        state.selection.serviceMode == BookingServiceMode.package;
    ref.listen(
      bookingFlowControllerProvider.select((value) => value.selection),
      (previous, next) => _revealNextStep(previous, next),
    );

    final content = Scaffold(
      appBar: AppBar(
        leading: widget.returnTo == null
            ? null
            : IconButton(
                tooltip: 'Quay lại',
                onPressed: () => context.go(widget.returnTo!),
                icon: const Icon(Icons.arrow_back_outlined),
              ),
        title: const Text('Đặt lịch khám'),
        actions: [
          if (state.selection.departmentId != null)
            TextButton(
              onPressed: controller.clearSelection,
              child: const Text('Làm lại'),
            ),
          const SizedBox(width: AppSpacing.xs),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: controller.load,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.lg,
              AppSpacing.xs,
              AppSpacing.lg,
              AppSpacing.xxl,
            ),
            children: [
              BookingJourneyIndicator(
                currentStep: 0,
                finalStepLabel:
                    ref.watch(authControllerProvider).isAuthenticated
                    ? 'Hoàn tất'
                    : 'Xác thực',
              ),
              const SizedBox(height: AppSpacing.md),
              if (submission.pending != null &&
                  submission.status != BookingSubmissionStatus.success) ...[
                const SizedBox(height: AppSpacing.md),
                BookingPendingCard(
                  bookingCode: submission.pending!.bookingCode,
                ),
              ],
              if (state.error != null) ...[
                const SizedBox(height: AppSpacing.md),
                AppErrorBanner(
                  error: state.error!,
                  onDismiss: controller.dismissError,
                ),
                const SizedBox(height: AppSpacing.xs),
                Align(
                  alignment: Alignment.centerLeft,
                  child: TextButton.icon(
                    onPressed: state.selection.date == null
                        ? controller.load
                        : controller.refreshSlots,
                    icon: const Icon(Icons.refresh_outlined),
                    label: const Text('Thử lại'),
                  ),
                ),
              ],
              const SizedBox(height: AppSpacing.lg),
              if (state.isCatalogLoading) ...[
                const AppLoadingSkeleton(height: 94),
                const SizedBox(height: AppSpacing.sm),
                const AppLoadingSkeleton(height: 190),
              ] else if (state.departments.isEmpty) ...[
                AppEmptyState(
                  icon: Icons.local_hospital_outlined,
                  title: 'Chưa có chuyên khoa khả dụng',
                  message: 'Kéo xuống để tải lại danh sách từ cơ sở khám.',
                  action: FilledButton.icon(
                    onPressed: controller.load,
                    icon: const Icon(Icons.refresh_outlined),
                    label: const Text('Tải lại'),
                  ),
                ),
              ] else ...[
                BookingServiceModePicker(
                  selected: state.selection.serviceMode,
                  onSelected: controller.selectServiceMode,
                ),
                const SizedBox(height: AppSpacing.md),
                if (isPackageMode) ...[
                  BookingPickRow(
                    key: const ValueKey('booking-pick-package'),
                    icon: Icons.health_and_safety_outlined,
                    label: 'Gói khám',
                    placeholder: 'Chọn gói khám',
                    value: state.selectedPackage?.name,
                    detail: state.selectedPackage == null
                        ? null
                        : formatVnd(state.selectedPackage!.finalPrice),
                    enabled: state.packages.isNotEmpty,
                    onTap: () => _pickPackage(state),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                ],
                BookingPickRow(
                  key: const ValueKey('booking-pick-doctor'),
                  icon: Icons.person_search_outlined,
                  label: 'Bác sĩ',
                  placeholder: 'Chọn bác sĩ',
                  value: state.selectedDoctor?.displayName,
                  detail: state.selectedDoctor == null
                      ? (isPackageMode && state.selectedPackage == null
                            ? 'Chọn gói khám trước'
                            : null)
                      : '${state.selectedDoctor!.departmentName} · '
                            '${formatVnd(state.selectedDoctor!.consultationFee)}',
                  leading: state.selectedDoctor == null
                      ? null
                      : BookingDoctorAvatar(
                          doctor: state.selectedDoctor!,
                          radius: 20,
                        ),
                  enabled: !isPackageMode || state.selectedPackage != null,
                  onTap: () => _pickDoctor(state),
                ),
                const SizedBox(height: AppSpacing.sm),
                BookingPickRow(
                  key: const ValueKey('booking-pick-date'),
                  icon: Icons.calendar_month_outlined,
                  label: 'Ngày khám',
                  placeholder: 'Chọn ngày khám',
                  value: state.selection.date == null
                      ? null
                      : displayDate(state.selection.date!),
                  detail: state.selection.doctorId == null
                      ? 'Chọn bác sĩ trước'
                      : null,
                  enabled: state.selection.doctorId != null,
                  onTap: () => _pickDate(state),
                ),
                if (state.selection.date != null) ...[
                  const SizedBox(height: AppSpacing.lg),
                  BookingStepHeader(
                    key: _slotKey,
                    number: isPackageMode ? 4 : 3,
                    title: 'Chọn khung giờ',
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  if (state.isSlotsLoading)
                    const AppLoadingSkeleton(height: 88)
                  else if (state.slots.isEmpty)
                    const BookingInlineEmpty(
                      message:
                          'Ngày này chưa còn giờ trống. Hãy chọn ngày khác.',
                    )
                  else
                    BookingSlotPicker(
                      items: state.slots,
                      selectedId: state.selection.slotId,
                      onSelected: controller.selectSlot,
                    ),
                ],
              ],
            ],
          ),
        ),
      ),
      bottomNavigationBar: state.selectedSlot == null
          ? null
          : BookingStickySummary(state: state),
    );
    final returnTo = widget.returnTo;
    if (returnTo == null) return content;
    return BackButtonListener(
      onBackButtonPressed: () async {
        context.go(returnTo);
        return true;
      },
      child: content,
    );
  }
}
