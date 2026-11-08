import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/features/notifications/presentation/notification_type_visuals.dart';
import 'package:hospital_booking_mobile/features/appointments/presentation/appointment_status_visuals.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/appointments/application/appointment_device_actions.dart';
import 'package:hospital_booking_mobile/features/appointments/domain/patient_appointment.dart';
import 'package:hospital_booking_mobile/features/appointments/presentation/widgets/appointment_qr_ticket.dart';
import 'package:hospital_booking_mobile/features/notifications/domain/patient_notification.dart';
import 'package:hospital_booking_mobile/core/errors/swallowed_error.dart';

class AppointmentJourneyTimeline extends StatelessWidget {
  const AppointmentJourneyTimeline({super.key, required this.status});

  final PatientAppointmentStatus status;

  @override
  Widget build(BuildContext context) {
    final cancelled =
        status == PatientAppointmentStatus.cancelledByPatient ||
        status == PatientAppointmentStatus.cancelledByDoctor ||
        status == PatientAppointmentStatus.cancelledByAdmin ||
        status == PatientAppointmentStatus.noShow;
    final currentIndex = switch (status) {
      PatientAppointmentStatus.pendingOtp ||
      PatientAppointmentStatus.pendingConfirm => 0,
      PatientAppointmentStatus.confirmed ||
      PatientAppointmentStatus.rescheduled => 1,
      PatientAppointmentStatus.checkedIn => 2,
      PatientAppointmentStatus.inProgress => 3,
      PatientAppointmentStatus.completed => 4,
      _ => 0,
    };
    const steps = [
      ('Đặt lịch', Icons.event_available_outlined),
      ('Xác nhận', Icons.verified_outlined),
      ('Check-in', Icons.qr_code_scanner_rounded),
      ('Khám', Icons.medical_services_outlined),
      ('Hoàn tất', Icons.task_alt_outlined),
    ];
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Hành trình lịch khám',
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 16),
            if (cancelled)
              AppStatusBadge(
                label: status.label,
                tone: AppStatusTone.danger,
                icon: status.icon,
              )
            else
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (var index = 0; index < steps.length; index++)
                    Expanded(
                      child: Column(
                        children: [
                          Row(
                            children: [
                              if (index > 0)
                                Expanded(
                                  child: Container(
                                    height: 2,
                                    color: index <= currentIndex
                                        ? Theme.of(context).colorScheme.primary
                                        : Theme.of(
                                            context,
                                          ).colorScheme.outlineVariant,
                                  ),
                                ),
                              CircleAvatar(
                                radius: 15,
                                backgroundColor: index <= currentIndex
                                    ? Theme.of(context).colorScheme.primary
                                    : Theme.of(
                                        context,
                                      ).colorScheme.surfaceContainerHighest,
                                foregroundColor: index <= currentIndex
                                    ? Theme.of(context).colorScheme.onPrimary
                                    : Theme.of(
                                        context,
                                      ).colorScheme.onSurfaceVariant,
                                child: Icon(steps[index].$2, size: 16),
                              ),
                              if (index < steps.length - 1)
                                Expanded(
                                  child: Container(
                                    height: 2,
                                    color: index < currentIndex
                                        ? Theme.of(context).colorScheme.primary
                                        : Theme.of(
                                            context,
                                          ).colorScheme.outlineVariant,
                                  ),
                                ),
                            ],
                          ),
                          const SizedBox(height: 7),
                          Text(
                            steps[index].$1,
                            textAlign: TextAlign.center,
                            maxLines: 2,
                            style: Theme.of(context).textTheme.labelSmall
                                ?.copyWith(
                                  fontWeight: index == currentIndex
                                      ? FontWeight.w800
                                      : FontWeight.w500,
                                ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
          ],
        ),
      ),
    );
  }
}

class AppointmentVisitActions extends ConsumerWidget {
  const AppointmentVisitActions({super.key, required this.appointment});

  final PatientAppointment appointment;

  @override
  Widget build(BuildContext context, WidgetRef ref) => AppSurfaceCard(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Tiện ích trước khi khám',
          style: Theme.of(
            context,
          ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                key: const Key('appointment-add-calendar'),
                onPressed: () => _addToCalendar(context, ref),
                icon: const Icon(Icons.edit_calendar_outlined),
                label: const Text('Thêm vào lịch'),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: FilledButton.icon(
                key: const Key('appointment-show-qr'),
                onPressed: () => _showQr(context, ref),
                icon: const Icon(Icons.qr_code_2_rounded),
                label: const Text('Vé khám QR'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Text(
          'QR chứa mã tham chiếu của lịch khám; nhân viên tiếp nhận vẫn xác minh và cập nhật check-in trên hệ thống.',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
        ),
      ],
    ),
  );

  Future<void> _addToCalendar(BuildContext context, WidgetRef ref) async {
    var opened = false;
    try {
      opened = await ref
          .read(appointmentDeviceActionsProvider)
          .addToCalendar(appointment);
    } catch (error) {
      logSwallowedError('appointment_visit_widgets', error);
      opened = false;
    }
    if (!context.mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(
            opened
                ? 'Đã mở lịch thiết bị. Hãy xác nhận lưu và chọn nhắc lịch phù hợp.'
                : 'Không thể mở ứng dụng lịch trên thiết bị này.',
          ),
        ),
      );
  }

  Future<void> _showQr(BuildContext context, WidgetRef ref) =>
      showAppointmentQrTicket(
        context,
        appointment: appointment,
        payload: ref
            .read(appointmentDeviceActionsProvider)
            .qrPayload(appointment),
      );
}

class AppointmentNotificationHistoryNotice extends StatelessWidget {
  const AppointmentNotificationHistoryNotice({
    super.key,
    required this.type,
    this.publishedAt,
  });

  final PatientNotificationType type;
  final DateTime? publishedAt;

  @override
  Widget build(BuildContext context) {
    final eventTime = publishedAt == null
        ? null
        : '${formatDateVi(_dateOnly(publishedAt!))} lúc ${_timeOfDay(publishedAt!)}';
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: type.background,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: type.foreground.withValues(alpha: 0.2)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.history_rounded, color: type.foreground),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  eventTime == null
                      ? 'Mở từ thông báo: ${type.historyLabel}'
                      : '${type.historyLabel} · $eventTime',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    color: type.foreground,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 5),
                Text(
                  'Đây là thông báo tại thời điểm được gửi. Thông tin bên dưới là trạng thái mới nhất và có thể đã thay đổi sau đó.',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

String _dateOnly(DateTime value) =>
    '${value.year.toString().padLeft(4, '0')}-'
    '${value.month.toString().padLeft(2, '0')}-'
    '${value.day.toString().padLeft(2, '0')}';

String _timeOfDay(DateTime value) =>
    '${value.hour.toString().padLeft(2, '0')}:'
    '${value.minute.toString().padLeft(2, '0')}';

class AppointmentCancellationSheet extends StatefulWidget {
  const AppointmentCancellationSheet({super.key, required this.appointment});

  final PatientAppointment appointment;

  @override
  State<AppointmentCancellationSheet> createState() =>
      _CancellationSheetState();
}

class _CancellationSheetState extends State<AppointmentCancellationSheet> {
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
