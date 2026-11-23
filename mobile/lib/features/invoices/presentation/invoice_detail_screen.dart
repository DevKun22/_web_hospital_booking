import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/features/invoices/application/invoices_controller.dart';
import 'package:hospital_booking_mobile/features/invoices/domain/patient_invoice.dart';
import 'package:hospital_booking_mobile/features/invoices/presentation/widgets/invoice_detail_sections.dart';
import 'package:hospital_booking_mobile/features/invoices/presentation/widgets/invoice_detail_states.dart';
import 'package:hospital_booking_mobile/features/invoices/application/invoice_payment_controller.dart';
import 'package:hospital_booking_mobile/features/invoices/presentation/widgets/invoice_pay_bar.dart';

class InvoiceDetailScreen extends ConsumerWidget {
  const InvoiceDetailScreen({required this.invoiceId, super.key});

  final String invoiceId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail = ref.watch(invoiceDetailProvider(invoiceId));
    final invoice = detail.value;
    // Giữ thanh đáy cả sau khi trả xong để người dùng còn thấy kết quả giao dịch.
    final showPayBar =
        invoice != null &&
        (invoice.status == PatientInvoiceStatus.unpaid ||
            ref.watch(invoicePaymentProvider(invoiceId)).transaction != null);
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
      bottomNavigationBar: showPayBar ? InvoicePayBar(invoice: invoice) : null,
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
    ],
  );
}
