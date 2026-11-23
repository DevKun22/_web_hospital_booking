import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/features/invoices/presentation/invoice_status_visuals.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:hospital_booking_mobile/core/widgets/app_error_banner.dart';
import 'package:hospital_booking_mobile/core/widgets/app_filter_tabs.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/invoices/application/invoices_controller.dart';
import 'package:hospital_booking_mobile/features/invoices/domain/patient_invoice.dart';

enum _InvoiceFilter {
  due('Cần thanh toán'),
  paid('Đã thanh toán'),
  all('Tất cả');

  const _InvoiceFilter(this.label);

  final String label;

  bool matches(PatientInvoice invoice) => switch (this) {
    _InvoiceFilter.due => invoice.status == PatientInvoiceStatus.unpaid,
    _InvoiceFilter.paid => invoice.status == PatientInvoiceStatus.paid,
    _InvoiceFilter.all => true,
  };
}

/// Hóa đơn: khung tổng tiền còn phải trả, ba bộ lọc và thẻ hóa đơn có vạch màu theo trạng thái.
class InvoicesScreen extends ConsumerStatefulWidget {
  const InvoicesScreen({super.key});

  @override
  ConsumerState<InvoicesScreen> createState() => _InvoicesScreenState();
}

class _InvoicesScreenState extends ConsumerState<InvoicesScreen> {
  _InvoiceFilter? _filter;

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(invoicesControllerProvider);
    final controller = ref.read(invoicesControllerProvider.notifier);
    final unpaid = state.items
        .where((invoice) => invoice.status == PatientInvoiceStatus.unpaid)
        .toList(growable: false);
    // Mặc định xem hóa đơn cần trả nếu có, không thì xem tất cả.
    final filter =
        _filter ??
        (unpaid.isNotEmpty ? _InvoiceFilter.due : _InvoiceFilter.all);
    final visible = state.items.where(filter.matches).toList(growable: false);
    return Scaffold(
      appBar: AppBar(
        leading: Navigator.of(context).canPop()
            ? null
            : IconButton(
                tooltip: 'Trang chủ',
                onPressed: () => context.go('/home'),
                icon: const Icon(Icons.home_outlined),
              ),
        title: const Text('Hóa đơn'),
        actions: [
          IconButton(
            tooltip: 'Làm mới',
            onPressed: state.isRefreshing ? null : controller.refresh,
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: AppSwipeTabs<_InvoiceFilter>(
        items: _InvoiceFilter.values,
        selected: filter,
        onChanged: (value) => setState(() => _filter = value),
        child: SafeArea(
          child: state.isInitialLoading && !state.hasItems
              ? const _InvoicesLoading()
              : RefreshIndicator(
                  onRefresh: controller.refresh,
                  child: CustomScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    slivers: [
                      SliverPadding(
                        padding: const EdgeInsets.fromLTRB(
                          AppSpacing.page,
                          AppSpacing.xs,
                          AppSpacing.page,
                          AppSpacing.sm,
                        ),
                        sliver: SliverList.list(
                          children: [
                            _DueSummary(unpaid: unpaid),
                            const SizedBox(height: AppSpacing.sm),
                            AppFilterTabs<_InvoiceFilter>(
                              items: _InvoiceFilter.values,
                              selected: filter,
                              labelOf: (item) => item.label,
                              onChanged: (value) =>
                                  setState(() => _filter = value),
                            ),
                            if (state.error != null) ...[
                              const SizedBox(height: AppSpacing.sm),
                              AppErrorBanner(
                                error: state.error!,
                                onDismiss: controller.dismissError,
                              ),
                            ],
                            if (state.isRefreshing) ...[
                              const SizedBox(height: AppSpacing.xs),
                              const LinearProgressIndicator(minHeight: 2),
                            ],
                          ],
                        ),
                      ),
                      if (!state.hasItems)
                        const SliverFillRemaining(
                          hasScrollBody: false,
                          child: AppEmptyState(
                            icon: Icons.receipt_long_outlined,
                            title: 'Chưa có hóa đơn',
                            message:
                                'Hóa đơn sẽ xuất hiện sau khi cơ sở khám hoàn tất chi phí khám.',
                          ),
                        )
                      else if (visible.isEmpty)
                        SliverToBoxAdapter(
                          child: Padding(
                            padding: const EdgeInsets.all(AppSpacing.xl),
                            child: Text(
                              filter == _InvoiceFilter.due
                                  ? 'Bạn không có hóa đơn nào cần thanh toán.'
                                  : 'Chưa có hóa đơn nào ở mục này.',
                              textAlign: TextAlign.center,
                              style: Theme.of(context).textTheme.bodyMedium
                                  ?.copyWith(color: context.colors.muted),
                            ),
                          ),
                        )
                      else
                        SliverPadding(
                          padding: const EdgeInsets.fromLTRB(
                            AppSpacing.page,
                            0,
                            AppSpacing.page,
                            AppSpacing.md,
                          ),
                          sliver: SliverList.separated(
                            itemCount: visible.length,
                            separatorBuilder: (_, _) =>
                                const SizedBox(height: AppSpacing.sm),
                            itemBuilder: (context, index) {
                              final invoice = visible[index];
                              return _InvoiceCard(
                                invoice: invoice,
                                onTap: () =>
                                    context.push('/invoices/${invoice.id}'),
                              );
                            },
                          ),
                        ),
                      if (state.hasNextPage)
                        SliverPadding(
                          padding: const EdgeInsets.fromLTRB(
                            AppSpacing.page,
                            0,
                            AppSpacing.page,
                            AppSpacing.xxl,
                          ),
                          sliver: SliverToBoxAdapter(
                            child: OutlinedButton.icon(
                              onPressed: state.isLoadingMore
                                  ? null
                                  : controller.loadMore,
                              icon: state.isLoadingMore
                                  ? const SizedBox.square(
                                      dimension: 18,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                      ),
                                    )
                                  : const Icon(Icons.expand_more_rounded),
                              label: Text(
                                state.isLoadingMore
                                    ? 'Đang tải thêm…'
                                    : 'Xem thêm hóa đơn',
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
        ),
      ),
    );
  }
}

/// Tổng tiền còn phải trả của các hóa đơn đã tải; xanh lá khi không còn khoản nào.
class _DueSummary extends StatelessWidget {
  const _DueSummary({required this.unpaid});

  final List<PatientInvoice> unpaid;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final text = Theme.of(context).textTheme;
    final due = unpaid.isNotEmpty;
    final total = unpaid.fold<int>(0, (sum, item) => sum + item.finalAmount);
    final background = due ? colors.warningContainer : colors.successContainer;
    final foreground = due ? colors.warning : colors.success;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: colors.surface,
              shape: BoxShape.circle,
            ),
            child: Icon(
              due ? Icons.receipt_long_outlined : Icons.check_circle_outline,
              color: foreground,
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  due ? 'Cần thanh toán' : 'Không có khoản cần thanh toán',
                  style: text.labelMedium?.copyWith(color: foreground),
                ),
                if (due) ...[
                  Text(
                    formatVnd(total),
                    style: text.headlineSmall?.copyWith(color: colors.ink),
                  ),
                  Text(
                    '${unpaid.length} hóa đơn chưa thanh toán',
                    style: text.bodySmall?.copyWith(color: colors.ink),
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

class _InvoiceCard extends StatelessWidget {
  const _InvoiceCard({required this.invoice, required this.onTap});

  final PatientInvoice invoice;
  final VoidCallback onTap;

  Color _accent(AppColors colors) => switch (invoice.status) {
    PatientInvoiceStatus.unpaid => colors.warning,
    PatientInvoiceStatus.paid => colors.success,
    PatientInvoiceStatus.cancelled => colors.danger,
    _ => colors.info,
  };

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final text = Theme.of(context).textTheme;
    final unpaid = invoice.status == PatientInvoiceStatus.unpaid;
    return Material(
      color: colors.surface,
      borderRadius: BorderRadius.circular(AppRadius.lg),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Ink(
          decoration: BoxDecoration(
            border: Border(left: BorderSide(color: _accent(colors), width: 4)),
          ),
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      invoice.invoiceCode,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: text.labelMedium?.copyWith(color: colors.muted),
                    ),
                  ),
                  Flexible(
                    child: AppStatusBadge(
                      label: invoice.status.label,
                      tone: invoice.status.tone,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                invoice.doctorName.isEmpty
                    ? 'Chi phí khám'
                    : invoice.doctorName,
                style: text.titleSmall,
              ),
              if (invoice.careUnit.isNotEmpty)
                Text(
                  invoice.careUnit,
                  style: text.bodySmall?.copyWith(color: colors.muted),
                ),
              if (invoice.isDependentInvoice && invoice.patientName != null)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Row(
                    children: [
                      Icon(
                        Icons.family_restroom_outlined,
                        size: 16,
                        color: colors.primary,
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          'Người khám: ${invoice.patientName}',
                          style: text.labelMedium,
                        ),
                      ),
                    ],
                  ),
                ),
              const SizedBox(height: AppSpacing.sm),
              Wrap(
                alignment: WrapAlignment.spaceBetween,
                crossAxisAlignment: WrapCrossAlignment.center,
                runSpacing: AppSpacing.xs,
                spacing: AppSpacing.sm,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        formatVnd(invoice.finalAmount),
                        style: text.titleMedium?.copyWith(
                          color: colors.primaryDark,
                        ),
                      ),
                      Text(
                        formatDateVi(invoice.appointmentDate) +
                            (invoice.appliedInsuranceDiscount > 0
                                ? ' · BHYT giảm ${formatVnd(invoice.appliedInsuranceDiscount)}'
                                : ''),
                        style: text.bodySmall?.copyWith(color: colors.muted),
                      ),
                    ],
                  ),
                  if (unpaid)
                    FilledButton(
                      onPressed: onTap,
                      style: FilledButton.styleFrom(
                        minimumSize: const Size(0, 38),
                        padding: const EdgeInsets.symmetric(horizontal: 20),
                      ),
                      child: const Text('Thanh toán'),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _InvoicesLoading extends StatelessWidget {
  const _InvoicesLoading();

  @override
  Widget build(BuildContext context) => ListView.separated(
    padding: const EdgeInsets.all(AppSpacing.page),
    itemCount: 4,
    separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
    itemBuilder: (_, index) =>
        AppLoadingSkeleton(height: index == 0 ? 96 : 150),
  );
}
