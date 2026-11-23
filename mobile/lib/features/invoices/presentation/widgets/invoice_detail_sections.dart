import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/invoices/domain/patient_invoice.dart';
import 'package:hospital_booking_mobile/features/invoices/presentation/invoice_status_visuals.dart';
import 'package:hospital_booking_mobile/features/invoices/presentation/widgets/invoice_detail_rows.dart';

class InvoiceHeader extends StatelessWidget {
  const InvoiceHeader({super.key, required this.invoice});

  final PatientInvoice invoice;

  @override
  Widget build(BuildContext context) => Card(
    margin: EdgeInsets.zero,
    child: Padding(
      padding: const EdgeInsets.all(AppSpacing.lg),
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
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  fontWeight: AppFontWeight.strong,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          InvoiceIconLine(
            icon: Icons.calendar_today_outlined,
            value:
                '${formatDateVi(invoice.appointmentDate)} · ${formatTimeRange(invoice.startTime, invoice.endTime)}',
          ),
          if (invoice.isDependentInvoice && invoice.patientName != null) ...[
            const SizedBox(height: AppSpacing.sm),
            InvoiceIconLine(
              icon: Icons.family_restroom_outlined,
              value: 'Người đến khám: ${invoice.patientName}',
            ),
          ],
          const SizedBox(height: AppSpacing.sm),
          InvoiceIconLine(
            icon: Icons.person_outline_outlined,
            value: invoice.doctorName.isEmpty
                ? 'Bác sĩ phụ trách'
                : invoice.doctorName,
          ),
          if (invoice.careUnit.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
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
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Tổng hợp thanh toán',
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: AppFontWeight.strong),
          ),
          const SizedBox(height: AppSpacing.sm),
          if (invoice.items.isNotEmpty) ...[
            ...invoice.items.map(
              (item) => Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.xs),
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
                    const SizedBox(width: AppSpacing.sm),
                    Text(
                      formatVnd(item.amount),
                      style: const TextStyle(fontWeight: AppFontWeight.strong),
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
                    fontWeight: AppFontWeight.strong,
                  ),
                ),
              ),
              Text(
                formatVnd(invoice.finalAmount),
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  color: Theme.of(context).colorScheme.primary,
                  fontWeight: AppFontWeight.strong,
                ),
              ),
            ],
          ),
          if (invoice.paymentMethod != null) ...[
            const Divider(height: 24),
            Text(
              'Biên nhận thanh toán',
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                fontWeight: AppFontWeight.strong,
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
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
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.health_and_safety_outlined,
                color: Theme.of(context).colorScheme.primary,
              ),
              const SizedBox(width: AppSpacing.sm),
              Text(
                'Quyền lợi BHYT',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: AppFontWeight.strong,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
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
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: isUnpaid
            ? Theme.of(context).colorScheme.tertiaryContainer
            : Theme.of(context).colorScheme.primaryContainer,
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(invoice.status.icon),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  invoice.status.guidance,
                  style: const TextStyle(fontWeight: AppFontWeight.strong),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
