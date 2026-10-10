import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// Keeps content/detail routes inside the app when they were opened without a
/// previous route (for example from a deep link or a restored process).
class AppRouteBackScope extends StatelessWidget {
  const AppRouteBackScope({
    required this.fallbackLocation,
    required this.child,
    super.key,
  });

  final String fallbackLocation;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final canPop = context.canPop();
    return PopScope<void>(
      canPop: canPop,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) context.go(fallbackLocation);
      },
      child: child,
    );
  }
}

class AppRouteBackButton extends StatelessWidget {
  const AppRouteBackButton({required this.fallbackLocation, super.key});

  final String fallbackLocation;

  @override
  Widget build(BuildContext context) => IconButton(
    tooltip: 'Quay lại',
    icon: const Icon(Icons.arrow_back_rounded),
    onPressed: () {
      if (context.canPop()) {
        context.pop();
      } else {
        context.go(fallbackLocation);
      }
    },
  );
}
