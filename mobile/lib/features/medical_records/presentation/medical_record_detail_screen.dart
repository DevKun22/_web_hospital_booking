import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:hospital_booking_mobile/core/widgets/app_error_banner.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/medical_records/application/medical_records_controller.dart';
import 'package:hospital_booking_mobile/features/medical_records/domain/patient_medical_record.dart';

class MedicalRecordDetailScreen extends ConsumerWidget {
  const MedicalRecordDetailScreen({required this.recordId, super.key});

  final String recordId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail = ref.watch(medicalRecordDetailProvider(recordId));
    return Scaffold(
      appBar: AppBar(
        title: const Text('Chi tiết kết quả khám'),
        actions: [
          IconButton(
            tooltip: 'Làm mới',
            onPressed: () =>
                ref.invalidate(medicalRecordDetailProvider(recordId)),
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
                ref.invalidate(medicalRecordDetailProvider(recordId)),
          ),
          data: (record) => _DetailContent(record: record),
        ),
      ),
    );
  }
}

class _DetailContent extends StatelessWidget {
  const _DetailContent({required this.record});

  final PatientMedicalRecord record;

  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
    children: [
      _RecordHeader(record: record),
      const SizedBox(height: 14),
      _InfoSection(
        title: 'Kết luận khám',
        icon: Icons.medical_information_outlined,
        children: [
          _DetailRow(label: 'Triệu chứng', value: record.symptoms),
          _DetailRow(label: 'Chẩn đoán', value: record.diagnosis),
          _DetailRow(
            label: 'Hướng điều trị',
            value: record.treatment,
            showDivider: false,
          ),
        ],
      ),
      if (record.prescription != null) ...[
        const SizedBox(height: 14),
        _InfoSection(
          title: 'Chỉ định thuốc',
          icon: Icons.medication_outlined,
          children: [
            _DetailRow(
              label: 'Nội dung',
              value: record.prescription,
              showDivider: false,
            ),
          ],
        ),
      ],
      const SizedBox(height: 14),
      _LabResultsSection(record: record),
      if (record.resultFile.available) ...[
        const SizedBox(height: 14),
        Card(
          margin: EdgeInsets.zero,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Tệp kết quả tổng hợp',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Tệp được tải qua phiên đăng nhập bảo mật và không lưu lâu dài trên thiết bị.',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 14),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: () =>
                        context.push('/medical-records/${record.id}/file'),
                    icon: const Icon(Icons.visibility_outlined),
                    label: const Text('Xem tệp kết quả'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    ],
  );
}

class _RecordHeader extends StatelessWidget {
  const _RecordHeader({required this.record});

  final PatientMedicalRecord record;

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
                label: 'Đã công bố',
                tone: AppStatusTone.success,
                icon: Icons.verified_outlined,
              ),
              const Spacer(),
              Text(
                record.recordCode,
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
                '${formatDateVi(record.appointmentDate)} · ${formatTimeRange(record.startTime, record.endTime)}',
          ),
          const SizedBox(height: 10),
          _IconLine(
            icon: Icons.person_outline,
            value: record.doctorName.isEmpty
                ? 'Bác sĩ phụ trách'
                : record.doctorName,
          ),
          if (record.careUnit.isNotEmpty) ...[
            const SizedBox(height: 10),
            _IconLine(
              icon: Icons.local_hospital_outlined,
              value: record.careUnit,
            ),
          ],
          if (record.publishedAt != null) ...[
            const SizedBox(height: 10),
            _IconLine(
              icon: Icons.publish_outlined,
              value: 'Công bố ${_formatDateTime(record.publishedAt!)}',
            ),
          ],
        ],
      ),
    ),
  );
}

class _LabResultsSection extends StatelessWidget {
  const _LabResultsSection({required this.record});

  final PatientMedicalRecord record;

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
              Icon(
                Icons.science_outlined,
                color: Theme.of(context).colorScheme.primary,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Kết quả xét nghiệm',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              Text('${record.labResults.length} mục'),
            ],
          ),
          const SizedBox(height: 12),
          if (record.labResults.isEmpty)
            Text(
              'Hồ sơ này không có kết quả xét nghiệm đính kèm.',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            )
          else
            for (var index = 0; index < record.labResults.length; index++) ...[
              _LabResultTile(
                recordId: record.id,
                result: record.labResults[index],
              ),
              if (index != record.labResults.length - 1)
                const Divider(height: 24),
            ],
        ],
      ),
    ),
  );
}

class _LabResultTile extends StatelessWidget {
  const _LabResultTile({required this.recordId, required this.result});

  final String recordId;
  final PatientLabResult result;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        result.testName,
        style: Theme.of(
          context,
        ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
      ),
      if (result.displayResult != null) ...[
        const SizedBox(height: 5),
        Text('Kết quả: ${result.displayResult}'),
      ],
      if (result.referenceRange != null) ...[
        const SizedBox(height: 3),
        Text(
          'Khoảng tham chiếu: ${result.referenceRange}',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
        ),
      ],
      if (result.conclusion != null) ...[
        const SizedBox(height: 6),
        Text(result.conclusion!),
      ],
      if (result.file.available) ...[
        const SizedBox(height: 8),
        TextButton.icon(
          onPressed: () => context.push(
            '/medical-records/$recordId/lab-results/${result.id}/file',
          ),
          icon: const Icon(Icons.visibility_outlined),
          label: const Text('Xem tệp xét nghiệm'),
        ),
      ],
    ],
  );
}

class _InfoSection extends StatelessWidget {
  const _InfoSection({
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
          const SizedBox(height: 10),
          ...children,
        ],
      ),
    ),
  );
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({
    required this.label,
    required this.value,
    this.showDivider = true,
  });

  final String label;
  final String? value;
  final bool showDivider;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Padding(
        padding: const EdgeInsets.symmetric(vertical: 9),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 4),
            Text(value ?? 'Chưa có thông tin'),
          ],
        ),
      ),
      if (showDivider) const Divider(height: 1),
    ],
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
          title: 'Không tải được kết quả khám',
          message: 'Đã xảy ra lỗi khi đọc hồ sơ. Vui lòng thử lại.',
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
      AppLoadingSkeleton(height: 280),
      SizedBox(height: 14),
      AppLoadingSkeleton(height: 220),
    ],
  );
}

String _formatDateTime(DateTime value) {
  final local = value.toLocal();
  String two(int number) => number.toString().padLeft(2, '0');
  return '${two(local.day)}/${two(local.month)}/${local.year} lúc ${two(local.hour)}:${two(local.minute)}';
}
