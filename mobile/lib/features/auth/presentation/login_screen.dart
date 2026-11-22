import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/core/widgets/app_error_banner.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/auth/presentation/auth_shell.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_state.dart';
import 'package:hospital_booking_mobile/features/legal/legal.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key, this.returnTo});

  final String? returnTo;

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  bool _termsAccepted = false;

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);
    final isLoading = auth.status == AuthStatus.requestingOtp;
    final protectedFeatureMessage = _protectedFeatureMessage(widget.returnTo);
    final visibleError =
        auth.errorFor(AuthErrorOrigin.requestOtp) ??
        auth.errorFor(AuthErrorOrigin.session);

    return PopScope<void>(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _leaveLoginAfterFrame();
      },
      child: AuthShell(
        title: 'Đăng nhập người khám',
        subtitle: 'Nhập email đã dùng khi đặt lịch để nhận mã OTP bảo mật.',
        backTooltip: 'Về trang chủ',
        onBack: _leaveLogin,
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (protectedFeatureMessage != null) ...[
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 12,
                  ),
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.primaryContainer,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(
                        Icons.lock_outline_rounded,
                        size: 20,
                        color: Theme.of(context).colorScheme.onPrimaryContainer,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          protectedFeatureMessage,
                          style: Theme.of(context).textTheme.bodyMedium
                              ?.copyWith(
                                color: Theme.of(
                                  context,
                                ).colorScheme.onPrimaryContainer,
                                fontWeight: FontWeight.w600,
                              ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
              ],
              if (visibleError != null) ...[
                AppErrorBanner(
                  error: visibleError,
                  onDismiss: ref
                      .read(authControllerProvider.notifier)
                      .dismissError,
                ),
                const SizedBox(height: 16),
              ],
              TextFormField(
                controller: _emailController,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.done,
                autofillHints: const [AutofillHints.email],
                decoration: const InputDecoration(
                  labelText: 'Email',
                  hintText: 'ban@email.com',
                  prefixIcon: Icon(Icons.email_outlined),
                ),
                validator: (value) =>
                    RegExp(
                      r'^[^\s@]+@[^\s@]+\.[^\s@]+$',
                    ).hasMatch(value?.trim() ?? '')
                    ? null
                    : 'Nhập email hợp lệ',
                onFieldSubmitted: (_) => _submit(),
              ),
              const SizedBox(height: 8),
              TermsConsentTile(
                value: _termsAccepted,
                onChanged: (value) => setState(() => _termsAccepted = value),
              ),
              const SizedBox(height: 10),
              AppPrimaryButton(
                label: 'Gửi mã OTP',
                loading: isLoading,
                onPressed: _submit,
              ),
              const SizedBox(height: 18),
              Text(
                widget.returnTo == null
                    ? 'Đặt lịch lần đầu sẽ tự tạo tài khoản người khám bằng email này.'
                    : 'Sau khi đăng nhập, bạn sẽ được đưa trở lại tính năng vừa chọn.',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    FocusScope.of(context).unfocus();
    // Cơ sở khám đã soạn điều khoản thì phải đồng ý trước khi gửi OTP.
    final terms = requiredTerms(ref);
    if (terms != null && !_termsAccepted) return showTermsRequired(context);
    final sent = await ref
        .read(authControllerProvider.notifier)
        .requestOtp(
          _emailController.text.trim(),
          returnTo: widget.returnTo,
          termsVersion: terms?.version,
        );
    if (!mounted || sent) return;
    final error = ref
        .read(authControllerProvider)
        .errorFor(AuthErrorOrigin.requestOtp);
    if (refreshIfTermsOutdated(ref, error?.code)) {
      setState(() => _termsAccepted = false);
    }
  }

  void _leaveLogin() {
    ref.read(authControllerProvider.notifier).restartLogin();
    context.go('/home');
  }

  void _leaveLoginAfterFrame() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _leaveLogin();
    });
  }

  String? _protectedFeatureMessage(String? returnTo) {
    if (returnTo == null) return null;
    if (returnTo.startsWith('/appointments')) {
      return 'Vui lòng đăng nhập để xem và quản lý lịch khám của bạn.';
    }
    if (returnTo.startsWith('/profile')) {
      return 'Vui lòng đăng nhập để xem và cập nhật hồ sơ người khám.';
    }
    if (returnTo.startsWith('/medical-records')) {
      return 'Vui lòng đăng nhập để xem hồ sơ khám.';
    }
    if (returnTo.startsWith('/prescriptions')) {
      return 'Vui lòng đăng nhập để xem đơn thuốc.';
    }
    if (returnTo.startsWith('/invoices')) {
      return 'Vui lòng đăng nhập để xem hóa đơn.';
    }
    if (returnTo.startsWith('/mobile-tools')) {
      return 'Vui lòng đăng nhập để mở thẻ khám số và cài đặt bảo mật.';
    }
    if (returnTo.startsWith('/dependents')) {
      return 'Vui lòng đăng nhập để quản lý hồ sơ người thân.';
    }
    if (returnTo.startsWith('/notifications')) {
      return 'Vui lòng đăng nhập để xem thông báo.';
    }
    return 'Vui lòng đăng nhập để tiếp tục tính năng đã chọn.';
  }
}
