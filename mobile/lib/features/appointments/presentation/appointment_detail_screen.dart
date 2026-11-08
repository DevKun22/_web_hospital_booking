import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/widgets/app_error_banner.dart';
import 'package:hospital_booking_mobile/features/appointments/application/appointments_controller.dart';
import 'package:hospital_booking_mobile/features/appointments/domain/patient_appointment.dart';
import 'package:hospital_booking_mobile/features/appointments/presentation/widgets/appointment_preparation_card.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/notifications/domain/patient_notification.dart';
import 'package:hospital_booking_mobile/features/appointments/presentation/widgets/appointment_detail_sections.dart';
import 'package:hospital_booking_mobile/features/appointments/presentation/widgets/appointment_visit_widgets.dart';

class AppointmentDetailScreen extends ConsumerWidget {
  const AppointmentDetailScreen({
    required this.appointmentId,
    this.notificationType,
    this.notificationPublishedAt,
    super.key,
  });

  final String appointmentId;
  final PatientNotificationType? notificationType;
  final DateTime? notificationPublishedAt;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail = ref.watch(appointmentDetailProvider(appointmentId));
    final listState = ref.watch(appointmentsControllerProvider);
    final userId = ref.watch(
      authControllerProvider.select((state) => state.user?.id),
    );
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
          loading: () => const AppointmentDetailLoading(),
          error: (error, _) => AppointmentDetailError(
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
                AppointmentStatusHeader(appointment: appointment),
                if (notificationType != null) ...[
                  const SizedBox(height: 14),
                  AppointmentNotificationHistoryNotice(
                    type: notificationType!,
                    publishedAt: notificationPublishedAt,
                  ),
                ],
                if (listState.error != null) ...[
                  const SizedBox(height: 14),
                  AppErrorBanner(
                    error: listState.error!,
                    onDismiss: ref
                        .read(appointmentsControllerProvider.notifier)
                        .dismissError,
                  ),
                ],
                if (_supportsVisitActions(appointment.status)) ...[
                  const SizedBox(height: 14),
                  AppointmentVisitActions(appointment: appointment),
                ],
                const SizedBox(height: 14),
                AppointmentJourneyTimeline(status: appointment.status),
                const SizedBox(height: 14),
                AppointmentInformationCard(appointment: appointment),
                if (userId != null &&
                    AppointmentPreparationCard.supports(
                      appointment.status,
                    )) ...[
                  const SizedBox(height: 14),
                  AppointmentPreparationCard(
                    key: ValueKey('preparation-${appointment.id}'),
                    userId: userId,
                    appointment: appointment,
                  ),
                ],
                const SizedBox(height: 14),
                AppointmentPriceInformation(appointment: appointment),
                if (appointment.reason != null) ...[
                  const SizedBox(height: 14),
                  AppointmentInfoCard(
                    title: 'Lý do khám',
                    icon: Icons.notes_rounded,
                    children: [Text(appointment.reason!)],
                  ),
                ],
                if (appointment.cancelledReason != null) ...[
                  const SizedBox(height: 14),
                  AppointmentInfoCard(
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
    builder: (_) => AppointmentCancellationSheet(appointment: appointment),
  );
}

bool _supportsVisitActions(PatientAppointmentStatus status) => switch (status) {
  PatientAppointmentStatus.pendingConfirm ||
  PatientAppointmentStatus.confirmed ||
  PatientAppointmentStatus.rescheduled => true,
  _ => false,
};
