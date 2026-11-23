import 'package:hospital_booking_mobile/features/appointments/presentation/appointment_labels.dart';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/features/appointments/presentation/appointment_status_visuals.dart';
import 'package:hospital_booking_mobile/app/navigation/booking_navigation.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/appointments/application/appointment_device_actions.dart';
import 'package:hospital_booking_mobile/features/appointments/domain/patient_appointment.dart';
import 'package:hospital_booking_mobile/features/appointments/presentation/widgets/appointment_qr_ticket.dart';

/// Các khối dựng danh sách Lịch hẹn: bộ lọc, thẻ lịch gần nhất, hàng lịch, trạng thái trống và đang tải.
enum AppointmentListFilter {
  upcoming('Sắp tới'),
  history('Đã qua'),
  all('Tất cả');

  const AppointmentListFilter(this.label);

  final String label;
}

String appointmentMonthKey(PatientAppointment item) =>
    item.appointmentDate.length >= 7
    ? item.appointmentDate.substring(0, 7)
    : '';

String appointmentMonthLabel(PatientAppointment item) {
  final parts = item.appointmentDate.split('-');
  return parts.length >= 2
      ? 'Tháng ${int.tryParse(parts[1]) ?? parts[1]}/${parts[0]}'
      : '';
}

/// Thẻ xanh đầu trang: lịch khám gần nhất, kèm hai việc cần nhất là mở vé QR và thêm vào lịch máy.
class AppointmentNextCard extends ConsumerWidget {
  const AppointmentNextCard({super.key, required this.appointment});

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
                        horizontal: AppSpacing.sm,
                        vertical: AppSpacing.xxs,
                      ),
                      decoration: BoxDecoration(
                        color: colors.surface,
                        borderRadius: BorderRadius.circular(AppRadius.pill),
                      ),
                      child: Text(
                        appointmentCountdown(appointment),
                        style: text.labelMedium?.copyWith(
                          color: colors.primaryDark,
                          fontWeight: AppFontWeight.strong,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  '${appointmentWeekday(appointment)}, ${formatDateVi(appointment.appointmentDate)} · ${formatTimeShort(appointment.startTime)}',
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
                        icon: const Icon(Icons.qr_code_2_outlined, size: 20),
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

/// Một lịch khám dạng hàng: cột ngày bên trái, thẻ gọn có vạch màu theo trạng thái bên phải.
class AppointmentRow extends StatelessWidget {
  const AppointmentRow({
    super.key,
    required this.appointment,
    required this.onTap,
  });

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
            padding: const EdgeInsets.only(top: AppSpacing.xs),
            child: Column(
              children: [
                Text(
                  int.tryParse(day)?.toString() ?? day,
                  style: text.titleMedium?.copyWith(color: colors.primaryDark),
                ),
                Text(
                  appointmentWeekday(appointment),
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
                                formatTimeRange(
                                  appointment.startTime,
                                  appointment.endTime,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: text.titleSmall,
                              ),
                            ),
                            const SizedBox(width: AppSpacing.xs),
                            Flexible(
                              child: AppStatusBadge(
                                label: appointment.status.label,
                                tone: appointment.status.tone,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: AppSpacing.hair),
                        Text(
                          appointment.doctorName.isEmpty
                              ? appointment.careUnit
                              : '${appointment.doctorName} · ${appointment.careUnit}',
                          maxLines: 2,
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

class AppointmentsEmpty extends StatelessWidget {
  const AppointmentsEmpty({super.key, required this.filter});

  final AppointmentListFilter filter;

  @override
  Widget build(BuildContext context) => AppEmptyState(
    icon: filter == AppointmentListFilter.history
        ? Icons.history_outlined
        : Icons.event_available_outlined,
    title: switch (filter) {
      AppointmentListFilter.upcoming => 'Chưa có lịch sắp tới',
      AppointmentListFilter.history => 'Chưa có lịch đã qua',
      AppointmentListFilter.all => 'Chưa có lịch khám',
    },
    message: filter == AppointmentListFilter.history
        ? 'Các lịch hoàn tất hoặc đã hủy sẽ xuất hiện tại đây.'
        : 'Đặt lịch với bác sĩ phù hợp và theo dõi trạng thái ngay trên ứng dụng.',
    action: filter == AppointmentListFilter.history
        ? null
        : FilledButton.icon(
            onPressed: () => openBookingFromCurrentRoute(context, '/booking'),
            icon: const Icon(Icons.add_outlined),
            label: const Text('Đặt lịch khám'),
          ),
  );
}

class AppointmentsLoading extends StatelessWidget {
  const AppointmentsLoading({super.key});

  @override
  Widget build(BuildContext context) => ListView.separated(
    padding: const EdgeInsets.all(AppSpacing.md),
    itemCount: 4,
    separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
    itemBuilder: (_, index) =>
        AppLoadingSkeleton(height: index == 0 ? 112 : 190),
  );
}
