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
    padding: const EdgeInsets.all(16),
    children: [
      if (error is ApiException)
        AppErrorBanner(error: error as ApiException)
      else
        const AppEmptyState(
          icon: Icons.error_outline,
          title: 'Không tải được hóa đơn',
          message: 'Đã xảy ra lỗi khi đọc hóa đơn. Vui lòng thử lại.',
        ),
      const SizedBox(height: 14),
      FilledButton.icon(
        onPressed: onRetry,
        icon: const Icon(Icons.refresh_rounded),
        label: const Text('Thử lại'),
      ),
    ],
  );
}

class InvoiceDetailLoading extends StatelessWidget {
  const InvoiceDetailLoading({super.key});

  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(16),
    children: const [
      AppLoadingSkeleton(height: 210),
      SizedBox(height: 14),
      AppLoadingSkeleton(height: 260),
      SizedBox(height: 14),
      AppLoadingSkeleton(height: 190),
    ],
  );
}
