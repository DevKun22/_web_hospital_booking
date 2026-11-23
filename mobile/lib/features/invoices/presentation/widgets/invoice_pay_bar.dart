import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/design/app_design_tokens.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:hospital_booking_mobile/features/invoices/application/invoice_payment_controller.dart';
import 'package:hospital_booking_mobile/features/invoices/application/patient_payment_controller.dart';
import 'package:hospital_booking_mobile/features/invoices/domain/patient_invoice.dart';
import 'package:hospital_booking_mobile/features/invoices/domain/patient_payment.dart';

/// Thanh thanh toán dính đáy màn chi tiết hóa đơn: nút thanh toán kèm số tiền, và khi đã có giao dịch
/// thì hiện trạng thái (đang chờ, thành công, thất bại, hết hạn) cùng việc kế tiếp.
class InvoicePayBar extends ConsumerStatefulWidget {
  const InvoicePayBar({super.key, required this.invoice});

  final PatientInvoice invoice;

  @override
  ConsumerState<InvoicePayBar> createState() => _InvoicePayBarState();
}

class _InvoicePayBarState extends ConsumerState<InvoicePayBar>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Người dùng thường quay lại từ trình duyệt ngay sau khi trả xong: kiểm tra liền, không chờ chu kỳ.
    if (state == AppLifecycleState.resumed) {
      unawaited(
        ref.read(invoicePaymentProvider(widget.invoice.id).notifier).refresh(),
      );
    }
  }

  Future<void> _pay(List<PatientPaymentProvider> providers) async {
    final notifier = ref.read(
      invoicePaymentProvider(widget.invoice.id).notifier,
    );
    var provider = providers.first;
    if (providers.length > 1) {
      final chosen = await showModalBottomSheet<PatientPaymentProvider>(
        context: context,
        useRootNavigator: true,
        showDragHandle: true,
        builder: (sheetContext) => SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (final item in providers)
                ListTile(
                  leading: const Icon(Icons.account_balance_wallet_outlined),
                  title: Text(item.label),
                  onTap: () => Navigator.of(sheetContext).pop(item),
                ),
            ],
          ),
        ),
      );
      if (chosen == null) return;
      provider = chosen;
    }
    await notifier.start(provider.code);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final invoiceId = widget.invoice.id;
    final state = ref.watch(invoicePaymentProvider(invoiceId));
    final notifier = ref.read(invoicePaymentProvider(invoiceId).notifier);
    final capabilities = ref.watch(patientPaymentCapabilitiesProvider);
    final payment = state.transaction;
    final amount = formatVnd(widget.invoice.finalAmount);
    return Material(
      color: colors.surface,
      shape: Border(top: BorderSide(color: colors.border, width: 0.5)),
      child: SafeArea(
        top: false,
        minimum: const EdgeInsets.fromLTRB(
          AppSpacing.page,
          AppSpacing.sm,
          AppSpacing.page,
          AppSpacing.sm,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (payment != null) ...[
              _StatusPanel(payment: payment, isRefreshing: state.isRefreshing),
              const SizedBox(height: AppSpacing.xs),
            ],
            if (state.errorMessage != null) ...[
              Text(
                state.errorMessage!,
                style: Theme.of(
                  context,
                ).textTheme.bodySmall?.copyWith(color: colors.danger),
              ),
              const SizedBox(height: AppSpacing.xs),
            ],
            if (state.isPending)
              Row(
                children: [
                  Expanded(
                    child: FilledButton.tonalIcon(
                      onPressed: notifier.reopen,
                      icon: const Icon(Icons.open_in_new_outlined, size: 18),
                      label: const Text('Mở lại trang thanh toán'),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.xs),
                  IconButton.outlined(
                    tooltip: 'Kiểm tra trạng thái',
                    onPressed: state.isRefreshing ? null : notifier.refresh,
                    icon: const Icon(Icons.refresh_outlined),
                  ),
                ],
              )
            else if (payment?.status == PatientPaymentStatus.success)
              const SizedBox.shrink()
            else
              capabilities.when(
                loading: () => const LinearProgressIndicator(minHeight: 2),
                error: (_, _) => TextButton.icon(
                  onPressed: () =>
                      ref.invalidate(patientPaymentCapabilitiesProvider),
                  icon: const Icon(Icons.refresh_outlined),
                  label: const Text('Không tải được cổng thanh toán. Thử lại'),
                ),
                data: (data) => data.providers.isEmpty
                    ? Text(
                        'Chưa có cổng thanh toán trực tuyến. Bạn có thể thanh toán tại cơ sở khám.',
                        style: Theme.of(
                          context,
                        ).textTheme.bodySmall?.copyWith(color: colors.muted),
                      )
                    : FilledButton.icon(
                        onPressed: state.isCreating
                            ? null
                            : () => _pay(data.providers),
                        icon: state.isCreating
                            ? const SizedBox.square(
                                dimension: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Icon(Icons.credit_card_outlined),
                        label: Text(
                          payment == null
                              ? (data.providers.length == 1
                                    ? 'Thanh toán ${data.providers.first.label} · $amount'
                                    : 'Thanh toán · $amount')
                              : 'Thanh toán lại · $amount',
                        ),
                      ),
              ),
          ],
        ),
      ),
    );
  }
}

class _StatusPanel extends StatelessWidget {
  const _StatusPanel({required this.payment, required this.isRefreshing});

  final PatientPaymentTransaction payment;
  final bool isRefreshing;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final text = Theme.of(context).textTheme;
    final pending = payment.status == PatientPaymentStatus.pending;
    final (
      title,
      detail,
      icon,
      background,
      foreground,
    ) = switch (payment.status) {
      PatientPaymentStatus.success => (
        'Thanh toán thành công',
        'Mã giao dịch ${payment.transactionCode}',
        Icons.check_circle_outlined,
        colors.successContainer,
        colors.success,
      ),
      PatientPaymentStatus.failed => (
        'Chưa thanh toán được',
        'Bạn có thể thử lại.',
        Icons.error_outline_outlined,
        colors.dangerContainer,
        colors.danger,
      ),
      PatientPaymentStatus.cancelled => (
        'Giao dịch đã hủy',
        'Bạn có thể thanh toán lại.',
        Icons.cancel_outlined,
        colors.dangerContainer,
        colors.danger,
      ),
      PatientPaymentStatus.expired => (
        'Giao dịch đã hết hạn',
        'Hãy tạo giao dịch mới.',
        Icons.timer_off_outlined,
        colors.dangerContainer,
        colors.danger,
      ),
      _ => (
        'Đang chờ cổng thanh toán xác nhận',
        'Hoàn tất ở trình duyệt rồi quay lại, ứng dụng tự cập nhật.',
        Icons.hourglass_top_outlined,
        colors.infoContainer,
        colors.info,
      ),
    };
    return Container(
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Row(
        children: [
          pending && isRefreshing
              ? SizedBox.square(
                  dimension: 22,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.5,
                    color: foreground,
                  ),
                )
              : Icon(icon, color: foreground),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: text.titleSmall?.copyWith(color: foreground),
                ),
                Text(
                  detail,
                  style: text.bodySmall?.copyWith(color: colors.ink),
                ),
                if (pending && payment.expiredAt != null)
                  _Countdown(until: payment.expiredAt!, color: foreground),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Countdown extends StatefulWidget {
  const _Countdown({required this.until, required this.color});

  final DateTime until;
  final Color color;

  @override
  State<_Countdown> createState() => _CountdownState();
}

class _CountdownState extends State<_Countdown> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(
      const Duration(seconds: 1),
      (_) => mounted ? setState(() {}) : null,
    );
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final left = widget.until.difference(DateTime.now());
    final label = left.isNegative
        ? 'Giao dịch đã quá hạn'
        : 'Hết hạn sau ${left.inMinutes.toString().padLeft(2, '0')}:'
              '${(left.inSeconds % 60).toString().padLeft(2, '0')}';
    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.hair),
      child: Text(
        label,
        style: Theme.of(
          context,
        ).textTheme.labelMedium?.copyWith(color: widget.color),
      ),
    );
  }
}
