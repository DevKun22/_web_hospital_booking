import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/design/app_design_tokens.dart';
import 'package:hospital_booking_mobile/features/onboarding/application/onboarding_controller.dart';

/// Hiện tấm chào một lần ở lần mở đầu tiên, ngay trên Trang chủ. Thay cho màn Welcome riêng:
/// người dùng thấy nội dung thật trước, không bị chặn bởi một màn trung gian.
class FirstRunGate extends ConsumerStatefulWidget {
  const FirstRunGate({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<FirstRunGate> createState() => _FirstRunGateState();
}

class _FirstRunGateState extends ConsumerState<FirstRunGate> {
  bool _checked = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _maybeShow());
  }

  Future<void> _maybeShow() async {
    if (_checked || !mounted) return;
    _checked = true;
    final seen = await ref.read(onboardingControllerProvider.future);
    if (seen || !mounted) return;
    final goLogin = await showModalBottomSheet<bool>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (_) => const _FirstRunSheet(),
    );
    await ref.read(onboardingControllerProvider.notifier).completeWelcome();
    if (goLogin == true && mounted) unawaited(context.push<void>('/login'));
  }

  @override
  Widget build(BuildContext context) => widget.child;
}

class _FirstRunSheet extends StatelessWidget {
  const _FirstRunSheet();

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final text = Theme.of(context).textTheme;
    Widget point(String label) => Padding(
      padding: const EdgeInsets.only(top: AppSpacing.sm),
      child: Row(
        children: [
          Icon(Icons.check_circle_rounded, size: 20, color: colors.care),
          const SizedBox(width: AppSpacing.sm),
          Expanded(child: Text(label, style: text.bodyLarge)),
        ],
      ),
    );
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.lg,
          0,
          AppSpacing.lg,
          AppSpacing.lg,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Chào mừng đến DevKunCare', style: text.titleLarge),
            point('Đặt lịch không cần tài khoản'),
            point('Xem giờ trống và chi phí trước khi đến'),
            point('Đăng nhập để xem lịch hẹn và kết quả'),
            const SizedBox(height: AppSpacing.lg),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () => Navigator.of(context).pop(false),
                child: const Text('Bắt đầu'),
              ),
            ),
            SizedBox(
              width: double.infinity,
              child: TextButton(
                onPressed: () => Navigator.of(context).pop(true),
                child: const Text('Đăng nhập'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
