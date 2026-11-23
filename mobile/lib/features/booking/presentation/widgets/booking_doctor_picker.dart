import 'package:hospital_booking_mobile/features/catalog/domain/catalog_entities.dart';
import 'package:hospital_booking_mobile/core/widgets/app_filter_tabs.dart';
import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/design/app_design_tokens.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:hospital_booking_mobile/core/formatters/search_text.dart';
import 'package:hospital_booking_mobile/core/widgets/resized_network_image.dart';
import 'package:hospital_booking_mobile/features/booking/presentation/widgets/booking_picker_parts.dart';

/// Bảng chọn bác sĩ: tìm theo tên hoặc chuyên khoa, lọc theo chuyên khoa, tải thêm khi cuộn.
/// [lockedDepartmentId] khác null khi gói khám đã định chuyên khoa.
Future<void> showBookingDoctorPicker(
  BuildContext context, {
  required List<CatalogDoctor> doctors,
  required List<CatalogDepartment> departments,
  required ValueChanged<String> onSelected,
  String? selectedId,
  String? lockedDepartmentId,
}) => showBookingPickerSheet(
  context,
  (sheetContext, scrollController) => _DoctorPicker(
    doctors: doctors,
    departments: departments,
    selectedId: selectedId,
    lockedDepartmentId: lockedDepartmentId,
    scrollController: scrollController,
    onSelected: (id) {
      Navigator.of(sheetContext).pop();
      onSelected(id);
    },
  ),
);

class _DoctorPicker extends StatefulWidget {
  const _DoctorPicker({
    required this.doctors,
    required this.departments,
    required this.scrollController,
    required this.onSelected,
    this.selectedId,
    this.lockedDepartmentId,
  });

  final List<CatalogDoctor> doctors;
  final List<CatalogDepartment> departments;
  final ScrollController scrollController;
  final ValueChanged<String> onSelected;
  final String? selectedId;
  final String? lockedDepartmentId;

  @override
  State<_DoctorPicker> createState() => _DoctorPickerState();
}

class _DoctorPickerState extends State<_DoctorPicker> {
  String _query = '';
  String? _departmentId;
  late final List<GlobalKey> _chipKeys = List.generate(
    widget.departments.length + 1,
    (_) => GlobalKey(),
  );

  /// Thứ tự chip: "Tất cả" rồi từng chuyên khoa; vuốt ngang trên danh sách để sang chip kế.
  List<String?> get _chipIds => [null, ...widget.departments.map((d) => d.id)];

  void _selectChip(int index) {
    final ids = _chipIds;
    if (index < 0 || index >= ids.length) return;
    setState(() => _departmentId = ids[index]);
    if (widget.scrollController.hasClients) widget.scrollController.jumpTo(0);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final target = _chipKeys[index].currentContext;
      if (target == null || !mounted) return;
      Scrollable.ensureVisible(
        target,
        duration: const Duration(milliseconds: 240),
        curve: Curves.easeOutCubic,
        alignment: 0.5,
      );
    });
  }

  void _onSwipe(DragEndDetails details) {
    final velocity = details.primaryVelocity ?? 0;
    if (velocity.abs() < 350) return;
    final current = _chipIds.indexOf(_departmentId);
    _selectChip(current + (velocity < 0 ? 1 : -1));
  }

  @override
  void initState() {
    super.initState();
    _departmentId = widget.lockedDepartmentId;
  }

  List<CatalogDoctor> get _filtered => widget.doctors
      .where((doctor) {
        if (_departmentId != null && doctor.departmentId != _departmentId) {
          return false;
        }
        return matchesSearch(
          '${doctor.displayName} ${doctor.departmentName} '
          '${doctor.specialization ?? ''}',
          _query,
        );
      })
      .toList(growable: false);

  @override
  Widget build(BuildContext context) {
    final locked = widget.lockedDepartmentId != null;
    final filtered = _filtered;
    final text = Theme.of(context).textTheme;
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.page,
            0,
            AppSpacing.page,
            AppSpacing.xs,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Chọn bác sĩ', style: text.titleMedium),
              const SizedBox(height: AppSpacing.xs),
              BookingSearchField(
                hint: 'Tìm tên bác sĩ hoặc chuyên khoa',
                onChanged: (value) => setState(() => _query = value),
              ),
            ],
          ),
        ),
        if (!locked && widget.departments.length > 1)
          SizedBox(
            height: 44,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.page),
              children: [
                AppFilterChip(
                  key: _chipKeys[0],
                  label: 'Tất cả',
                  selected: _departmentId == null,
                  onTap: () => _selectChip(0),
                ),
                for (var i = 0; i < widget.departments.length; i += 1)
                  AppFilterChip(
                    key: _chipKeys[i + 1],
                    label: widget.departments[i].name,
                    selected: _departmentId == widget.departments[i].id,
                    onTap: () => _selectChip(i + 1),
                  ),
              ],
            ),
          ),
        Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.page,
            AppSpacing.xxs,
            AppSpacing.page,
            AppSpacing.xxs,
          ),
          child: Align(
            alignment: Alignment.centerLeft,
            child: Text(
              locked
                  ? '${filtered.length} bác sĩ thuộc chuyên khoa của gói'
                  : '${filtered.length} bác sĩ',
              style: text.labelMedium?.copyWith(color: context.colors.muted),
            ),
          ),
        ),
        Expanded(
          child: GestureDetector(
            behavior: HitTestBehavior.translucent,
            onHorizontalDragEnd: locked ? null : _onSwipe,
            child: BookingPagedList<CatalogDoctor>(
              items: filtered,
              scrollController: widget.scrollController,
              emptyMessage: 'Không tìm thấy bác sĩ phù hợp. Thử từ khóa khác.',
              itemBuilder: (context, doctor) => _DoctorTile(
                doctor: doctor,
                selected: doctor.id == widget.selectedId,
                onTap: () => widget.onSelected(doctor.id),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _DoctorTile extends StatelessWidget {
  const _DoctorTile({
    required this.doctor,
    required this.selected,
    required this.onTap,
  });

  final CatalogDoctor doctor;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final text = Theme.of(context).textTheme;
    final subtitle =
        distinctSpecialization(doctor.specialization, doctor.departmentName) ??
        doctor.departmentName;
    return Material(
      color: selected ? colors.primarySoft : colors.surface,
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: InkWell(
        key: ValueKey('booking-doctor-${doctor.id}'),
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        child: Ink(
          padding: const EdgeInsets.all(AppSpacing.sm),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadius.lg),
            border: Border.all(
              color: selected ? colors.primary : colors.border,
              width: selected ? 1.5 : 1,
            ),
          ),
          child: Row(
            children: [
              BookingDoctorAvatar(doctor: doctor, radius: 26),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      doctor.displayName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: text.titleSmall,
                    ),
                    const SizedBox(height: AppSpacing.hair),
                    Text(
                      subtitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: text.bodySmall?.copyWith(color: colors.muted),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Wrap(
                      spacing: AppSpacing.xs,
                      runSpacing: 4,
                      children: [
                        BookingMiniChip(
                          label: formatVnd(doctor.consultationFee),
                          background: colors.primarySoft,
                          foreground: colors.primaryDark,
                        ),
                        if (doctor.experience != null)
                          BookingMiniChip(
                            label: '${doctor.experience} năm kinh nghiệm',
                            background: colors.infoContainer,
                            foreground: colors.info,
                          ),
                      ],
                    ),
                  ],
                ),
              ),
              if (selected)
                Icon(Icons.check_circle_outlined, color: colors.primary),
            ],
          ),
        ),
      ),
    );
  }
}

/// Ảnh đại diện bác sĩ; thiếu ảnh thì hiện chữ cái đầu của tên.
class BookingDoctorAvatar extends StatelessWidget {
  const BookingDoctorAvatar({
    super.key,
    required this.doctor,
    required this.radius,
  });

  final CatalogDoctor doctor;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final hasImage = doctor.avatar?.trim().isNotEmpty == true;
    final initial = doctor.fullName.trim().isEmpty
        ? '?'
        : doctor.fullName.trim().split(RegExp(r'\s+')).last[0].toUpperCase();
    return CircleAvatar(
      radius: radius,
      backgroundColor: colors.primarySoft,
      backgroundImage: resizedNetworkImage(
        context,
        doctor.avatar,
        logicalWidth: radius * 2,
        logicalHeight: radius * 2,
      ),
      child: hasImage
          ? null
          : Text(
              initial,
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                color: colors.primaryDark,
                fontWeight: AppFontWeight.strong,
              ),
            ),
    );
  }
}
