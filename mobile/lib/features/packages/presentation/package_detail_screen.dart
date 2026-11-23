import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/app/navigation/booking_navigation.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:hospital_booking_mobile/core/widgets/app_error_banner.dart';
import 'package:hospital_booking_mobile/core/widgets/app_route_back_scope.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/packages/application/package_providers.dart';
import 'package:hospital_booking_mobile/features/packages/domain/medical_package.dart';
import 'package:hospital_booking_mobile/features/chatbot/domain/chatbot_entry_context.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';

class PackageDetailScreen extends ConsumerWidget {
  const PackageDetailScreen({required this.slug, super.key});

  final String slug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail = ref.watch(packageDetailProvider(slug));
    return AppRouteBackScope(
      fallbackLocation: '/home',
      child: Scaffold(
        appBar: AppBar(
          leading: const AppRouteBackButton(fallbackLocation: '/home'),
          title: const Text('Chi tiết gói khám'),
        ),
        body: detail.when(
          loading: () => const _PackageDetailLoading(),
          error: (error, _) => _PackageDetailError(
            error: error is ApiException
                ? error
                : const ApiException(
                    kind: ApiErrorKind.unknown,
                    message: 'Không thể tải thông tin gói khám.',
                  ),
            onRetry: () => ref.invalidate(packageDetailProvider(slug)),
          ),
          data: (packageItem) => _PackageDetailBody(packageItem: packageItem),
        ),
        bottomNavigationBar: detail.when(
          loading: () => null,
          error: (_, _) => null,
          data: (packageItem) => AppStickyActionBar(
            eyebrow: 'Tổng dự kiến',
            value: formatVnd(packageItem.finalPrice),
            secondaryLabel: 'Hỏi trợ lý',
            secondaryIcon: Icons.smart_toy_outlined,
            onSecondary: () => context.push(
              chatbotLocationForContext(
                kind: ChatbotEntryKind.medicalPackage,
                displayName: packageItem.name,
              ),
            ),
            primaryLabel: 'Đặt gói này',
            primaryIcon: Icons.calendar_month_outlined,
            onPrimary: () => openBookingFromCurrentRoute(
              context,
              _bookingLocation(packageItem),
            ),
          ),
        ),
      ),
    );
  }
}

class _PackageDetailBody extends StatelessWidget {
  const _PackageDetailBody({required this.packageItem});

  final MedicalPackage packageItem;

  @override
  Widget build(BuildContext context) => SafeArea(
    child: ListView(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.xs,
        AppSpacing.lg,
        AppSpacing.xxl,
      ),
      children: [
        Container(
          padding: const EdgeInsets.all(AppSpacing.lg),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [AppPalette.heroDeep, AppPalette.heroCare],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(AppRadius.hero),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  if (packageItem.isPopular)
                    const AppStatusBadge(
                      label: 'PHỔ BIẾN',
                      tone: AppStatusTone.warning,
                    ),
                  if (packageItem.isBhytSupport)
                    const AppStatusBadge(
                      label: 'HỖ TRỢ BHYT',
                      tone: AppStatusTone.info,
                    ),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              Text(
                packageItem.name,
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  color: AppPalette.onHero,
                  fontWeight: AppFontWeight.strong,
                ),
              ),
              if (packageItem.summary != null) ...[
                const SizedBox(height: AppSpacing.xs),
                Text(
                  packageItem.summary!,
                  style: const TextStyle(color: AppPalette.onHeroMuted),
                ),
              ],
              if (packageItem.departmentName != null) ...[
                const SizedBox(height: AppSpacing.md),
                Row(
                  children: [
                    const Icon(
                      Icons.local_hospital_outlined,
                      color: AppPalette.onHero,
                      size: 19,
                    ),
                    const SizedBox(width: AppSpacing.xs),
                    Expanded(
                      child: Text(
                        packageItem.departmentName!,
                        style: const TextStyle(
                          color: AppPalette.onHero,
                          fontWeight: AppFontWeight.strong,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        _PriceCard(packageItem: packageItem),
        if (packageItem.description != null) ...[
          const SizedBox(height: AppSpacing.lg),
          const AppSectionHeader(title: 'Thông tin gói khám'),
          const SizedBox(height: AppSpacing.xs),
          Text(packageItem.description!),
        ],
        if (packageItem.items.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.lg),
          const AppSectionHeader(title: 'Danh mục dịch vụ'),
          const SizedBox(height: AppSpacing.xs),
          ...packageItem.items.map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.sm),
              child: _PackageItemRow(item: item),
            ),
          ),
        ],
        if (packageItem.note != null) ...[
          const SizedBox(height: AppSpacing.sm),
          Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: context.colors.warningContainer,
              borderRadius: BorderRadius.circular(AppRadius.md),
              border: Border.all(
                color: context.colors.warning.withValues(alpha: 0.4),
              ),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.info_outline, color: context.colors.warning),
                const SizedBox(width: AppSpacing.sm),
                Expanded(child: Text(packageItem.note!)),
              ],
            ),
          ),
        ],
      ],
    ),
  );
}

String _bookingLocation(MedicalPackage packageItem) => Uri(
  path: '/booking',
  queryParameters: {
    'packageId': packageItem.id,
    'departmentId': ?packageItem.departmentId,
  },
).toString();

class _PriceCard extends StatelessWidget {
  const _PriceCard({required this.packageItem});

  final MedicalPackage packageItem;

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        children: [
          _PriceRow(
            label: 'Giá dịch vụ trong gói',
            value: packageItem.basePrice,
          ),
          if (packageItem.serviceFee > 0) ...[
            const SizedBox(height: AppSpacing.xs),
            _PriceRow(label: 'Phí dịch vụ', value: packageItem.serviceFee),
          ],
          const Divider(height: 24),
          Row(
            children: [
              Expanded(
                child: Text(
                  'Tổng dự kiến',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              Text(
                formatVnd(packageItem.finalPrice),
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  color: context.colors.primaryDark,
                  fontWeight: AppFontWeight.strong,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Align(
            alignment: Alignment.centerLeft,
            child: Text(
              packageItem.isBhytSupport
                  ? 'Gói có hỗ trợ BHYT; mức giảm thực tế được xác nhận khi tiếp nhận.'
                  : 'Chi phí thực tế được xác nhận lại khi cơ sở khám tiếp nhận.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
          ),
        ],
      ),
    ),
  );
}

class _PriceRow extends StatelessWidget {
  const _PriceRow({required this.label, required this.value});

  final String label;
  final double value;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Expanded(child: Text(label)),
      Text(
        formatVnd(value),
        style: const TextStyle(fontWeight: AppFontWeight.strong),
      ),
    ],
  );
}

class _PackageItemRow extends StatelessWidget {
  const _PackageItemRow({required this.item});

  final MedicalPackageItem item;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(AppSpacing.md),
    decoration: BoxDecoration(
      color: Theme.of(context).colorScheme.surfaceContainerLowest,
      borderRadius: BorderRadius.circular(AppRadius.md),
      border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
    ),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(
          item.included
              ? Icons.check_circle_outlined
              : Icons.add_circle_outline_outlined,
          color: item.included
              ? context.colors.primary
              : context.colors.warning,
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(item.name, style: Theme.of(context).textTheme.titleSmall),
              if (item.description != null) ...[
                const SizedBox(height: AppSpacing.xxs),
                Text(item.description!),
              ],
              if (item.price > 0) ...[
                const SizedBox(height: AppSpacing.xxs),
                Text(
                  item.included
                      ? '${formatVnd(item.price)} · Đã bao gồm'
                      : '${formatVnd(item.price)} · Tính thêm khi chọn',
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: item.included
                        ? context.colors.primaryDark
                        : context.colors.warning,
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    ),
  );
}

class _PackageDetailLoading extends StatelessWidget {
  const _PackageDetailLoading();

  @override
  Widget build(BuildContext context) => const SafeArea(
    child: SingleChildScrollView(
      padding: EdgeInsets.all(AppSpacing.lg),
      child: Column(
        children: [
          AppLoadingSkeleton(height: 220),
          SizedBox(height: AppSpacing.md),
          AppLoadingSkeleton(height: 150),
          SizedBox(height: AppSpacing.md),
          AppLoadingSkeleton(height: 240),
        ],
      ),
    ),
  );
}

class _PackageDetailError extends StatelessWidget {
  const _PackageDetailError({required this.error, required this.onRetry});

  final ApiException error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => SafeArea(
    child: ListView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      children: [
        AppErrorBanner(error: error),
        const SizedBox(height: AppSpacing.sm),
        FilledButton.icon(
          onPressed: onRetry,
          icon: const Icon(Icons.refresh_outlined),
          label: const Text('Thử lại'),
        ),
      ],
    ),
  );
}
