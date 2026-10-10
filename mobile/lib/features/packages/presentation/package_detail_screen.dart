import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/app/theme/app_theme.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:hospital_booking_mobile/core/widgets/app_error_banner.dart';
import 'package:hospital_booking_mobile/core/widgets/app_route_back_scope.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/packages/application/package_providers.dart';
import 'package:hospital_booking_mobile/features/packages/domain/medical_package.dart';

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
          data: (packageItem) => _PackageBookingBar(packageItem: packageItem),
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
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
      children: [
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [AppTheme.primary, Color(0xFF087D7C)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(24),
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
              const SizedBox(height: 14),
              Text(
                packageItem.name,
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                ),
              ),
              if (packageItem.summary != null) ...[
                const SizedBox(height: 8),
                Text(
                  packageItem.summary!,
                  style: const TextStyle(color: Color(0xE6FFFFFF)),
                ),
              ],
              if (packageItem.departmentName != null) ...[
                const SizedBox(height: 14),
                Row(
                  children: [
                    const Icon(
                      Icons.local_hospital_outlined,
                      color: Colors.white,
                      size: 19,
                    ),
                    const SizedBox(width: 7),
                    Expanded(
                      child: Text(
                        packageItem.departmentName!,
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 18),
        _PriceCard(packageItem: packageItem),
        if (packageItem.description != null) ...[
          const SizedBox(height: 22),
          const AppSectionHeader(title: 'Thông tin gói khám'),
          const SizedBox(height: 8),
          Text(packageItem.description!),
        ],
        if (packageItem.items.isNotEmpty) ...[
          const SizedBox(height: 22),
          const AppSectionHeader(title: 'Danh mục dịch vụ'),
          const SizedBox(height: 8),
          ...packageItem.items.map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _PackageItemRow(item: item),
            ),
          ),
        ],
        if (packageItem.note != null) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(15),
            decoration: BoxDecoration(
              color: const Color(0xFFFFF5DD),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFF2D998)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(
                  Icons.info_outline_rounded,
                  color: Color(0xFF8A6212),
                ),
                const SizedBox(width: 10),
                Expanded(child: Text(packageItem.note!)),
              ],
            ),
          ),
        ],
      ],
    ),
  );
}

class _PackageBookingBar extends StatelessWidget {
  const _PackageBookingBar({required this.packageItem});

  final MedicalPackage packageItem;

  @override
  Widget build(BuildContext context) => Material(
    color: Theme.of(context).colorScheme.surface,
    elevation: 10,
    child: SafeArea(
      top: false,
      minimum: const EdgeInsets.fromLTRB(20, 12, 20, 12),
      child: Row(
        children: [
          Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Tổng dự kiến',
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
                Text(
                  formatVnd(packageItem.finalPrice),
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: AppTheme.primaryDark,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
          ),
          FilledButton.icon(
            style: FilledButton.styleFrom(minimumSize: const Size(0, 50)),
            // Booking is a root of the indexed navigation shell. Switching to
            // it with `go` avoids pushing a second shell on top of the current
            // one, which can leave the branch body blank on Android.
            onPressed: () => context.go(_bookingLocation(packageItem)),
            icon: const Icon(Icons.calendar_month_outlined),
            label: const Text('Đặt gói này'),
          ),
        ],
      ),
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
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          _PriceRow(
            label: 'Giá dịch vụ trong gói',
            value: packageItem.basePrice,
          ),
          if (packageItem.serviceFee > 0) ...[
            const SizedBox(height: 8),
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
                  color: AppTheme.primaryDark,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Align(
            alignment: Alignment.centerLeft,
            child: Text(
              packageItem.isBhytSupport
                  ? 'Gói có hỗ trợ BHYT; mức giảm thực tế được xác nhận khi tiếp nhận.'
                  : 'Chi phí thực tế được xác nhận lại khi bệnh viện tiếp nhận.',
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
        style: const TextStyle(fontWeight: FontWeight.w700),
      ),
    ],
  );
}

class _PackageItemRow extends StatelessWidget {
  const _PackageItemRow({required this.item});

  final MedicalPackageItem item;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: Theme.of(context).colorScheme.surfaceContainerLowest,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
    ),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(
          item.included
              ? Icons.check_circle_rounded
              : Icons.add_circle_outline_rounded,
          color: item.included ? AppTheme.primary : const Color(0xFF9B6A13),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(item.name, style: Theme.of(context).textTheme.titleSmall),
              if (item.description != null) ...[
                const SizedBox(height: 3),
                Text(item.description!),
              ],
              if (item.price > 0) ...[
                const SizedBox(height: 5),
                Text(
                  item.included
                      ? '${formatVnd(item.price)} · Đã bao gồm'
                      : '${formatVnd(item.price)} · Tính thêm khi chọn',
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: item.included
                        ? AppTheme.primaryDark
                        : const Color(0xFF8A6212),
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
      padding: EdgeInsets.all(20),
      child: Column(
        children: [
          AppLoadingSkeleton(height: 220),
          SizedBox(height: 16),
          AppLoadingSkeleton(height: 150),
          SizedBox(height: 16),
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
      padding: const EdgeInsets.all(20),
      children: [
        AppErrorBanner(error: error),
        const SizedBox(height: 12),
        FilledButton.icon(
          onPressed: onRetry,
          icon: const Icon(Icons.refresh_rounded),
          label: const Text('Thử lại'),
        ),
      ],
    ),
  );
}
