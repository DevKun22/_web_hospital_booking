import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:hospital_booking_mobile/core/widgets/app_error_banner.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/prescriptions/application/prescriptions_controller.dart';
import 'package:hospital_booking_mobile/features/prescriptions/domain/patient_prescription.dart';

class PrescriptionDetailScreen extends ConsumerWidget {
  const PrescriptionDetailScreen({required this.prescriptionId, super.key});

  final String prescriptionId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail = ref.watch(prescriptionDetailProvider(prescriptionId));
    return Scaffold(
      appBar: AppBar(
        title: const Text('Chi tiết đơn thuốc'),
        actions: [
          IconButton(
            tooltip: 'Làm mới',
            onPressed: () =>
                ref.invalidate(prescriptionDetailProvider(prescriptionId)),
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: SafeArea(
        child: detail.when(
          loading: () => const _DetailLoading(),
          error: (error, _) => _DetailError(
            error: error,
            onRetry: () =>
                ref.invalidate(prescriptionDetailProvider(prescriptionId)),
          ),
          data: (prescription) => _DetailContent(prescription: prescription),
        ),
      ),
    );
  }
}

class _DetailContent extends StatelessWidget {
  const _DetailContent({required this.prescription});

  final PatientPrescription prescription;

  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
    children: [
      _PrescriptionHeader(prescription: prescription),
      const SizedBox(height: 14),
      Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.tertiaryContainer,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.info_outline),
            const SizedBox(width: 10),
            const Expanded(
              child: Text(
                'Dùng thuốc đúng liều, đúng thời điểm và đủ thời gian theo chỉ định. Liên hệ bác sĩ nếu có phản ứng bất thường.',
              ),
            ),
          ],
        ),
      ),
      const SizedBox(height: 14),
      Text(
        'Danh sách thuốc (${prescription.items.length})',
        style: Theme.of(
          context,
        ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
      ),
      const SizedBox(height: 10),
      if (prescription.items.isEmpty)
        const AppEmptyState(
          icon: Icons.medication_outlined,
          title: 'Chưa có thuốc trong đơn',
          message: 'Vui lòng liên hệ bệnh viện để kiểm tra lại đơn thuốc.',
        )
      else
        for (var index = 0; index < prescription.items.length; index++) ...[
          _MedicineCard(index: index + 1, item: prescription.items[index]),
          if (index != prescription.items.length - 1)
            const SizedBox(height: 10),
        ],
      if (prescription.note != null) ...[
        const SizedBox(height: 14),
        Card(
          margin: EdgeInsets.zero,
          child: ListTile(
            leading: const Icon(Icons.notes_outlined),
            title: const Text('Ghi chú của bác sĩ'),
            subtitle: Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(prescription.note!),
            ),
          ),
        ),
      ],
    ],
  );
}

class _PrescriptionHeader extends StatelessWidget {
  const _PrescriptionHeader({required this.prescription});

  final PatientPrescription prescription;

  @override
  Widget build(BuildContext context) => Card(
    margin: EdgeInsets.zero,
    child: Padding(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const AppStatusBadge(
                label: 'Đã phát hành',
                tone: AppStatusTone.success,
                icon: Icons.verified_outlined,
              ),
              const Spacer(),
              Text(
                prescription.prescriptionCode,
                style: Theme.of(
                  context,
                ).textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w800),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _IconLine(
            icon: Icons.calendar_today_outlined,
            value:
                '${formatDateVi(prescription.appointmentDate)} · ${formatTimeRange(prescription.startTime, prescription.endTime)}',
          ),
          const SizedBox(height: 10),
          _IconLine(
            icon: Icons.person_outline,
            value: prescription.doctorName.isEmpty
                ? 'Bác sĩ kê đơn'
                : prescription.doctorName,
          ),
          if (prescription.specialization != null) ...[
            const SizedBox(height: 10),
            _IconLine(
              icon: Icons.local_hospital_outlined,
              value: prescription.specialization!,
            ),
          ],
          if (prescription.issuedAt != null) ...[
            const SizedBox(height: 10),
            _IconLine(
              icon: Icons.edit_calendar_outlined,
              value: 'Phát hành ${_formatDateTime(prescription.issuedAt!)}',
            ),
          ],
        ],
      ),
    ),
  );
}

class _MedicineCard extends StatelessWidget {
  const _MedicineCard({required this.index, required this.item});

  final int index;
  final PrescriptionMedicine item;

  @override
  Widget build(BuildContext context) => Card(
    margin: EdgeInsets.zero,
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                radius: 17,
                backgroundColor: Theme.of(context).colorScheme.primaryContainer,
                child: Text(
                  '$index',
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.primary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  item.medicineName,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              if (item.quantityLabel != null)
                AppStatusBadge(
                  label: item.quantityLabel!,
                  tone: AppStatusTone.info,
                ),
            ],
          ),
          const SizedBox(height: 14),
          _MedicineRow(label: 'Liều dùng', value: item.dosage),
          _MedicineRow(label: 'Tần suất', value: item.frequency),
          _MedicineRow(label: 'Thời gian', value: item.duration),
          if (item.instruction != null) ...[
            const Divider(height: 22),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  Icons.tips_and_updates_outlined,
                  size: 20,
                  color: Theme.of(context).colorScheme.primary,
                ),
                const SizedBox(width: 8),
                Expanded(child: Text(item.instruction!)),
              ],
            ),
          ],
        ],
      ),
    ),
  );
}

class _MedicineRow extends StatelessWidget {
  const _MedicineRow({required this.label, required this.value});

  final String label;
  final String? value;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 3),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 82,
          child: Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
        ),
        Expanded(
          child: Text(
            value ?? 'Theo hướng dẫn của bác sĩ',
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
        ),
      ],
    ),
  );
}

class _IconLine extends StatelessWidget {
  const _IconLine({required this.icon, required this.value});

  final IconData icon;
  final String value;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Icon(icon, size: 20, color: Theme.of(context).colorScheme.primary),
      const SizedBox(width: 10),
      Expanded(child: Text(value)),
    ],
  );
}

class _DetailError extends StatelessWidget {
  const _DetailError({required this.error, required this.onRetry});

  final Object error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(16),
    children: [
      if (error is ApiException)
        AppErrorBanner(error: error as ApiException)
      else
        const AppEmptyState(
          icon: Icons.error_outline,
          title: 'Không tải được đơn thuốc',
          message: 'Đã xảy ra lỗi khi đọc đơn thuốc. Vui lòng thử lại.',
        ),
      const SizedBox(height: 14),
      FilledButton.icon(
        onPressed: onRetry,
        icon: const Icon(Icons.refresh_rounded),
        label: const Text('Thử lại'),
      ),
    ],
  );
}

class _DetailLoading extends StatelessWidget {
  const _DetailLoading();

  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(16),
    children: const [
      AppLoadingSkeleton(height: 210),
      SizedBox(height: 14),
      AppLoadingSkeleton(height: 250),
      SizedBox(height: 10),
      AppLoadingSkeleton(height: 250),
    ],
  );
}

String _formatDateTime(DateTime value) {
  final local = value.toLocal();
  String two(int number) => number.toString().padLeft(2, '0');
  return '${two(local.day)}/${two(local.month)}/${local.year} lúc ${two(local.hour)}:${two(local.minute)}';
}
