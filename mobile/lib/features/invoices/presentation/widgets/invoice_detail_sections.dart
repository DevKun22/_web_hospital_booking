import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/invoices/domain/patient_invoice.dart';
import 'package:hospital_booking_mobile/features/invoices/domain/patient_payment.dart';
import 'package:hospital_booking_mobile/features/invoices/presentation/invoice_status_visuals.dart';
import 'package:hospital_booking_mobile/features/invoices/presentation/widgets/invoice_detail_rows.dart';

class InvoiceHeader extends StatelessWidget {
  const InvoiceHeader({super.key, required this.invoice});

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
          InvoiceIconLine(
            icon: Icons.calendar_today_outlined,
            value:
                '${formatDateVi(invoice.appointmentDate)} · ${formatTimeRange(invoice.startTime, invoice.endTime)}',
          ),
          if (invoice.isDependentInvoice && invoice.patientName != null) ...[
            const SizedBox(height: 10),
            InvoiceIconLine(
              icon: Icons.family_restroom_outlined,
              value: 'Người đến khám: ${invoice.patientName}',
            ),
          ],
          const SizedBox(height: 10),
          InvoiceIconLine(
            icon: Icons.person_outline,
            value: invoice.doctorName.isEmpty
                ? 'Bác sĩ phụ trách'
                : invoice.doctorName,
          ),
          if (invoice.careUnit.isNotEmpty) ...[
            const SizedBox(height: 10),
            InvoiceIconLine(
              icon: Icons.local_hospital_outlined,
              value: invoice.careUnit,
            ),
          ],
        ],
      ),
    ),
  );
}

class InvoicePaymentSummary extends StatelessWidget {
  const InvoicePaymentSummary({super.key, required this.invoice});

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
          if (invoice.items.isNotEmpty) ...[
            ...invoice.items.map(
              (item) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(item.description),
                          if (item.quantity > 1)
                            Text(
                              '${item.quantity} × ${formatVnd(item.unitPrice)}',
                              style: Theme.of(context).textTheme.bodySmall
                                  ?.copyWith(
                                    color: Theme.of(
                                      context,
                                    ).colorScheme.onSurfaceVariant,
                                  ),
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Text(
                      formatVnd(item.amount),
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                  ],
                ),
              ),
            ),
            const Divider(height: 20),
          ],
          InvoiceMoneyRow(label: 'Tổng chi phí', amount: invoice.totalAmount),
          InvoiceMoneyRow(
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
            Text(
              'Biên nhận thanh toán',
              style: Theme.of(
                context,
              ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            InvoiceTextRow(label: 'Mã biên nhận', value: invoice.invoiceCode),
            InvoiceTextRow(
              label: 'Phương thức',
              value: invoice.paymentMethod!.label,
            ),
          ],
          if (invoice.paymentReference != null)
            InvoiceTextRow(
              label: 'Mã tham chiếu',
              value: invoice.paymentReference!,
            ),
          if (invoice.paidAt != null)
            InvoiceTextRow(
              label: 'Thanh toán lúc',
              value: formatDateTimeVi(invoice.paidAt!),
            ),
          if (invoice.refundedAt != null)
            InvoiceTextRow(
              label: 'Hoàn tiền lúc',
              value: formatDateTimeVi(invoice.refundedAt!),
            ),
          if (invoice.refundReference != null)
            InvoiceTextRow(
              label: 'Mã hoàn tiền',
              value: invoice.refundReference!,
            ),
          if (invoice.refundReason != null)
            InvoiceTextRow(label: 'Lý do hoàn', value: invoice.refundReason!),
        ],
      ),
    ),
  );
}

class InvoiceInsuranceSection extends StatelessWidget {
  const InvoiceInsuranceSection({super.key, required this.invoice});

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
            InvoiceTextRow(
              label: 'Chi phí đủ điều kiện',
              value: formatVnd(invoice.insuranceEligibleAmount),
            ),
            InvoiceTextRow(
              label: 'Mức hưởng',
              value: '${invoice.insuranceCoverageRate}%',
            ),
            InvoiceTextRow(
              label: 'Số tiền được giảm',
              value: formatVnd(invoice.appliedInsuranceDiscount),
            ),
            if (invoice.insuranceRouteType != null)
              InvoiceTextRow(
                label: 'Tuyến BHYT',
                value: invoice.insuranceRouteType!.label,
              ),
          ],
        ],
      ),
    ),
  );
}

class InvoiceStatusGuidance extends StatelessWidget {
  const InvoiceStatusGuidance({super.key, required this.invoice});

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
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class InvoicePaymentProgress extends StatelessWidget {
  const InvoicePaymentProgress({
    super.key,
    required this.payment,
    required this.isRefreshing,
    required this.onRefresh,
  });

  final PatientPaymentTransaction payment;
  final bool isRefreshing;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    final (label, icon, color) = switch (payment.status) {
      PatientPaymentStatus.success => (
        'Thanh toán thành công',
        Icons.check_circle_rounded,
        Colors.green,
      ),
      PatientPaymentStatus.failed => (
        'Thanh toán chưa thành công',
        Icons.error_outline_rounded,
        Theme.of(context).colorScheme.error,
      ),
      PatientPaymentStatus.cancelled => (
        'Giao dịch đã hủy',
        Icons.cancel_outlined,
        Theme.of(context).colorScheme.error,
      ),
      PatientPaymentStatus.expired => (
        'Giao dịch đã hết hạn',
        Icons.timer_off_outlined,
        Theme.of(context).colorScheme.error,
      ),
      _ => (
        'Đang chờ cổng thanh toán xác nhận',
        Icons.schedule_rounded,
        Theme.of(context).colorScheme.primary,
      ),
    };
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          Icon(icon, color: color),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                Text(
                  'Mã ${payment.transactionCode}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Kiểm tra trạng thái',
            onPressed: isRefreshing ? null : onRefresh,
            icon: isRefreshing
                ? const SizedBox.square(
                    dimension: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
    );
  }
}

class InvoiceUnavailablePayment extends StatelessWidget {
  const InvoiceUnavailablePayment({super.key, this.onRetry});

  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      const Icon(Icons.info_outline_rounded, size: 20),
      const SizedBox(width: 8),
      const Expanded(
        child: Text(
          'Cổng thanh toán trực tuyến chưa được kích hoạt. Bạn vẫn có thể thanh toán tại bệnh viện.',
        ),
      ),
      if (onRetry != null)
        IconButton(
          tooltip: 'Thử lại',
          onPressed: onRetry,
          icon: const Icon(Icons.refresh_rounded),
        ),
    ],
  );
}
