import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/appointments/domain/patient_appointment.dart';
import 'package:qr_flutter/qr_flutter.dart';

Future<void> showAppointmentQrTicket(
  BuildContext context, {
  required PatientAppointment appointment,
  required String payload,
}) => showDialog<void>(
  context: context,
  builder: (_) =>
      AppointmentQrTicketDialog(appointment: appointment, payload: payload),
);

class AppointmentQrTicketDialog extends StatelessWidget {
  const AppointmentQrTicketDialog({
    required this.appointment,
    required this.payload,
    super.key,
  });

  final PatientAppointment appointment;
  final String payload;

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('Vé khám QR'),
    content: SingleChildScrollView(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Semantics(
            image: true,
            label: 'QR mã lịch ${appointment.bookingCode}',
            child: ExcludeSemantics(
              child: SizedBox.square(
                dimension: 210,
                child: QrImageView(data: payload, size: 210),
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          SelectableText(
            appointment.bookingCode,
            textAlign: TextAlign.center,
            style: Theme.of(
              context,
            ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: AppSpacing.xs),
          const Text(
            'Đưa mã này cho nhân viên tiếp nhận để đối chiếu. Không chia sẻ công khai ảnh QR.',
            textAlign: TextAlign.center,
          ),
        ],
      ),
    ),
    actions: [
      FilledButton(
        onPressed: () => Navigator.pop(context),
        child: const Text('Đóng'),
      ),
    ],
  );
}
