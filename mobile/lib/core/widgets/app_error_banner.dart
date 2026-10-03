import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';

class AppErrorBanner extends StatelessWidget {
  const AppErrorBanner({super.key, required this.error, this.onDismiss});

  final ApiException error;
  final VoidCallback? onDismiss;

  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: Theme.of(context).colorScheme.errorContainer,
      borderRadius: BorderRadius.circular(12),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Text(
                error.message,
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onErrorContainer,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            if (onDismiss != null) ...[
              const SizedBox(width: 8),
              IconButton(
                visualDensity: VisualDensity.compact,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints.tightFor(
                  width: 32,
                  height: 32,
                ),
                onPressed: onDismiss,
                tooltip: 'Đóng thông báo',
                icon: const Icon(Icons.close_rounded, size: 20),
              ),
            ],
          ],
        ),
        if (error.requestId != null) ...[
          const SizedBox(height: 4),
          Text(
            'Mã hỗ trợ: ${error.requestId}',
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ],
    ),
  );
}
