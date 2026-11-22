import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/app/router/route_guard.dart';
import 'package:hospital_booking_mobile/core/providers/app_providers.dart';
import 'package:hospital_booking_mobile/core/widgets/app_error_banner.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_state.dart';
import 'package:hospital_booking_mobile/features/auth/presentation/auth_shell.dart';

class VerifyOtpScreen extends ConsumerStatefulWidget {
  const VerifyOtpScreen({super.key, this.returnTo});

  final String? returnTo;

  @override
  ConsumerState<VerifyOtpScreen> createState() => _VerifyOtpScreenState();
}

class _VerifyOtpScreenState extends ConsumerState<VerifyOtpScreen> {
  final _otpController = TextEditingController();

  @override
  void dispose() {
    _otpController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);
    final config = ref.watch(appConfigProvider);
    final isLoading = auth.status == AuthStatus.verifyingOtp;
    final visibleError = auth.errorFor(AuthErrorOrigin.verifyOtp);

    return PopScope<void>(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop && !isLoading) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) _returnToLogin();
          });
        }
      },
      child: AuthShell(
        title: 'Xác thực OTP',
        subtitle:
            'Mã xác thực đã được gửi đến email ${auth.challenge?.maskedTarget ?? auth.email ?? ''}.',
        backTooltip: 'Quay lại đăng nhập',
        onBack: isLoading ? null : _returnToLogin,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (visibleError != null) ...[
              AppErrorBanner(
                error: visibleError,
                onDismiss: ref
                    .read(authControllerProvider.notifier)
                    .dismissError,
              ),
              const SizedBox(height: 16),
            ],
            if (config.enableNetworkLogs &&
                auth.challenge?.debugOtp != null) ...[
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Text(
                    'OTP local: ${auth.challenge!.debugOtp}',
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
              ),
              const SizedBox(height: 12),
            ],
            TextField(
              controller: _otpController,
              keyboardType: TextInputType.number,
              maxLength: 6,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                letterSpacing: 10,
                fontWeight: FontWeight.w700,
              ),
              decoration: const InputDecoration(
                labelText: 'Mã OTP gồm 6 số',
                counterText: '',
              ),
              onSubmitted: (_) => _submit(),
            ),
            const SizedBox(height: 18),
            FilledButton(
              onPressed: isLoading ? null : _submit,
              child: isLoading
                  ? const SizedBox.square(
                      dimension: 22,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Xác nhận'),
            ),
            const SizedBox(height: 16),
            Text(
              'Chưa thấy mã? Kiểm tra thư rác hoặc xác nhận đúng email. '
              'Nếu vẫn không nhận được, hãy liên hệ cơ sở khám.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _submit() async {
    final otp = _otpController.text.trim();
    if (!RegExp(r'^\d{6}$').hasMatch(otp)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('OTP phải có đúng 6 chữ số.')),
      );
      return;
    }
    FocusScope.of(context).unfocus();
    await ref.read(authControllerProvider.notifier).verifyOtp(otp);
  }

  void _returnToLogin() {
    ref.read(authControllerProvider.notifier).restartLogin();
    context.go(
      widget.returnTo == null ? '/login' : loginLocation(widget.returnTo!),
    );
  }
}
