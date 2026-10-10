import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:hospital_booking_mobile/core/widgets/app_error_banner.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/invoices/application/invoices_controller.dart';
import 'package:hospital_booking_mobile/features/invoices/domain/patient_invoice.dart';

class InvoiceDetailScreen extends ConsumerWidget {
  const InvoiceDetailScreen({required this.invoiceId, super.key});

  final String invoiceId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail = ref.watch(invoiceDetailProvider(invoiceId));
    return Scaffold(
      appBar: AppBar(
        title: const Text('Chi tiết hóa đơn'),
        actions: [
          IconButton(
            tooltip: 'Làm mới',
            onPressed: () => ref.invalidate(invoiceDetailProvider(invoiceId)),
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: SafeArea(
        child: detail.when(
          loading: () => const _DetailLoading(),
          error: (error, _) => _DetailError(
            error: error,
            onRetry: () => ref.invalidate(invoiceDetailProvider(invoiceId)),
          ),
          data: (invoice) => _DetailContent(invoice: invoice),
        ),
      ),
    );
  }
}

class _DetailContent extends StatelessWidget {
  const _DetailContent({required this.invoice});

  final PatientInvoice invoice;

  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
    children: [
      _InvoiceHeader(invoice: invoice),
      const SizedBox(height: 14),
      _PaymentSummary(invoice: invoice),
      const SizedBox(height: 14),
      _InsuranceSection(invoice: invoice),
      const SizedBox(height: 14),
      _StatusGuidance(invoice: invoice),
    ],
  );
}

class _InvoiceHeader extends StatelessWidget {
  const _InvoiceHeader({required this.invoice});

  final PatientInvoice invoice;

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
              AppStatusBadge(
                label: invoice.status.label,
                tone: invoice.status.tone,
                icon: invoice.status.icon,
              ),
              const Spacer(),
              Text(
                invoice.invoiceCode,
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
                '${formatDateVi(invoice.appointmentDate)} · ${formatTimeRange(invoice.startTime, invoice.endTime)}',
          ),
          const SizedBox(height: 10),
          _IconLine(
            icon: Icons.person_outline,
            value: invoice.doctorName.isEmpty
                ? 'Bác sĩ phụ trách'
                : invoice.doctorName,
          ),
          if (invoice.careUnit.isNotEmpty) ...[
            const SizedBox(height: 10),
            _IconLine(
              icon: Icons.local_hospital_outlined,
              value: invoice.careUnit,
            ),
          ],
        ],
      ),
    ),
  );
}

class _PaymentSummary extends StatelessWidget {
  const _PaymentSummary({required this.invoice});

  final PatientInvoice invoice;

  @override
  Widget build(BuildContext context) => Card(
    margin: EdgeInsets.zero,
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Tổng hợp thanh toán',
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 12),
          _MoneyRow(label: 'Tổng chi phí', amount: invoice.totalAmount),
          _MoneyRow(
            label: 'BHYT giảm trừ',
            amount: -invoice.appliedInsuranceDiscount,
            highlight: invoice.appliedInsuranceDiscount > 0,
          ),
          const Divider(height: 24),
          Row(
            children: [
              Expanded(
                child: Text(
                  'Thành tiền',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              Text(
                formatVnd(invoice.finalAmount),
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  color: Theme.of(context).colorScheme.primary,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
          if (invoice.paymentMethod != null) ...[
            const Divider(height: 24),
            _TextRow(label: 'Phương thức', value: invoice.paymentMethod!.label),
          ],
          if (invoice.paidAt != null)
            _TextRow(
              label: 'Thanh toán lúc',
              value: _formatDateTime(invoice.paidAt!),
            ),
          if (invoice.refundedAt != null)
            _TextRow(
              label: 'Hoàn tiền lúc',
              value: _formatDateTime(invoice.refundedAt!),
            ),
        ],
      ),
    ),
  );
}

class _InsuranceSection extends StatelessWidget {
  const _InsuranceSection({required this.invoice});

  final PatientInvoice invoice;

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
                Icons.health_and_safety_outlined,
                color: Theme.of(context).colorScheme.primary,
              ),
              const SizedBox(width: 10),
              Text(
                'Quyền lợi BHYT',
                style: Theme.of(
                  context,
                ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (!invoice.hasInsuranceBenefit)
            Text(
              'Hóa đơn này không ghi nhận quyền lợi BHYT.',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            )
          else ...[
            _TextRow(
              label: 'Chi phí đủ điều kiện',
              value: formatVnd(invoice.insuranceEligibleAmount),
            ),
            _TextRow(
              label: 'Mức hưởng',
              value: '${invoice.insuranceCoverageRate}%',
            ),
            _TextRow(
              label: 'Số tiền được giảm',
              value: formatVnd(invoice.appliedInsuranceDiscount),
            ),
            if (invoice.insuranceRouteType != null)
              _TextRow(
                label: 'Tuyến BHYT',
                value: invoice.insuranceRouteType!.label,
              ),
          ],
        ],
      ),
    ),
  );
}

class _StatusGuidance extends StatelessWidget {
  const _StatusGuidance({required this.invoice});

  final PatientInvoice invoice;

  @override
  Widget build(BuildContext context) {
    final isUnpaid = invoice.status == PatientInvoiceStatus.unpaid;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isUnpaid
            ? Theme.of(context).colorScheme.tertiaryContainer
            : Theme.of(context).colorScheme.primaryContainer,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(invoice.status.icon),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  invoice.status.guidance,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                if (isUnpaid) ...[
                  const SizedBox(height: 5),
                  const Text(
                    'Thanh toán trực tuyến trên ứng dụng chưa được hệ thống kích hoạt.',
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MoneyRow extends StatelessWidget {
  const _MoneyRow({
    required this.label,
    required this.amount,
    this.highlight = false,
  });

  final String label;
  final int amount;
  final bool highlight;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 5),
    child: Row(
      children: [
        Expanded(child: Text(label)),
        Text(
          amount < 0 ? '-${formatVnd(-amount)}' : formatVnd(amount),
          style: TextStyle(
            color: highlight ? Theme.of(context).colorScheme.primary : null,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    ),
  );
}

class _TextRow extends StatelessWidget {
  const _TextRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 5),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(child: Text(label)),
        const SizedBox(width: 12),
        Flexible(
          child: Text(
            value,
            textAlign: TextAlign.right,
            style: const TextStyle(fontWeight: FontWeight.w700),
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
          title: 'Không tải được hóa đơn',
          message: 'Đã xảy ra lỗi khi đọc hóa đơn. Vui lòng thử lại.',
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
      AppLoadingSkeleton(height: 260),
      SizedBox(height: 14),
      AppLoadingSkeleton(height: 190),
    ],
  );
}

String _formatDateTime(DateTime value) {
  final local = value.toLocal();
  String two(int number) => number.toString().padLeft(2, '0');
  return '${two(local.day)}/${two(local.month)}/${local.year} lúc ${two(local.hour)}:${two(local.minute)}';
}
