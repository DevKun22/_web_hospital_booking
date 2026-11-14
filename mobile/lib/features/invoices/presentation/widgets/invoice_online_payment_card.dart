import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/errors/swallowed_error.dart';
import 'package:hospital_booking_mobile/features/invoices/application/invoices_controller.dart';
import 'package:hospital_booking_mobile/features/invoices/application/patient_payment_controller.dart';
import 'package:hospital_booking_mobile/features/invoices/domain/patient_invoice.dart';
import 'package:hospital_booking_mobile/features/invoices/domain/patient_payment.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:uuid/uuid.dart';
import 'package:hospital_booking_mobile/features/invoices/presentation/widgets/invoice_detail_sections.dart';

class InvoiceOnlinePaymentCard extends ConsumerStatefulWidget {
  const InvoiceOnlinePaymentCard({super.key, required this.invoice});

  final PatientInvoice invoice;

  @override
  ConsumerState<InvoiceOnlinePaymentCard> createState() =>
      _InvoiceOnlinePaymentCardState();
}

class _InvoiceOnlinePaymentCardState
    extends ConsumerState<InvoiceOnlinePaymentCard>
    with WidgetsBindingObserver {
  static const _pollInterval = Duration(seconds: 6);
  static const _maximumPolls = 20;

  PatientPaymentTransaction? _transaction;
  Timer? _pollTimer;
  int _pollCount = 0;
  bool _isCreating = false;
  bool _isRefreshing = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _pollTimer?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed &&
        _transaction?.status == PatientPaymentStatus.pending) {
      unawaited(_refreshTransaction());
      _startPolling();
    } else if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.inactive) {
      _pollTimer?.cancel();
    }
  }

  Future<void> _startPayment(PatientPaymentProvider provider) async {
    if (_isCreating) return;
    setState(() {
      _isCreating = true;
      _errorMessage = null;
    });
    try {
      final payment = await ref
          .read(patientPaymentControllerProvider)
          .create(
            invoiceId: widget.invoice.id,
            provider: provider.code,
            idempotencyKey: 'mobile:${widget.invoice.id}:${const Uuid().v4()}',
          );
      if (!mounted) return;
      setState(() => _transaction = payment);

      final rawUrl = payment.paymentUrl;
      final uri = rawUrl == null ? null : Uri.tryParse(rawUrl);
      if (uri == null ||
          uri.scheme != 'https' ||
          !await launchUrl(uri, mode: LaunchMode.externalApplication)) {
        throw const ApiException(
          kind: ApiErrorKind.unknown,
          code: 'PAYMENT_URL_UNAVAILABLE',
          message: 'Không thể mở cổng thanh toán. Vui lòng thử lại.',
        );
      }
      _startPolling(reset: true);
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _errorMessage = error.message);
    } catch (error) {
      logSwallowedError('invoice_detail_screen', error);
      if (!mounted) return;
      setState(
        () => _errorMessage =
            'Chưa thể bắt đầu thanh toán. Vui lòng thử lại sau.',
      );
    } finally {
      if (mounted) setState(() => _isCreating = false);
    }
  }

  void _startPolling({bool reset = false}) {
    if (reset) _pollCount = 0;
    _pollTimer?.cancel();
    if (_transaction?.status != PatientPaymentStatus.pending) return;
    _pollTimer = Timer.periodic(_pollInterval, (_) {
      if (_pollCount >= _maximumPolls) {
        _pollTimer?.cancel();
        return;
      }
      _pollCount += 1;
      unawaited(_refreshTransaction());
    });
  }

  Future<void> _refreshTransaction() async {
    final current = _transaction;
    if (current == null || _isRefreshing) return;
    _isRefreshing = true;
    try {
      final payment = await ref
          .read(patientPaymentControllerProvider)
          .refresh(current.id);
      if (!mounted) return;
      setState(() {
        _transaction = payment;
        _errorMessage = null;
      });
      if (payment.status.isFinal) _pollTimer?.cancel();
      if (payment.status == PatientPaymentStatus.success) {
        ref.invalidate(invoiceDetailProvider(widget.invoice.id));
        unawaited(ref.read(invoicesControllerProvider.notifier).refresh());
      }
    } on ApiException catch (error) {
      if (mounted) setState(() => _errorMessage = error.message);
    } finally {
      _isRefreshing = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    final capabilities = ref.watch(patientPaymentCapabilitiesProvider);
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  Icons.account_balance_wallet_outlined,
                  color: Theme.of(context).colorScheme.primary,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Thanh toán trực tuyến',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              'Ứng dụng chỉ cập nhật đã thanh toán sau khi máy chủ nhận xác nhận hợp lệ từ cổng thanh toán.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 14),
            capabilities.when(
              loading: () => const LinearProgressIndicator(),
              error: (_, _) => InvoiceUnavailablePayment(
                onRetry: () =>
                    ref.invalidate(patientPaymentCapabilitiesProvider),
              ),
              data: (data) {
                if (data.providers.isEmpty) {
                  return const InvoiceUnavailablePayment();
                }
                return Column(
                  children: [
                    for (final provider in data.providers)
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton.icon(
                          onPressed: _isCreating
                              ? null
                              : () => _startPayment(provider),
                          icon: _isCreating
                              ? const SizedBox.square(
                                  dimension: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : const Icon(Icons.open_in_new_rounded),
                          label: Text('Thanh toán với ${provider.label}'),
                        ),
                      ),
                  ],
                );
              },
            ),
            if (_transaction != null) ...[
              const SizedBox(height: 12),
              InvoicePaymentProgress(
                payment: _transaction!,
                isRefreshing: _isRefreshing,
                onRefresh: _refreshTransaction,
              ),
            ],
            if (_errorMessage != null) ...[
              const SizedBox(height: 10),
              Text(
                _errorMessage!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
