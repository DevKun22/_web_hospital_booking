import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/design/app_design_tokens.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:hospital_booking_mobile/features/appointments/domain/patient_appointment.dart';
import 'package:hospital_booking_mobile/features/appointments/presentation/appointment_labels.dart';

/// Thẻ nhắc lịch ở Trang chủ: nền theo vùng màu của trạng thái, ô ngày bên trái, chữ gọn và một đến hai nút.
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
    final colors = context.colors;
    final text = Theme.of(context).textTheme;
    final copy = _HomeAppointmentCopy.from(appointment);
    final tint = switch (copy.zone) {
      final zone? => colors.zone(zone),
      null => (background: colors.surfaceMuted, foreground: colors.ink),
    };
    final countdown = copy.showCountdown
        ? appointmentCountdown(appointment)
        : '';
    return Semantics(
      container: true,
      label:
          'Lịch khám sắp tới, ${appointment.doctorName}, ${appointment.status.label}',
      child: Material(
        color: tint.background,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.lg),
          side: BorderSide(
            color: copy.emphasis ? tint.foreground : colors.border,
            width: copy.emphasis ? 1.5 : 0.5,
          ),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onOpen,
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    _DateTile(appointment: appointment, copy: copy, tint: tint),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            copy.title(appointment),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: text.titleSmall?.copyWith(color: colors.ink),
                          ),
                          Text(
                            appointment.doctorName.isEmpty
                                ? 'Bác sĩ đang được cập nhật'
                                : appointment.doctorName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: text.bodySmall?.copyWith(
                              color: colors.textSoft,
                            ),
                          ),
                          if (countdown.isNotEmpty &&
                              countdown != 'Hôm nay') ...[
                            const SizedBox(height: AppSpacing.xxs),
                            DecoratedBox(
                              decoration: BoxDecoration(
                                color: colors.surface,
                                borderRadius: BorderRadius.circular(
                                  AppRadius.pill,
                                ),
                              ),
                              child: Padding(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: AppSpacing.xs,
                                  vertical: AppSpacing.hair,
                                ),
                                child: Text(
                                  countdown,
                                  style: text.labelMedium?.copyWith(
                                    color: tint.foreground,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
                if (copy.showTime) ...[
                  const SizedBox(height: AppSpacing.sm),
                  DecoratedBox(
                    decoration: BoxDecoration(
                      color: colors.surface,
                      borderRadius: BorderRadius.circular(AppRadius.md),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.sm,
                        vertical: AppSpacing.xs,
                      ),
                      child: Row(
                        children: [
                          Icon(
                            Icons.schedule_outlined,
                            size: AppIconSize.sm,
                            color: tint.foreground,
                          ),
                          const SizedBox(width: AppSpacing.xs),
                          Expanded(
                            child: Text(
                              formatTimeRange(
                                appointment.startTime,
                                appointment.endTime,
                              ),
                              style: text.labelLarge?.copyWith(
                                color: colors.ink,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
                if (copy.guidance != null) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    copy.guidance!,
                    style: text.bodySmall?.copyWith(color: colors.textSoft),
                  ),
                ],
                const SizedBox(height: AppSpacing.sm),
                if (copy.showQr)
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          key: const Key('home-appointment-qr'),
                          style: OutlinedButton.styleFrom(
                            backgroundColor: colors.surface,
                          ),
                          onPressed: onShowQr,
                          icon: const Icon(Icons.qr_code_2_outlined),
                          label: const Text('Mở vé QR'),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.xs),
                      Expanded(
                        child: FilledButton(
                          key: const Key('home-appointment-prepare'),
                          onPressed: onOpen,
                          child: Text(copy.primaryLabel),
                        ),
                      ),
                    ],
                  )
                else
                  FilledButton(
                    key: const Key('home-appointment-follow'),
                    onPressed: onOpen,
                    child: Text(copy.primaryLabel),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Ô bên trái: ngày và thứ khi lịch còn ở phía trước; dấu hiệu khi đã đến hoặc đang khám.
class _DateTile extends StatelessWidget {
  const _DateTile({
    required this.appointment,
    required this.copy,
    required this.tint,
  });

  final PatientAppointment appointment;
  final _HomeAppointmentCopy copy;
  final ({Color background, Color foreground}) tint;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final text = Theme.of(context).textTheme;
    final strong = copy.emphasis;
    final foreground = strong ? colors.onPrimary : colors.ink;
    final caption = strong ? colors.onPrimary : colors.muted;
    return Container(
      width: 56,
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xxs),
      decoration: BoxDecoration(
        color: strong ? colors.primary : colors.surface,
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (copy.tileIcon != null)
            Icon(copy.tileIcon, size: AppIconSize.lg, color: tint.foreground)
          else
            Text(
              appointmentDay(appointment),
              style: text.titleLarge?.copyWith(color: foreground, height: 1.1),
            ),
          Text(
            copy.tileCaption ?? appointmentWeekday(appointment),
            maxLines: 1,
            style: text.labelSmall?.copyWith(color: caption),
          ),
        ],
      ),
    );
  }
}

class _HomeAppointmentCopy {
  const _HomeAppointmentCopy({
    required this.title,
    required this.primaryLabel,
    required this.showQr,
    required this.zone,
    this.guidance,
    this.showTime = false,
    this.showCountdown = false,
    this.emphasis = false,
    this.tileIcon,
    this.tileCaption,
  });

  factory _HomeAppointmentCopy.from(PatientAppointment appointment) {
    switch (appointment.status) {
      case PatientAppointmentStatus.pendingConfirm:
        return _HomeAppointmentCopy(
          title: (_) => 'Chờ xác nhận',
          primaryLabel: 'Xem lịch',
          showQr: true,
          zone: AppZone.warning,
          showTime: true,
          guidance: 'Cơ sở khám đang kiểm tra yêu cầu của bạn.',
        );
      case PatientAppointmentStatus.checkedIn:
        return _HomeAppointmentCopy(
          title: (_) => 'Đã check-in',
          primaryLabel: 'Theo dõi tiến trình',
          showQr: false,
          zone: AppZone.success,
          tileIcon: Icons.check_circle_outlined,
          tileCaption: 'Đã đến',
          guidance: 'Chờ hướng dẫn tại cơ sở khám.',
        );
      case PatientAppointmentStatus.inProgress:
        return _HomeAppointmentCopy(
          title: (_) => 'Buổi khám đang diễn ra',
          primaryLabel: 'Xem tiến trình',
          showQr: false,
          zone: null,
          tileIcon: Icons.play_circle_outlined,
          tileCaption: 'Đang',
          guidance: 'Kết quả hiện sau khi cơ sở phát hành.',
        );
      case PatientAppointmentStatus.confirmed:
      case PatientAppointmentStatus.rescheduled:
        final start = appointment.scheduledStart;
        final now = DateTime.now();
        final isToday =
            start != null &&
            start.year == now.year &&
            start.month == now.month &&
            start.day == now.day;
        return _HomeAppointmentCopy(
          title: (item) => isToday
              ? 'Khám hôm nay lúc ${appointmentHhmm(item.startTime)}'
              : 'Lịch khám sắp tới',
          primaryLabel: isToday ? 'Sẵn sàng đi khám' : 'Chuẩn bị',
          showQr: true,
          zone: AppZone.primary,
          emphasis: isToday,
          showTime: !isToday,
          showCountdown: !isToday,
          tileCaption: isToday ? 'Nay' : null,
          guidance: isToday
              ? 'Nên có mặt trước giờ khám để làm thủ tục.'
              : null,
        );
      default:
        return _HomeAppointmentCopy(
          title: (_) => 'Lịch khám sắp tới',
          primaryLabel: 'Xem lịch',
          showQr: false,
          zone: AppZone.primary,
          showTime: true,
        );
    }
  }

  final String Function(PatientAppointment) title;
  final String primaryLabel;
  final bool showQr;
  final AppZone? zone;
  final String? guidance;
  final bool showTime;
  final bool showCountdown;
  final bool emphasis;
  final IconData? tileIcon;
  final String? tileCaption;
}
