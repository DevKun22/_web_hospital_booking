import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/features/appointments/presentation/appointment_status_visuals.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/appointments/domain/patient_appointment.dart';

class AppointmentStatusHeader extends StatelessWidget {
  const AppointmentStatusHeader({super.key, required this.appointment});

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
              child: Align(
                alignment: Alignment.centerLeft,
                child: AppStatusBadge(
                  label: appointment.status.label,
                  tone: appointment.status.tone,
                  icon: appointment.status.icon,
                ),
              ),
            ),
            const SizedBox(width: 12),
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

class AppointmentInformationCard extends StatelessWidget {
  const AppointmentInformationCard({super.key, required this.appointment});

  final PatientAppointment appointment;

  @override
  Widget build(BuildContext context) => AppointmentInfoCard(
    title: 'Thông tin lịch khám',
    icon: Icons.event_note_outlined,
    children: [
      _DetailRow(
        icon: appointment.isDependentBooking
            ? Icons.family_restroom_outlined
            : Icons.person_outline_rounded,
        label: 'Người đến khám',
        value: appointment.patientName.isEmpty
            ? 'Đang cập nhật'
            : appointment.patientName,
      ),
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
      if (_showSpecialization(appointment))
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

/// Ẩn "Chuyên môn" khi chỉ nhắc lại tên chuyên khoa (vd. "tổng quát" và
/// "Khoa tổng quát").
bool _showSpecialization(PatientAppointment appointment) {
  final specialization = appointment.specialization?.trim();
  if (specialization == null || specialization.isEmpty) return false;
  String normalize(String value) =>
      value.toLowerCase().replaceFirst(RegExp(r'^khoa\s+'), '').trim();
  return normalize(specialization) != normalize(appointment.careUnit);
}

class AppointmentPriceInformation extends StatelessWidget {
  const AppointmentPriceInformation({super.key, required this.appointment});

  final PatientAppointment appointment;

  @override
  Widget build(BuildContext context) => AppointmentInfoCard(
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
        'Số tiền có thể thay đổi theo chỉ định thực tế tại cơ sở khám.',
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
          color: Theme.of(context).colorScheme.onSurfaceVariant,
        ),
      ),
    ],
  );
}

class AppointmentInfoCard extends StatelessWidget {
  const AppointmentInfoCard({
    super.key,
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

class AppointmentDetailLoading extends StatelessWidget {
  const AppointmentDetailLoading({super.key});

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

class AppointmentDetailError extends StatelessWidget {
  const AppointmentDetailError({
    super.key,
    required this.error,
    required this.onRetry,
  });

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
