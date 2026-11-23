import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_state.dart';
import 'package:hospital_booking_mobile/features/auth/presentation/login_panel.dart';

/// Màn đăng nhập riêng (mở từ lối vào ngoài màn cần tài khoản, vd. lần đầu mở app).
/// Cả hai bước nằm ở đây; quay lại ở bước nhập mã thì về bước email, ở bước email thì rời màn.
class LoginScreen extends ConsumerWidget {
  const LoginScreen({super.key, this.returnTo});

  final String? returnTo;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider);
    final onOtpStep =
        auth.challenge != null &&
        (auth.status == AuthStatus.awaitingOtp ||
            auth.status == AuthStatus.verifyingOtp);

    void back() {
      if (auth.status == AuthStatus.verifyingOtp) return;
      ref.read(authControllerProvider.notifier).restartLogin();
      if (!onOtpStep) context.go('/home');
    }

    return PopScope<void>(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        // Đổi trạng thái sau khung hình hiện tại, không đổi trong lúc dựng.
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (context.mounted) back();
        });
      },
      child: Scaffold(
        backgroundColor: context.colors.canvas,
        appBar: AppBar(
          backgroundColor: context.colors.canvas,
          leading: IconButton(
            onPressed: back,
            icon: Icon(
              onOtpStep ? Icons.arrow_back_outlined : Icons.close_outlined,
            ),
            tooltip: onOtpStep ? 'Quay lại nhập email' : 'Về trang chủ',
          ),
        ),
        body: SafeArea(
          top: false,
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.xl,
                0,
                AppSpacing.xl,
                AppSpacing.xl,
              ),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: LoginPanel(
                  returnTo: returnTo,
                  reason: returnTo == null
                      ? null
                      : 'Đăng nhập để tiếp tục tính năng vừa chọn. Mã gửi về email, không cần mật khẩu.',
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
