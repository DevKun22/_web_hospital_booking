import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/appointments/domain/patient_appointment.dart';

class HomeAppointmentActionCard extends StatelessWidget {
  const HomeAppointmentActionCard({
    required this.appointment,
    required this.onOpen,
    required this.onShowQr,
    super.key,
  });

  final PatientAppointment appointment;
  final VoidCallback onOpen;
  final VoidCallback onShowQr;

  @override
  Widget build(BuildContext context) {
    final copy = _HomeAppointmentCopy.from(appointment);
    return Semantics(
      container: true,
      label:
          'Lịch khám sắp tới, ${appointment.doctorName}, ${appointment.status.label}',
      child: AppSurfaceCard(
        backgroundColor: AppPalette.careMint,
        borderColor: AppPalette.brand.withValues(alpha: 0.18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  Icons.event_available_outlined,
                  size: 20,
                  color: Theme.of(context).colorScheme.primary,
                ),
                const SizedBox(width: AppSpacing.xs),
                Expanded(
                  child: Text(
                    copy.title,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                AppStatusBadge(
                  label: appointment.status.label,
                  tone: appointment.status.tone,
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              appointment.doctorName.isEmpty
                  ? 'Bác sĩ đang được cập nhật'
                  : appointment.doctorName,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: AppSpacing.xxs),
            Text(
              appointment.careUnit,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            DecoratedBox(
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surface,
                borderRadius: BorderRadius.circular(AppRadius.md),
              ),
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.sm),
                child: Row(
                  children: [
                    Icon(
                      Icons.schedule_rounded,
                      size: 19,
                      color: Theme.of(context).colorScheme.primary,
                    ),
                    const SizedBox(width: AppSpacing.xs),
                    Expanded(
                      child: Text(
                        '${formatDateVi(appointment.appointmentDate)} · ${formatTimeRange(appointment.startTime, appointment.endTime)}',
                        style: Theme.of(context).textTheme.labelLarge?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    Text(
                      appointment.bookingCode,
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            if (copy.guidance != null) ...[
              Text(
                copy.guidance!,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                  height: 1.35,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
            ],
            if (copy.showQr)
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      key: const Key('home-appointment-qr'),
                      onPressed: onShowQr,
                      icon: const Icon(Icons.qr_code_2_rounded),
                      label: const Text('Vé khám QR'),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.xs),
                  Expanded(
                    child: FilledButton.icon(
                      key: const Key('home-appointment-prepare'),
                      onPressed: onOpen,
                      icon: Icon(copy.primaryIcon),
                      label: Text(copy.primaryLabel),
                    ),
                  ),
                ],
              )
            else
              FilledButton.icon(
                key: const Key('home-appointment-follow'),
                onPressed: onOpen,
                icon: Icon(copy.primaryIcon),
                label: Text(copy.primaryLabel),
              ),
          ],
        ),
      ),
    );
  }
}

class _HomeAppointmentCopy {
  const _HomeAppointmentCopy({
    required this.title,
    required this.primaryLabel,
    required this.primaryIcon,
    required this.showQr,
    this.guidance,
  });

  factory _HomeAppointmentCopy.from(PatientAppointment appointment) {
    switch (appointment.status) {
      case PatientAppointmentStatus.pendingConfirm:
        return const _HomeAppointmentCopy(
          title: 'Lịch đang chờ xác nhận',
          primaryLabel: 'Xem lịch',
          primaryIcon: Icons.event_note_outlined,
          showQr: true,
          guidance: 'Bệnh viện đang kiểm tra yêu cầu đặt khám của bạn.',
        );
      case PatientAppointmentStatus.checkedIn:
        return const _HomeAppointmentCopy(
          title: 'Bạn đã check-in',
          primaryLabel: 'Theo dõi tiến trình',
          primaryIcon: Icons.how_to_reg_outlined,
          showQr: false,
          guidance: 'Vui lòng chờ hướng dẫn tiếp nhận tại bệnh viện.',
        );
      case PatientAppointmentStatus.inProgress:
        return const _HomeAppointmentCopy(
          title: 'Buổi khám đang diễn ra',
          primaryLabel: 'Xem tiến trình',
          primaryIcon: Icons.medical_services_outlined,
          showQr: false,
          guidance: 'Kết quả sẽ hiển thị sau khi bệnh viện phát hành.',
        );
      case PatientAppointmentStatus.confirmed:
      case PatientAppointmentStatus.rescheduled:
        final scheduledStart = appointment.scheduledStart;
        final now = DateTime.now();
        final isToday =
            scheduledStart != null &&
            scheduledStart.year == now.year &&
            scheduledStart.month == now.month &&
            scheduledStart.day == now.day;
        return _HomeAppointmentCopy(
          title: isToday ? 'Lịch khám hôm nay' : 'Lịch khám sắp tới',
          primaryLabel: isToday ? 'Sẵn sàng đi khám' : 'Chuẩn bị',
          primaryIcon: Icons.fact_check_outlined,
          showQr: true,
          guidance: isToday
              ? 'Nên có mặt trước giờ khám khoảng 15 phút.'
              : null,
        );
      default:
        return const _HomeAppointmentCopy(
          title: 'Lịch khám sắp tới',
          primaryLabel: 'Xem lịch',
          primaryIcon: Icons.event_note_outlined,
          showQr: false,
        );
    }
  }

  final String title;
  final String primaryLabel;
  final IconData primaryIcon;
  final bool showQr;
  final String? guidance;
}
