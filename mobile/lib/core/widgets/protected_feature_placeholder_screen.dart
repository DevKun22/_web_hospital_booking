import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';

class ProtectedFeaturePlaceholderScreen extends StatelessWidget {
  const ProtectedFeaturePlaceholderScreen({
    required this.title,
    required this.message,
    required this.icon,
    super.key,
  });

  final String title;
  final String message;
  final IconData icon;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(title)),
    body: SafeArea(
      child: AppEmptyState(
        icon: icon,
        title: title,
        message: message,
        action: OutlinedButton.icon(
          onPressed: () => context.go('/home'),
          icon: const Icon(Icons.home_outlined),
          label: const Text('Về trang chủ'),
        ),
      ),
    ),
  );
}
