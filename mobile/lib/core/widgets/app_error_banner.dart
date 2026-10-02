import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';

class AppErrorBanner extends StatelessWidget {
  const AppErrorBanner({super.key, required this.error});

  final ApiException error;

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
        Text(
          error.message,
          style: TextStyle(
            color: Theme.of(context).colorScheme.onErrorContainer,
            fontWeight: FontWeight.w600,
          ),
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
