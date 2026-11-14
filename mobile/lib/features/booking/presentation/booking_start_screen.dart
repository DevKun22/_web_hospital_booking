import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/core/widgets/app_error_banner.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/booking/application/booking_flow_controller.dart';
import 'package:hospital_booking_mobile/features/booking/application/booking_submission_controller.dart';
import 'package:hospital_booking_mobile/features/booking/domain/booking_catalog.dart';
import 'package:hospital_booking_mobile/features/booking/presentation/widgets/booking_journey_indicator.dart';
import 'package:hospital_booking_mobile/features/booking/presentation/widgets/booking_selection_widgets.dart';
import 'package:hospital_booking_mobile/features/booking/presentation/widgets/booking_schedule_widgets.dart';
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

  final _doctorKey = GlobalKey();
  final _dateKey = GlobalKey();
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
    if (next.slotId != null && previous.slotId != next.slotId) return;
    if (next.date != null && previous.date != next.date) {
      _reveal(_slotKey);
    } else if (next.doctorId != null && previous.doctorId != next.doctorId) {
      _reveal(_dateKey);
    } else if (next.departmentId != null &&
        previous.departmentId != next.departmentId) {
      _reveal(_doctorKey);
    }
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
                icon: const Icon(Icons.arrow_back_rounded),
              ),
        title: const Text('Đặt lịch khám'),
        actions: [
          if (state.selection.departmentId != null)
            TextButton(
              onPressed: controller.clearSelection,
              child: const Text('Làm lại'),
            ),
          const SizedBox(width: 8),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: controller.load,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
            children: [
              BookingJourneyIndicator(
                currentStep: 0,
                finalStepLabel:
                    ref.watch(authControllerProvider).isAuthenticated
                    ? 'Hoàn tất'
                    : 'Xác thực',
              ),
              const SizedBox(height: 20),
              const AppPageIntro(
                title: 'Chọn lịch khám phù hợp',
                subtitle:
                    'Lựa chọn được lưu trên thiết bị. Khung giờ luôn được kiểm tra lại từ cơ sở khám.',
              ),
              const SizedBox(height: 18),
              if (submission.pending != null &&
                  submission.status != BookingSubmissionStatus.success) ...[
                const SizedBox(height: 16),
                BookingPendingCard(
                  bookingCode: submission.pending!.bookingCode,
                ),
              ],
              if (state.error != null) ...[
                const SizedBox(height: 16),
                AppErrorBanner(
                  error: state.error!,
                  onDismiss: controller.dismissError,
                ),
                const SizedBox(height: 8),
                Align(
                  alignment: Alignment.centerLeft,
                  child: TextButton.icon(
                    onPressed: state.selection.date == null
                        ? controller.load
                        : controller.refreshSlots,
                    icon: const Icon(Icons.refresh_rounded),
                    label: const Text('Thử lại'),
                  ),
                ),
              ],
              const SizedBox(height: 22),
              if (state.isCatalogLoading) ...[
                const AppLoadingSkeleton(height: 94),
                const SizedBox(height: 12),
                const AppLoadingSkeleton(height: 190),
              ] else if (state.departments.isEmpty) ...[
                AppEmptyState(
                  icon: Icons.local_hospital_outlined,
                  title: 'Chưa có chuyên khoa khả dụng',
                  message: 'Kéo xuống để tải lại danh sách từ cơ sở khám.',
                  action: FilledButton.icon(
                    onPressed: controller.load,
                    icon: const Icon(Icons.refresh_rounded),
                    label: const Text('Tải lại'),
                  ),
                ),
              ] else ...[
                BookingServiceModePicker(
                  selected: state.selection.serviceMode,
                  onSelected: controller.selectServiceMode,
                ),
                const SizedBox(height: 24),
                if (state.selection.serviceMode ==
                    BookingServiceMode.package) ...[
                  const BookingStepHeader(
                    number: 1,
                    title: 'Chọn gói khám',
                    subtitle:
                        'Giá và danh mục dịch vụ được đồng bộ từ cơ sở khám.',
                  ),
                  const SizedBox(height: 12),
                  if (state.selectedPackage != null)
                    BookingSelectedPackageCard(
                      packageItem: state.selectedPackage!,
                      onChange: controller.clearPackage,
                    )
                  else if (state.packages.isEmpty)
                    const BookingInlineEmpty(
                      message: 'Hiện chưa có gói khám khả dụng.',
                    )
                  else
                    ...state.packages.map(
                      (packageItem) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: BookingPackageChoiceCard(
                          packageItem: packageItem,
                          selected: packageItem.id == state.selection.packageId,
                          onSelected: () =>
                              controller.selectPackage(packageItem.id),
                        ),
                      ),
                    ),
                ],
                if (state.selection.serviceMode == BookingServiceMode.doctor ||
                    state.selectedPackage != null) ...[
                  BookingStepHeader(
                    number:
                        state.selection.serviceMode ==
                            BookingServiceMode.package
                        ? 2
                        : 1,
                    title: 'Chọn chuyên khoa',
                    subtitle: state.selectedPackage?.departmentId != null
                        ? 'Chuyên khoa được xác định theo gói khám đã chọn.'
                        : 'Bác sĩ sẽ được lọc theo chuyên khoa bạn chọn.',
                  ),
                  const SizedBox(height: 12),
                  if (state.selectedPackage?.departmentId != null)
                    BookingLockedDepartmentCard(
                      name:
                          state.selectedPackage!.departmentName ??
                          state.selectedDepartment?.name ??
                          'Chuyên khoa của gói',
                    )
                  else
                    BookingDepartmentPicker(
                      items: state.departments,
                      selectedId: state.selection.departmentId,
                      onSelected: controller.selectDepartment,
                    ),
                ],
                if (state.selection.departmentId != null) ...[
                  const SizedBox(height: 28),
                  BookingStepHeader(
                    key: _doctorKey,
                    number:
                        state.selection.serviceMode ==
                            BookingServiceMode.package
                        ? 3
                        : 2,
                    title: 'Chọn bác sĩ',
                    subtitle: 'Thông tin được đồng bộ từ hồ sơ công khai.',
                  ),
                  const SizedBox(height: 12),
                  if (state.visibleDoctors.isEmpty)
                    const BookingInlineEmpty(
                      message: 'Chuyên khoa này chưa có bác sĩ nhận lịch.',
                    )
                  else
                    ...state.visibleDoctors.map(
                      (doctor) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: BookingDoctorChoiceCard(
                          doctor: doctor,
                          selected: doctor.id == state.selection.doctorId,
                          onTap: () => controller.selectDoctor(doctor.id),
                        ),
                      ),
                    ),
                ],
                if (state.selection.doctorId != null) ...[
                  const SizedBox(height: 16),
                  BookingStepHeader(
                    key: _dateKey,
                    number:
                        state.selection.serviceMode ==
                            BookingServiceMode.package
                        ? 4
                        : 3,
                    title: 'Chọn ngày khám',
                    subtitle: 'Hiển thị 14 ngày gần nhất theo giờ Việt Nam.',
                  ),
                  const SizedBox(height: 12),
                  BookingDatePicker(
                    selectedDate: state.selection.date,
                    onSelected: controller.selectDate,
                  ),
                ],
                if (state.selection.date != null) ...[
                  const SizedBox(height: 28),
                  BookingStepHeader(
                    key: _slotKey,
                    number:
                        state.selection.serviceMode ==
                            BookingServiceMode.package
                        ? 5
                        : 4,
                    title: 'Chọn khung giờ',
                    subtitle: 'Slot có thể thay đổi nếu người khác đặt trước.',
                  ),
                  const SizedBox(height: 12),
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
