import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/core/widgets/app_error_banner.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_state.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key, this.returnTo});

  final String? returnTo;

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _phoneController = TextEditingController();

  @override
  void dispose() {
    _phoneController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);
    final isLoading = auth.status == AuthStatus.requestingOtp;
    final visibleError =
        auth.errorFor(AuthErrorOrigin.requestOtp) ??
        auth.errorFor(AuthErrorOrigin.session);

    return PopScope<void>(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _leaveLoginAfterFrame();
      },
      child: Scaffold(
        appBar: AppBar(
          leading: IconButton(
            onPressed: _leaveLogin,
            icon: const Icon(Icons.arrow_back_rounded),
            tooltip: 'Về trang chủ',
          ),
        ),
        body: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 480),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Center(child: AppBrandMark(size: 64)),
                      const SizedBox(height: 24),
                      Text(
                        'Đăng nhập bệnh nhân',
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.headlineSmall
                            ?.copyWith(fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Nhập số điện thoại để nhận mã OTP bảo mật.',
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 28),
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
                        controller: _phoneController,
                        keyboardType: TextInputType.phone,
                        textInputAction: TextInputAction.done,
                        autofillHints: const [AutofillHints.telephoneNumber],
                        decoration: const InputDecoration(
                          labelText: 'Số điện thoại',
                          hintText: '09xxxxxxxx',
                          prefixIcon: Icon(Icons.phone_outlined),
                        ),
                        validator: (value) {
                          final phone = value?.trim() ?? '';
                          if (!RegExp(
                            r'^(0|\+84)[0-9]{9,10}$',
                          ).hasMatch(phone)) {
                            return 'Số điện thoại không hợp lệ';
                          }
                          return null;
                        },
                        onFieldSubmitted: (_) => _submit(),
                      ),
                      const SizedBox(height: 18),
                      AppPrimaryButton(
                        label: 'Gửi mã OTP',
                        loading: isLoading,
                        onPressed: _submit,
                      ),
                      const SizedBox(height: 18),
                      Text(
                        'Bằng việc tiếp tục, bạn đồng ý sử dụng số điện thoại để xác thực tài khoản bệnh nhân.',
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                      if (widget.returnTo != null) ...[
                        const SizedBox(height: 12),
                        Text(
                          'Sau khi đăng nhập, bạn sẽ được đưa trở lại tính năng vừa chọn.',
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.bodySmall
                              ?.copyWith(
                                color: Theme.of(
                                  context,
                                ).colorScheme.onSurfaceVariant,
                              ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    FocusScope.of(context).unfocus();
    await ref
        .read(authControllerProvider.notifier)
        .requestOtp(_phoneController.text.trim());
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
}
