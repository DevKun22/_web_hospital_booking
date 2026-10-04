import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:hospital_booking_mobile/core/widgets/app_error_banner.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/appointments/application/appointments_controller.dart';
import 'package:hospital_booking_mobile/features/appointments/domain/patient_appointment.dart';

class AppointmentDetailScreen extends ConsumerWidget {
  const AppointmentDetailScreen({required this.appointmentId, super.key});

  final String appointmentId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail = ref.watch(appointmentDetailProvider(appointmentId));
    final listState = ref.watch(appointmentsControllerProvider);
    final isCancelling = listState.cancellingId == appointmentId;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Chi tiết lịch khám'),
        actions: [
          IconButton(
            tooltip: 'Làm mới',
            onPressed: () =>
                ref.invalidate(appointmentDetailProvider(appointmentId)),
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: SafeArea(
        child: detail.when(
          loading: () => const _DetailLoading(),
          error: (error, _) => _DetailError(
            error: error is ApiException
                ? error
                : const ApiException(
                    kind: ApiErrorKind.unknown,
                    message: 'Không tải được chi tiết lịch khám.',
                  ),
            onRetry: () =>
                ref.invalidate(appointmentDetailProvider(appointmentId)),
          ),
          data: (appointment) => RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(appointmentDetailProvider(appointmentId));
              await ref.read(appointmentDetailProvider(appointmentId).future);
            },
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
              children: [
                _StatusHeader(appointment: appointment),
                if (listState.error != null) ...[
                  const SizedBox(height: 14),
                  AppErrorBanner(
                    error: listState.error!,
                    onDismiss: ref
                        .read(appointmentsControllerProvider.notifier)
                        .dismissError,
                  ),
                ],
                const SizedBox(height: 14),
                _AppointmentInformation(appointment: appointment),
                const SizedBox(height: 14),
                _PriceInformation(appointment: appointment),
                if (appointment.reason != null) ...[
                  const SizedBox(height: 14),
                  _InformationCard(
                    title: 'Lý do khám',
                    icon: Icons.notes_rounded,
                    children: [Text(appointment.reason!)],
                  ),
                ],
                if (appointment.cancelledReason != null) ...[
                  const SizedBox(height: 14),
                  _InformationCard(
                    title: 'Thông tin hủy lịch',
                    icon: Icons.cancel_outlined,
                    children: [Text(appointment.cancelledReason!)],
                  ),
                ],
                if (appointment.canCancel) ...[
                  const SizedBox(height: 20),
                  OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Theme.of(context).colorScheme.error,
                    ),
                    onPressed: isCancelling
                        ? null
                        : () => _requestCancellation(context, ref, appointment),
                    icon: isCancelling
                        ? const SizedBox.square(
                            dimension: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.event_busy_outlined),
                    label: Text(
                      isCancelling ? 'Đang hủy lịch…' : 'Yêu cầu hủy lịch',
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _requestCancellation(
    BuildContext context,
    WidgetRef ref,
    PatientAppointment appointment,
  ) async {
    final reason = await _showCancellationSheet(context, appointment);
    if (reason == null || !context.mounted) return;
    final succeeded = await ref
        .read(appointmentsControllerProvider.notifier)
        .cancel(id: appointment.id, reason: reason);
    if (!context.mounted) return;
    if (!succeeded) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        const SnackBar(
          content: Text(
            'Đã hủy lịch. Khung giờ có thể được mở lại cho người khác.',
          ),
        ),
      );
  }

  Future<String?> _showCancellationSheet(
    BuildContext context,
    PatientAppointment appointment,
  ) => showModalBottomSheet<String>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (_) => _CancellationSheet(appointment: appointment),
  );
}

class _CancellationSheet extends StatefulWidget {
  const _CancellationSheet({required this.appointment});

  final PatientAppointment appointment;

  @override
  State<_CancellationSheet> createState() => _CancellationSheetState();
}

class _CancellationSheetState extends State<_CancellationSheet> {
  final _reasonController = TextEditingController();
  String? _validationMessage;

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.fromLTRB(
      20,
      16,
      20,
      20 + MediaQuery.viewInsetsOf(context).bottom,
    ),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Center(
          child: Container(
            width: 42,
            height: 4,
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.outline,
              borderRadius: BorderRadius.circular(999),
            ),
          ),
        ),
        const SizedBox(height: 18),
        Text(
          'Xác nhận hủy lịch',
          style: Theme.of(
            context,
          ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 8),
        Text(
          'Lịch ${widget.appointment.bookingCode} · ${formatDateVi(widget.appointment.appointmentDate)} lúc ${formatTimeRange(widget.appointment.startTime, widget.appointment.endTime)} sẽ bị hủy và không thể hoàn tác.',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: 16),
        TextField(
          controller: _reasonController,
          autofocus: true,
          minLines: 3,
          maxLines: 5,
          maxLength: 500,
          decoration: InputDecoration(
            labelText: 'Lý do hủy lịch',
            hintText: 'Ví dụ: Tôi có việc đột xuất',
            errorText: _validationMessage,
            alignLabelWithHint: true,
          ),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Giữ lịch'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: Theme.of(context).colorScheme.error,
                  foregroundColor: Theme.of(context).colorScheme.onError,
                ),
                onPressed: () {
                  final value = _reasonController.text.trim();
                  if (value.length < 3) {
                    setState(() {
                      _validationMessage =
                          'Vui lòng nhập lý do có ít nhất 3 ký tự.';
                    });
                    return;
                  }
                  Navigator.pop(context, value);
                },
                child: const Text('Xác nhận hủy'),
              ),
            ),
          ],
        ),
      ],
    ),
  );
}

class _StatusHeader extends StatelessWidget {
  const _StatusHeader({required this.appointment});

  final PatientAppointment appointment;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(18),
    decoration: BoxDecoration(
      color: Theme.of(context).colorScheme.surface,
      borderRadius: BorderRadius.circular(20),
      border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: AppStatusBadge(
                label: appointment.status.label,
                tone: appointment.status.tone,
                icon: appointment.status.icon,
              ),
            ),
            Text(
              appointment.bookingCode,
              style: Theme.of(
                context,
              ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
            ),
          ],
        ),
        const SizedBox(height: 14),
        Text(
          appointment.status.guidance,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            color: Theme.of(context).colorScheme.onSurfaceVariant,
            height: 1.45,
          ),
        ),
      ],
    ),
  );
}

class _AppointmentInformation extends StatelessWidget {
  const _AppointmentInformation({required this.appointment});

  final PatientAppointment appointment;

  @override
  Widget build(BuildContext context) => _InformationCard(
    title: 'Thông tin lịch khám',
    icon: Icons.event_note_outlined,
    children: [
      _DetailRow(
        icon: Icons.calendar_today_outlined,
        label: 'Ngày khám',
        value: formatDateVi(appointment.appointmentDate),
      ),
      _DetailRow(
        icon: Icons.schedule_outlined,
        label: 'Khung giờ',
        value: formatTimeRange(appointment.startTime, appointment.endTime),
      ),
      _DetailRow(
        icon: Icons.medical_services_outlined,
        label: 'Bác sĩ',
        value: appointment.doctorName.isEmpty
            ? 'Đang cập nhật'
            : appointment.doctorName,
      ),
      if (appointment.specialization != null)
        _DetailRow(
          icon: Icons.workspace_premium_outlined,
          label: 'Chuyên môn',
          value: appointment.specialization!,
        ),
      _DetailRow(
        icon: Icons.local_hospital_outlined,
        label: appointment.packageName == null ? 'Chuyên khoa' : 'Gói khám',
        value: appointment.careUnit.isEmpty
            ? 'Đang cập nhật'
            : appointment.careUnit,
        showDivider: false,
      ),
    ],
  );
}

class _PriceInformation extends StatelessWidget {
  const _PriceInformation({required this.appointment});

  final PatientAppointment appointment;

  @override
  Widget build(BuildContext context) => _InformationCard(
    title: 'Chi phí dự kiến',
    icon: Icons.payments_outlined,
    children: [
      if (appointment.estimatedPrice > 0)
        _PriceRow(
          label: 'Phí khám',
          value: formatVnd(appointment.estimatedPrice),
        ),
      if (appointment.serviceFee > 0)
        _PriceRow(
          label: 'Phí dịch vụ',
          value: formatVnd(appointment.serviceFee),
        ),
      if (appointment.bhytDiscount > 0)
        _PriceRow(
          label: 'Hỗ trợ BHYT',
          value: '-${formatVnd(appointment.bhytDiscount)}',
        ),
      _PriceRow(
        label: 'Tạm tính',
        value: formatVnd(appointment.finalAmount),
        emphasized: true,
      ),
      const SizedBox(height: 6),
      Text(
        'Số tiền có thể thay đổi theo chỉ định thực tế tại bệnh viện.',
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
          color: Theme.of(context).colorScheme.onSurfaceVariant,
        ),
      ),
    ],
  );
}

class _InformationCard extends StatelessWidget {
  const _InformationCard({
    required this.title,
    required this.icon,
    required this.children,
  });

  final String title;
  final IconData icon;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Card(
    margin: EdgeInsets.zero,
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: Theme.of(context).colorScheme.primary),
              const SizedBox(width: 10),
              Text(
                title,
                style: Theme.of(
                  context,
                ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
              ),
            ],
          ),
          const SizedBox(height: 14),
          ...children,
        ],
      ),
    ),
  );
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({
    required this.icon,
    required this.label,
    required this.value,
    this.showDivider = true,
  });

  final IconData icon;
  final String label;
  final String value;
  final bool showDivider;

  @override
  Widget build(BuildContext context) => Column(
    children: [
      Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            icon,
            size: 20,
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 2),
                Text(value, style: Theme.of(context).textTheme.bodyLarge),
              ],
            ),
          ),
        ],
      ),
      if (showDivider) ...[
        const SizedBox(height: 12),
        const Divider(),
        const SizedBox(height: 12),
      ],
    ],
  );
}

class _PriceRow extends StatelessWidget {
  const _PriceRow({
    required this.label,
    required this.value,
    this.emphasized = false,
  });

  final String label;
  final String value;
  final bool emphasized;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: Row(
      children: [
        Expanded(child: Text(label)),
        Text(
          value,
          style: Theme.of(context).textTheme.bodyLarge?.copyWith(
            color: emphasized ? Theme.of(context).colorScheme.primary : null,
            fontWeight: emphasized ? FontWeight.w800 : FontWeight.w600,
          ),
        ),
      ],
    ),
  );
}

class _DetailLoading extends StatelessWidget {
  const _DetailLoading();

  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(16),
    children: const [
      AppLoadingSkeleton(height: 140),
      SizedBox(height: 14),
      AppLoadingSkeleton(height: 330),
      SizedBox(height: 14),
      AppLoadingSkeleton(height: 180),
    ],
  );
}

class _DetailError extends StatelessWidget {
  const _DetailError({required this.error, required this.onRetry});

  final ApiException error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => ListView(
    physics: const AlwaysScrollableScrollPhysics(),
    padding: const EdgeInsets.all(20),
    children: [
      AppEmptyState(
        icon: Icons.event_busy_outlined,
        title: 'Không tải được lịch khám',
        message: error.message,
        action: FilledButton.icon(
          onPressed: onRetry,
          icon: const Icon(Icons.refresh_rounded),
          label: const Text('Thử lại'),
        ),
      ),
    ],
  );
}
