import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/app/theme/app_theme.dart';
import 'package:hospital_booking_mobile/core/widgets/app_error_banner.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/core/widgets/resized_network_image.dart';
import 'package:hospital_booking_mobile/features/booking/application/booking_flow_controller.dart';
import 'package:hospital_booking_mobile/features/booking/application/booking_submission_controller.dart';
import 'package:hospital_booking_mobile/features/booking/domain/booking_catalog.dart';
import 'package:hospital_booking_mobile/features/packages/domain/medical_package.dart';

class BookingStartScreen extends ConsumerStatefulWidget {
  const BookingStartScreen({
    super.key,
    this.packageId,
    this.departmentId,
    this.doctorId,
    this.date,
    this.timeSlotId,
  });

  final String? packageId;
  final String? departmentId;
  final String? doctorId;
  final String? date;
  final String? timeSlotId;

  @override
  ConsumerState<BookingStartScreen> createState() => _BookingStartScreenState();
}

class _BookingStartScreenState extends ConsumerState<BookingStartScreen> {
  @override
  void initState() {
    super.initState();
    Future<void>.microtask(
      () => ref
          .read(bookingFlowControllerProvider.notifier)
          .applyPreset(
            packageId: widget.packageId,
            departmentId: widget.departmentId,
            doctorId: widget.doctorId,
            date: widget.date,
            timeSlotId: widget.timeSlotId,
          ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(bookingFlowControllerProvider);
    final submission = ref.watch(bookingSubmissionControllerProvider);
    final controller = ref.read(bookingFlowControllerProvider.notifier);

    return Scaffold(
      appBar: AppBar(
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
              Text(
                'Chọn lịch khám phù hợp',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Lựa chọn được lưu trên thiết bị. Khung giờ luôn được kiểm tra lại từ bệnh viện.',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 18),
              _ProgressStrip(state: state),
              if (submission.pending != null &&
                  submission.status != BookingSubmissionStatus.success) ...[
                const SizedBox(height: 16),
                _PendingBookingCard(
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
                  message: 'Kéo xuống để tải lại danh sách từ bệnh viện.',
                  action: FilledButton.icon(
                    onPressed: controller.load,
                    icon: const Icon(Icons.refresh_rounded),
                    label: const Text('Tải lại'),
                  ),
                ),
              ] else ...[
                _ServiceModePicker(
                  selected: state.selection.serviceMode,
                  onSelected: controller.selectServiceMode,
                ),
                const SizedBox(height: 24),
                if (state.selection.serviceMode ==
                    BookingServiceMode.package) ...[
                  const _StepHeader(
                    number: 1,
                    title: 'Chọn gói khám',
                    subtitle:
                        'Giá và danh mục dịch vụ được đồng bộ từ bệnh viện.',
                  ),
                  const SizedBox(height: 12),
                  if (state.selectedPackage != null)
                    _SelectedPackageCard(
                      packageItem: state.selectedPackage!,
                      onChange: controller.clearPackage,
                    )
                  else if (state.packages.isEmpty)
                    const _InlineEmpty(
                      message: 'Hiện chưa có gói khám khả dụng.',
                    )
                  else
                    ...state.packages.map(
                      (packageItem) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: _PackageChoiceCard(
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
                  _StepHeader(
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
                    _LockedDepartmentCard(
                      name:
                          state.selectedPackage!.departmentName ??
                          state.selectedDepartment?.name ??
                          'Chuyên khoa của gói',
                    )
                  else
                    _DepartmentPicker(
                      items: state.departments,
                      selectedId: state.selection.departmentId,
                      onSelected: controller.selectDepartment,
                    ),
                ],
                if (state.selection.departmentId != null) ...[
                  const SizedBox(height: 28),
                  _StepHeader(
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
                    const _InlineEmpty(
                      message: 'Chuyên khoa này chưa có bác sĩ nhận lịch.',
                    )
                  else
                    ...state.visibleDoctors.map(
                      (doctor) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: _DoctorChoiceCard(
                          doctor: doctor,
                          selected: doctor.id == state.selection.doctorId,
                          onTap: () => controller.selectDoctor(doctor.id),
                        ),
                      ),
                    ),
                ],
                if (state.selection.doctorId != null) ...[
                  const SizedBox(height: 16),
                  _StepHeader(
                    number:
                        state.selection.serviceMode ==
                            BookingServiceMode.package
                        ? 4
                        : 3,
                    title: 'Chọn ngày khám',
                    subtitle: 'Hiển thị 14 ngày gần nhất theo giờ Việt Nam.',
                  ),
                  const SizedBox(height: 12),
                  _DatePicker(
                    selectedDate: state.selection.date,
                    onSelected: controller.selectDate,
                  ),
                ],
                if (state.selection.date != null) ...[
                  const SizedBox(height: 28),
                  _StepHeader(
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
                    const _InlineEmpty(
                      message:
                          'Ngày này chưa còn giờ trống. Hãy chọn ngày khác.',
                    )
                  else
                    _SlotPicker(
                      items: state.slots,
                      selectedId: state.selection.slotId,
                      onSelected: controller.selectSlot,
                    ),
                ],
                if (state.selectedSlot != null) ...[
                  const SizedBox(height: 28),
                  _SelectionSummary(state: state),
                ],
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _ProgressStrip extends StatelessWidget {
  const _ProgressStrip({required this.state});

  final BookingFlowState state;

  @override
  Widget build(BuildContext context) {
    final completed = <bool>[
      if (state.selection.serviceMode == BookingServiceMode.package)
        state.selection.packageId != null,
      state.selection.departmentId != null,
      state.selection.doctorId != null,
      state.selection.date != null,
      state.selection.slotId != null,
    ];
    return Row(
      children: List.generate(completed.length, (index) {
        final active = completed[index];
        return Expanded(
          child: Padding(
            padding: EdgeInsets.only(
              right: index == completed.length - 1 ? 0 : 6,
            ),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              height: 5,
              decoration: BoxDecoration(
                color: active
                    ? AppTheme.primary
                    : Theme.of(context).colorScheme.outlineVariant,
                borderRadius: BorderRadius.circular(999),
              ),
            ),
          ),
        );
      }),
    );
  }
}

class _ServiceModePicker extends StatelessWidget {
  const _ServiceModePicker({required this.selected, required this.onSelected});

  final BookingServiceMode selected;
  final ValueChanged<BookingServiceMode> onSelected;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text('Hình thức khám', style: Theme.of(context).textTheme.titleMedium),
      const SizedBox(height: 10),
      SizedBox(
        width: double.infinity,
        child: SegmentedButton<BookingServiceMode>(
          showSelectedIcon: false,
          segments: const [
            ButtonSegment(
              value: BookingServiceMode.doctor,
              icon: Icon(Icons.person_search_outlined),
              label: Text('Theo bác sĩ'),
            ),
            ButtonSegment(
              value: BookingServiceMode.package,
              icon: Icon(Icons.health_and_safety_outlined),
              label: Text('Theo gói khám'),
            ),
          ],
          selected: {selected},
          onSelectionChanged: (values) => onSelected(values.first),
        ),
      ),
    ],
  );
}

class _PackageChoiceCard extends StatelessWidget {
  const _PackageChoiceCard({
    required this.packageItem,
    required this.selected,
    required this.onSelected,
  });

  final MedicalPackage packageItem;
  final bool selected;
  final VoidCallback onSelected;

  @override
  Widget build(BuildContext context) => Card(
    color: selected
        ? Theme.of(context).colorScheme.primaryContainer
        : Colors.white,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(18),
      side: BorderSide(
        color: selected ? AppTheme.primary : AppTheme.softBorder,
        width: selected ? 1.5 : 1,
      ),
    ),
    child: Padding(
      padding: const EdgeInsets.all(15),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                backgroundColor: selected
                    ? Colors.white
                    : Theme.of(context).colorScheme.primaryContainer,
                child: const Icon(Icons.health_and_safety_outlined),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      packageItem.name,
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                    if (packageItem.summary != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        packageItem.summary!,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              Icon(
                selected
                    ? Icons.check_circle_rounded
                    : Icons.radio_button_unchecked_rounded,
                color: selected
                    ? AppTheme.primary
                    : Theme.of(context).colorScheme.outline,
              ),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Text(
                _formatVnd(packageItem.finalPrice),
                style: const TextStyle(
                  color: AppTheme.primaryDark,
                  fontWeight: FontWeight.w800,
                ),
              ),
              if (packageItem.isBhytSupport)
                const AppStatusBadge(
                  label: 'HỖ TRỢ BHYT',
                  tone: AppStatusTone.info,
                ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              if (packageItem.slug != null)
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => context.push(
                      '/packages/${Uri.encodeComponent(packageItem.slug!)}',
                    ),
                    child: const Text('Xem chi tiết'),
                  ),
                ),
              if (packageItem.slug != null) const SizedBox(width: 10),
              Expanded(
                child: FilledButton(
                  onPressed: onSelected,
                  child: Text(selected ? 'Đã chọn' : 'Chọn gói'),
                ),
              ),
            ],
          ),
        ],
      ),
    ),
  );
}

class _SelectedPackageCard extends StatelessWidget {
  const _SelectedPackageCard({
    required this.packageItem,
    required this.onChange,
  });

  final MedicalPackage packageItem;
  final VoidCallback onChange;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: Theme.of(context).colorScheme.primaryContainer,
      borderRadius: BorderRadius.circular(18),
      border: Border.all(color: AppTheme.primary, width: 1.5),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.check_circle_rounded, color: AppTheme.primary),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    packageItem.name,
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _formatVnd(packageItem.finalPrice),
                    style: const TextStyle(
                      color: AppTheme.primaryDark,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
            const AppStatusBadge(label: 'ĐÃ CHỌN', tone: AppStatusTone.success),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            if (packageItem.slug != null)
              Expanded(
                child: OutlinedButton(
                  onPressed: () => context.push(
                    '/packages/${Uri.encodeComponent(packageItem.slug!)}',
                  ),
                  child: const Text('Xem chi tiết'),
                ),
              ),
            if (packageItem.slug != null) const SizedBox(width: 10),
            Expanded(
              child: TextButton.icon(
                onPressed: onChange,
                icon: const Icon(Icons.swap_horiz_rounded),
                label: const Text('Đổi gói'),
              ),
            ),
          ],
        ),
      ],
    ),
  );
}

class _LockedDepartmentCard extends StatelessWidget {
  const _LockedDepartmentCard({required this.name});

  final String name;

  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: Theme.of(context).colorScheme.surfaceContainerHighest,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
    ),
    child: Row(
      children: [
        const Icon(Icons.lock_outline_rounded, color: AppTheme.primary),
        const SizedBox(width: 10),
        Expanded(
          child: Text(name, style: Theme.of(context).textTheme.titleSmall),
        ),
        const Icon(Icons.check_circle_rounded, color: AppTheme.primary),
      ],
    ),
  );
}

class _StepHeader extends StatelessWidget {
  const _StepHeader({
    required this.number,
    required this.title,
    required this.subtitle,
  });

  final int number;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      CircleAvatar(
        radius: 17,
        backgroundColor: Theme.of(context).colorScheme.primaryContainer,
        foregroundColor: Theme.of(context).colorScheme.primary,
        child: Text(
          '$number',
          style: const TextStyle(fontWeight: FontWeight.w800),
        ),
      ),
      const SizedBox(width: 10),
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 2),
            Text(
              subtitle,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    ],
  );
}

class _DepartmentPicker extends StatelessWidget {
  const _DepartmentPicker({
    required this.items,
    required this.selectedId,
    required this.onSelected,
  });

  final List<BookingDepartment> items;
  final String? selectedId;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) => Wrap(
    spacing: 8,
    runSpacing: 8,
    children: items
        .map(
          (item) => ChoiceChip(
            label: Text(item.name),
            selected: item.id == selectedId,
            onSelected: (_) => onSelected(item.id),
            avatar: const Icon(Icons.medical_services_outlined, size: 17),
          ),
        )
        .toList(growable: false),
  );
}

class _DoctorChoiceCard extends StatelessWidget {
  const _DoctorChoiceCard({
    required this.doctor,
    required this.selected,
    required this.onTap,
  });

  final BookingDoctor doctor;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Card(
    color: selected
        ? Theme.of(context).colorScheme.primaryContainer
        : Colors.white,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(18),
      side: BorderSide(
        color: selected ? AppTheme.primary : AppTheme.softBorder,
        width: selected ? 1.5 : 1,
      ),
    ),
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(18),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            CircleAvatar(
              radius: 28,
              backgroundColor: Colors.white,
              backgroundImage: resizedNetworkImage(
                context,
                doctor.avatar,
                logicalWidth: 56,
                logicalHeight: 56,
              ),
              child: doctor.avatar?.trim().isNotEmpty != true
                  ? const Icon(Icons.person_outline_rounded)
                  : null,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          doctor.displayName,
                          style: Theme.of(context).textTheme.titleSmall,
                        ),
                      ),
                      Icon(
                        selected
                            ? Icons.check_circle_rounded
                            : Icons.radio_button_unchecked_rounded,
                        color: selected
                            ? AppTheme.primary
                            : Theme.of(context).colorScheme.outline,
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    doctor.specialization ?? doctor.departmentName,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 12,
                    runSpacing: 5,
                    children: [
                      if (doctor.experience != null)
                        Text('${doctor.experience} năm kinh nghiệm'),
                      Text(
                        _formatVnd(doctor.consultationFee),
                        style: const TextStyle(
                          color: AppTheme.primaryDark,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class _DatePicker extends StatelessWidget {
  const _DatePicker({required this.selectedDate, required this.onSelected});

  final String? selectedDate;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    final dates = _nextVietnamDates(14);
    return SizedBox(
      height: 78,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: dates.length,
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final date = dates[index];
          final value = _formatApiDate(date);
          final selected = value == selectedDate;
          return InkWell(
            onTap: () => onSelected(value),
            borderRadius: BorderRadius.circular(16),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 160),
              width: 68,
              padding: const EdgeInsets.symmetric(vertical: 8),
              decoration: BoxDecoration(
                color: selected ? AppTheme.primary : Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: selected ? AppTheme.primary : AppTheme.softBorder,
                ),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    _weekdayLabel(date.weekday),
                    style: TextStyle(
                      color: selected
                          ? Colors.white
                          : Theme.of(context).colorScheme.onSurfaceVariant,
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${date.day}/${date.month}',
                    style: TextStyle(
                      color: selected ? Colors.white : AppTheme.clinicalInk,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

class _SlotPicker extends StatelessWidget {
  const _SlotPicker({
    required this.items,
    required this.selectedId,
    required this.onSelected,
  });

  final List<BookingSlot> items;
  final String? selectedId;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) => Wrap(
    spacing: 8,
    runSpacing: 8,
    children: items
        .map(
          (slot) => ChoiceChip(
            label: Text(
              '${_shortTime(slot.startTime)} – ${_shortTime(slot.endTime)}',
            ),
            selected: slot.id == selectedId,
            onSelected: (_) => onSelected(slot.id),
            avatar: const Icon(Icons.schedule_rounded, size: 17),
          ),
        )
        .toList(growable: false),
  );
}

class _SelectionSummary extends StatelessWidget {
  const _SelectionSummary({required this.state});

  final BookingFlowState state;

  @override
  Widget build(BuildContext context) {
    final department = state.selectedDepartment!;
    final doctor = state.selectedDoctor!;
    final slot = state.selectedSlot!;
    final packageItem = state.selectedPackage;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFFE4F5EF),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFBDE4D6)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const AppStatusBadge(
            label: 'ĐÃ CHỌN ĐỦ THÔNG TIN',
            tone: AppStatusTone.success,
            icon: Icons.check_circle_outline_rounded,
          ),
          const SizedBox(height: 14),
          if (packageItem != null) ...[
            Text(
              packageItem.name,
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(color: AppTheme.primaryDark),
            ),
            const SizedBox(height: 4),
            Text('Giá gói: ${_formatVnd(packageItem.finalPrice)}'),
            const Divider(height: 20),
          ],
          Text(department.name, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 4),
          Text(doctor.displayName),
          const SizedBox(height: 4),
          Text(
            '${_displayDate(slot.date)} · ${_shortTime(slot.startTime)} – ${_shortTime(slot.endTime)}',
            style: const TextStyle(
              color: AppTheme.primaryDark,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: () => context.push('/booking/patient'),
              icon: const Icon(Icons.arrow_forward_rounded),
              label: const Text('Tiếp tục nhập thông tin'),
            ),
          ),
        ],
      ),
    );
  }
}

class _PendingBookingCard extends StatelessWidget {
  const _PendingBookingCard({required this.bookingCode});

  final String bookingCode;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: Theme.of(context).colorScheme.tertiaryContainer,
      borderRadius: BorderRadius.circular(18),
    ),
    child: Row(
      children: [
        const Icon(Icons.mark_email_unread_outlined),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Lịch $bookingCode đang chờ OTP',
                style: Theme.of(context).textTheme.titleSmall,
              ),
              const SizedBox(height: 3),
              const Text('Tiếp tục xác thực trước khi hết thời gian giữ lịch.'),
            ],
          ),
        ),
        TextButton(
          onPressed: () => context.push('/booking/verify'),
          child: const Text('Tiếp tục'),
        ),
      ],
    ),
  );
}

class _InlineEmpty extends StatelessWidget {
  const _InlineEmpty({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: Theme.of(context).colorScheme.surfaceContainerHighest,
      borderRadius: BorderRadius.circular(16),
    ),
    child: Row(
      children: [
        const Icon(Icons.info_outline_rounded),
        const SizedBox(width: 10),
        Expanded(child: Text(message)),
      ],
    ),
  );
}

List<DateTime> _nextVietnamDates(int count) {
  final vietnamNow = DateTime.now().toUtc().add(const Duration(hours: 7));
  final today = DateTime(vietnamNow.year, vietnamNow.month, vietnamNow.day);
  return List.generate(count, (index) => today.add(Duration(days: index)));
}

String _formatApiDate(DateTime date) =>
    '${date.year.toString().padLeft(4, '0')}-'
    '${date.month.toString().padLeft(2, '0')}-'
    '${date.day.toString().padLeft(2, '0')}';

String _weekdayLabel(int weekday) => switch (weekday) {
  DateTime.monday => 'T2',
  DateTime.tuesday => 'T3',
  DateTime.wednesday => 'T4',
  DateTime.thursday => 'T5',
  DateTime.friday => 'T6',
  DateTime.saturday => 'T7',
  _ => 'CN',
};

String _shortTime(String value) =>
    value.length >= 5 ? value.substring(0, 5) : value;

String _displayDate(String value) {
  final parts = value.split('-');
  return parts.length == 3 ? '${parts[2]}/${parts[1]}/${parts[0]}' : value;
}

String _formatVnd(double value) {
  final digits = value.round().toString();
  final buffer = StringBuffer();
  for (var index = 0; index < digits.length; index += 1) {
    if (index > 0 && (digits.length - index) % 3 == 0) buffer.write('.');
    buffer.write(digits[index]);
  }
  return '${buffer.toString()} đ';
}
