import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/widgets/app_error_banner.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';

class InvoiceDetailError extends StatelessWidget {
  const InvoiceDetailError({
    super.key,
    required this.error,
    required this.onRetry,
  });

  final Object error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(AppSpacing.md),
    children: [
      if (error is ApiException)
        AppErrorBanner(error: error as ApiException)
      else
        const AppEmptyState(
          icon: Icons.error_outline_outlined,
          title: 'Không tải được hóa đơn',
          message: 'Đã xảy ra lỗi khi đọc hóa đơn. Vui lòng thử lại.',
        ),
      const SizedBox(height: AppSpacing.md),
      FilledButton.icon(
        onPressed: onRetry,
        icon: const Icon(Icons.refresh_outlined),
        label: const Text('Thử lại'),
      ),
    ],
  );
}

class InvoiceDetailLoading extends StatelessWidget {
  const InvoiceDetailLoading({super.key});

  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(AppSpacing.md),
    children: const [
      AppLoadingSkeleton(height: 210),
      SizedBox(height: AppSpacing.md),
      AppLoadingSkeleton(height: 260),
      SizedBox(height: AppSpacing.md),
      AppLoadingSkeleton(height: 190),
    ],
  );
}
