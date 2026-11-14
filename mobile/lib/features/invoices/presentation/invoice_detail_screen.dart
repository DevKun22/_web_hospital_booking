import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/features/invoices/application/invoices_controller.dart';
import 'package:hospital_booking_mobile/features/invoices/domain/patient_invoice.dart';
import 'package:hospital_booking_mobile/features/invoices/presentation/widgets/invoice_detail_sections.dart';
import 'package:hospital_booking_mobile/features/invoices/presentation/widgets/invoice_detail_states.dart';
import 'package:hospital_booking_mobile/features/invoices/presentation/widgets/invoice_online_payment_card.dart';

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
          loading: () => const InvoiceDetailLoading(),
          error: (error, _) => InvoiceDetailError(
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
      InvoiceHeader(invoice: invoice),
      const SizedBox(height: 14),
      InvoicePaymentSummary(invoice: invoice),
      const SizedBox(height: 14),
      InvoiceInsuranceSection(invoice: invoice),
      const SizedBox(height: 14),
      InvoiceStatusGuidance(invoice: invoice),
      if (invoice.status == PatientInvoiceStatus.unpaid) ...[
        const SizedBox(height: 14),
        InvoiceOnlinePaymentCard(invoice: invoice),
      ],
    ],
  );
}
