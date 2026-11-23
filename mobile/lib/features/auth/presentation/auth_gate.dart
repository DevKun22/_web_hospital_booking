import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/app/router/route_guard.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_state.dart';

/// Bao quanh màn hình cần tài khoản. Đã đăng nhập thì hiện màn hình; chưa thì mời đăng nhập ngay tại màn đó,
/// không chuyển hướng đi nơi khác. Đang khôi phục phiên thì chờ, mất mạng thì cho thử lại.
class AuthGate extends ConsumerWidget {
  const AuthGate({super.key, required this.title, required this.child});

  /// Tên mục, dùng trong lời mời ("Lịch của tôi").
  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider);
    if (auth.isAuthenticated || auth.status == AuthStatus.loggingOut) {
      return child;
    }
    if (auth.status == AuthStatus.bootstrapping) {
      return const _GateScaffold(
        child: Padding(
          padding: EdgeInsets.all(AppSpacing.md),
          child: AppLoadingSkeleton(height: 160),
        ),
      );
    }
    if (auth.status == AuthStatus.offline ||
        auth.status == AuthStatus.offlineBrowsing) {
      return _GateScaffold(
        child: AppEmptyState(
          icon: Icons.cloud_off_outlined,
          title: 'Chưa kết nối được máy chủ',
          message: 'Kiểm tra mạng rồi thử lại để xem $title.',
          action: FilledButton.icon(
            onPressed: ref
                .read(authControllerProvider.notifier)
                .bootstrapSession,
            icon: const Icon(Icons.refresh_outlined),
            label: const Text('Thử lại'),
          ),
        ),
      );
    }
    return _GateScaffold(
      child: AppEmptyState(
        icon: Icons.lock_outline,
        title: 'Đăng nhập để xem $title',
        message:
            'Đăng nhập bằng email để xem lịch hẹn, hóa đơn và kết quả khám.',
        action: FilledButton(
          onPressed: () => context.push(
            loginLocation(GoRouterState.of(context).uri.toString()),
          ),
          child: const Text('Đăng nhập'),
        ),
      ),
    );
  }
}

class _GateScaffold extends StatelessWidget {
  const _GateScaffold({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: context.colors.canvas,
    appBar: Navigator.of(context).canPop() ? AppBar() : null,
    body: SafeArea(
      child: Center(child: SingleChildScrollView(child: child)),
    ),
  );
}
