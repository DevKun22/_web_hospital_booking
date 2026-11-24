import 'package:hospital_booking_mobile/core/widgets/app_entity_mark.dart';
import 'package:hospital_booking_mobile/core/widgets/app_detail.dart';
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
          data: (packageItem) => AppDetailBar(
            priceLabel: 'Giá trọn gói',
            price: formatVnd(packageItem.finalPrice),
            primaryLabel: 'Chọn gói',
            onPrimary: () => openBookingFromCurrentRoute(
              context,
              _bookingLocation(packageItem),
            ),
            onAssistant: () => context.push(
              chatbotLocationForContext(
                kind: ChatbotEntryKind.medicalPackage,
                displayName: packageItem.name,
              ),
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
  Widget build(BuildContext context) {
    final colors = context.colors;
    final text = Theme.of(context).textTheme;
    final included = packageItem.items
        .where((item) => item.included)
        .toList(growable: false);
    final extras = packageItem.items
        .where((item) => !item.included)
        .toList(growable: false);
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.md,
          AppSpacing.xs,
          AppSpacing.md,
          AppSpacing.xl,
        ),
        children: [
          AppDetailHeader(
            tint: colors.zone(AppZone.primary),
            leading: AppEntityMark(
              name: packageItem.name,
              image: packageItem.image,
              size: AppTileSize.xl,
              onTinted: true,
            ),
            title: packageItem.name,
            subtitle: packageItem.summary,
            chips: [
              if (packageItem.isPopular) const AppDetailChip(label: 'Nổi bật'),
              if (packageItem.isBhytSupport)
                const AppDetailChip(label: 'Có BHYT'),
              if (packageItem.departmentName != null)
                AppDetailChip(label: packageItem.departmentName!),
            ],
          ),
          if (packageItem.description != null) ...[
            const SizedBox(height: AppSpacing.sm),
            AppDetailSection(
              title: 'Thông tin gói khám',
              child: Text(
                packageItem.description!,
                style: text.bodyMedium?.copyWith(color: colors.textSoft),
              ),
            ),
          ],
          if (included.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            AppDetailSection(
              title: 'Gồm ${included.length} dịch vụ',
              child: Column(
                children: [
                  for (final item in included) _PackageItemRow(item: item),
                ],
              ),
            ),
          ],
          if (extras.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            AppDetailSection(
              title: 'Dịch vụ tính thêm khi chọn',
              child: Column(
                children: [
                  for (final item in extras) _PackageItemRow(item: item),
                ],
              ),
            ),
          ],
          const SizedBox(height: AppSpacing.sm),
          AppDetailSection(
            title: 'Chi phí',
            child: Column(
              children: [
                _PriceRow(
                  label: 'Giá dịch vụ trong gói',
                  value: packageItem.basePrice,
                ),
                if (packageItem.serviceFee > 0)
                  _PriceRow(
                    label: 'Phí dịch vụ',
                    value: packageItem.serviceFee,
                  ),
                const Divider(height: AppSpacing.lg),
                _PriceRow(
                  label: 'Tổng dự kiến',
                  value: packageItem.finalPrice,
                  strong: true,
                ),
                const SizedBox(height: AppSpacing.xs),
                Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    packageItem.isBhytSupport
                        ? 'Gói có hỗ trợ BHYT; mức giảm thực tế được xác nhận khi tiếp nhận.'
                        : 'Chi phí thực tế được xác nhận lại khi cơ sở khám tiếp nhận.',
                    style: text.bodySmall?.copyWith(color: colors.muted),
                  ),
                ),
              ],
            ),
          ),
          if (packageItem.note != null) ...[
            const SizedBox(height: AppSpacing.sm),
            DecoratedBox(
              decoration: BoxDecoration(
                color: colors.warningContainer,
                borderRadius: BorderRadius.circular(AppRadius.lg),
              ),
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.info_outline, color: colors.warning),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Text(
                        packageItem.note!,
                        style: text.bodyMedium?.copyWith(color: colors.warning),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

String _bookingLocation(MedicalPackage packageItem) => Uri(
  path: '/booking',
  queryParameters: {
    'packageId': packageItem.id,
    'departmentId': ?packageItem.departmentId,
  },
).toString();

class _PriceRow extends StatelessWidget {
  const _PriceRow({
    required this.label,
    required this.value,
    this.strong = false,
  });

  final String label;
  final double value;
  final bool strong;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final colors = context.colors;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.hair),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: strong
                  ? text.titleSmall
                  : text.bodyMedium?.copyWith(color: colors.textSoft),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Text(
            formatVnd(value),
            style: strong
                ? text.titleMedium?.copyWith(color: colors.primaryDark)
                : text.labelLarge,
          ),
        ],
      ),
    );
  }
}

class _PackageItemRow extends StatelessWidget {
  const _PackageItemRow({required this.item});

  final MedicalPackageItem item;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final text = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xxs),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            item.included
                ? Icons.check_circle_outlined
                : Icons.add_circle_outline_outlined,
            size: AppIconSize.md,
            color: item.included ? colors.success : colors.warning,
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item.name, style: text.titleSmall),
                if (item.description != null)
                  Text(
                    item.description!,
                    style: text.bodySmall?.copyWith(color: colors.muted),
                  ),
                if (!item.included && item.price > 0)
                  Text(
                    formatVnd(item.price),
                    style: text.labelMedium?.copyWith(color: colors.warning),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
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
