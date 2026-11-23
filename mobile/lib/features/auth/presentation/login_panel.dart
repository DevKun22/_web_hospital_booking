import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/config/app_brand.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/providers/app_providers.dart';
import 'package:hospital_booking_mobile/core/widgets/app_error_banner.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_state.dart';
import 'package:hospital_booking_mobile/features/legal/legal.dart';

const _otpLength = 6;
const _resendCooldown = Duration(seconds: 60);
final _emailPattern = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');

/// Khối đăng nhập người khám, căn giữa, hai bước trên cùng một chỗ: nhập email rồi nhập mã 6 số.
/// Dùng ở màn /login và ngay trong màn cần tài khoản (AuthGate), nên đăng nhập xong không phải chuyển trang.
/// Bước đang hiện suy ra từ trạng thái đăng nhập (đã có mã gửi đi thì là bước nhập mã).
class LoginPanel extends ConsumerStatefulWidget {
  const LoginPanel({super.key, this.reason, this.returnTo});

  /// Câu nói vì sao cần đăng nhập ("Đăng nhập để xem lịch hẹn"); không có thì dùng câu chung.
  final String? reason;
  final String? returnTo;

  @override
  ConsumerState<LoginPanel> createState() => _LoginPanelState();
}

class _LoginPanelState extends ConsumerState<LoginPanel> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _otpController = TextEditingController();
  final _otpFocus = FocusNode();
  bool _termsAccepted = false;
  Timer? _ticker;
  DateTime? _resendAt;

  @override
  void initState() {
    super.initState();
    _emailController.text = ref.read(authControllerProvider).email ?? '';
    _otpController.addListener(_onOtpChanged);
  }

  @override
  void dispose() {
    _ticker?.cancel();
    _emailController.dispose();
    _otpController.dispose();
    _otpFocus.dispose();
    super.dispose();
  }

  void _onOtpChanged() {
    setState(() {});
    final auth = ref.read(authControllerProvider);
    // Đủ 6 số (gõ hoặc dán từ email) thì tự xác nhận.
    if (_otpController.text.length == _otpLength &&
        auth.status == AuthStatus.awaitingOtp) {
      unawaited(_verify());
    }
  }

  void _startResendCountdown() {
    _resendAt = DateTime.now().add(_resendCooldown);
    _ticker?.cancel();
    _ticker = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return timer.cancel();
      if (_secondsUntilResend == 0) timer.cancel();
      setState(() {});
    });
  }

  int get _secondsUntilResend {
    final at = _resendAt;
    if (at == null) return 0;
    final left = at.difference(DateTime.now()).inSeconds;
    return left < 0 ? 0 : left;
  }

  Future<void> _sendCode() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    // Cơ sở khám đã soạn điều khoản thì phải đồng ý trước khi gửi OTP.
    final terms = requiredTerms(ref);
    if (terms != null && !_termsAccepted) return showTermsRequired(context);
    await _request(terms?.version);
  }

  Future<void> _resend() => _request(
    requiredTerms(ref)?.version,
    email: ref.read(authControllerProvider).email,
  );

  Future<void> _request(String? termsVersion, {String? email}) async {
    final sent = await ref
        .read(authControllerProvider.notifier)
        .requestOtp(
          (email ?? _emailController.text).trim(),
          returnTo: widget.returnTo,
          termsVersion: termsVersion,
        );
    if (!mounted) return;
    if (sent) {
      _otpController.clear();
      _startResendCountdown();
      _otpFocus.requestFocus();
      return;
    }
    final error = ref
        .read(authControllerProvider)
        .errorFor(AuthErrorOrigin.requestOtp);
    if (refreshIfTermsOutdated(ref, error?.code)) {
      setState(() => _termsAccepted = false);
    }
  }

  Future<void> _verify() async {
    final otp = _otpController.text;
    if (otp.length != _otpLength) return;
    final ok = await ref.read(authControllerProvider.notifier).verifyOtp(otp);
    if (!ok && mounted) _otpController.clear();
  }

  void _changeEmail() {
    ref.read(authControllerProvider.notifier).restartLogin();
    _otpController.clear();
    _ticker?.cancel();
    _resendAt = null;
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);
    final colors = context.colors;
    final text = Theme.of(context).textTheme;
    final onOtpStep =
        auth.challenge != null &&
        (auth.status == AuthStatus.awaitingOtp ||
            auth.status == AuthStatus.verifyingOtp);
    final error = onOtpStep
        ? auth.errorFor(AuthErrorOrigin.verifyOtp)
        : auth.errorFor(AuthErrorOrigin.requestOtp) ??
              auth.errorFor(AuthErrorOrigin.session);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Center(child: AppBrandMark(size: 56)),
        const SizedBox(height: AppSpacing.md),
        Text(
          onOtpStep ? 'Nhập mã 6 số' : 'Đăng nhập người khám',
          textAlign: TextAlign.center,
          style: text.headlineSmall,
        ),
        const SizedBox(height: AppSpacing.xxs),
        if (onOtpStep)
          Wrap(
            alignment: WrapAlignment.center,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Text(
                'Đã gửi tới ${auth.challenge?.maskedTarget ?? auth.email ?? ''}',
                textAlign: TextAlign.center,
                style: text.bodyMedium?.copyWith(color: colors.muted),
              ),
              TextButton(
                onPressed: auth.status == AuthStatus.verifyingOtp
                    ? null
                    : _changeEmail,
                child: const Text('Đổi email'),
              ),
            ],
          )
        else
          Text(
            widget.reason ??
                'Xem lịch hẹn, kết quả khám và hóa đơn. Mã gửi về email, không cần mật khẩu.',
            textAlign: TextAlign.center,
            style: text.bodyMedium?.copyWith(color: colors.muted),
          ),
        const SizedBox(height: AppSpacing.lg),
        if (error != null) ...[
          AppErrorBanner(
            error: error,
            onDismiss: ref.read(authControllerProvider.notifier).dismissError,
          ),
          const SizedBox(height: AppSpacing.md),
        ],
        if (onOtpStep) ..._otpStep(auth) else ..._emailStep(auth),
      ],
    );
  }

  List<Widget> _emailStep(AuthState auth) => [
    Form(
      key: _formKey,
      child: TextFormField(
        controller: _emailController,
        keyboardType: TextInputType.emailAddress,
        textInputAction: TextInputAction.done,
        autofillHints: const [AutofillHints.email],
        decoration: const InputDecoration(
          labelText: 'Email',
          hintText: 'ban@email.com',
          prefixIcon: Icon(Icons.email_outlined),
        ),
        validator: (value) => _emailPattern.hasMatch(value?.trim() ?? '')
            ? null
            : 'Nhập email hợp lệ',
        onFieldSubmitted: (_) => _sendCode(),
      ),
    ),
    const SizedBox(height: AppSpacing.xs),
    TermsConsentTile(
      value: _termsAccepted,
      onChanged: (value) => setState(() => _termsAccepted = value),
    ),
    const SizedBox(height: AppSpacing.sm),
    AppPrimaryButton(
      label: 'Gửi mã',
      loading: auth.status == AuthStatus.requestingOtp,
      onPressed: _sendCode,
    ),
    const SizedBox(height: AppSpacing.md),
    Text(
      'Lần đầu dùng ${AppBrand.name}? Tài khoản tự tạo khi bạn xác nhận mã.',
      textAlign: TextAlign.center,
      style: Theme.of(
        context,
      ).textTheme.bodySmall?.copyWith(color: context.colors.muted),
    ),
  ];

  List<Widget> _otpStep(AuthState auth) {
    final verifying = auth.status == AuthStatus.verifyingOtp;
    // Mã thử nghiệm chỉ có khi máy chủ chạy chế độ phát triển, và chỉ hiện khi app bật nhật ký mạng.
    final debugOtp =
        auth.challenge?.debugOtp != null &&
            ref.watch(appConfigProvider).enableNetworkLogs
        ? auth.challenge?.debugOtp
        : null;
    final wait = _secondsUntilResend;
    return [
      OtpCodeField(
        controller: _otpController,
        focusNode: _otpFocus,
        enabled: !verifying,
      ),
      if (debugOtp != null) ...[
        const SizedBox(height: AppSpacing.sm),
        Text(
          'OTP thử nghiệm: $debugOtp',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.labelLarge,
        ),
      ],
      const SizedBox(height: AppSpacing.lg),
      AppPrimaryButton(
        label: 'Xác nhận',
        loading: verifying,
        onPressed: _otpController.text.length == _otpLength ? _verify : null,
      ),
      const SizedBox(height: AppSpacing.xs),
      Center(
        child: TextButton.icon(
          onPressed: wait > 0 || verifying ? null : _resend,
          icon: const Icon(Icons.refresh_outlined),
          label: Text(wait > 0 ? 'Gửi lại mã sau ${wait}s' : 'Gửi lại mã'),
        ),
      ),
      Text(
        'Chưa thấy thư? Xem cả mục thư rác. Mã dán từ email sẽ tự điền.',
        textAlign: TextAlign.center,
        style: Theme.of(
          context,
        ).textTheme.bodySmall?.copyWith(color: context.colors.muted),
      ),
    ];
  }
}

/// Ô mã 6 số: sáu ô hiển thị, một ô nhập ẩn phía trên nhận gõ, dán cả mã và tự điền mã từ hệ thống.
class OtpCodeField extends StatelessWidget {
  const OtpCodeField({
    super.key,
    required this.controller,
    required this.focusNode,
    this.enabled = true,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final text = Theme.of(context).textTheme;
    return Semantics(
      label: 'Mã xác thực 6 chữ số',
      child: Stack(
        alignment: Alignment.center,
        children: [
          ListenableBuilder(
            listenable: Listenable.merge([controller, focusNode]),
            builder: (context, _) {
              final value = controller.text;
              // Ô đang chờ nhập (ô cuối khi đã đủ số) có viền đậm màu chính.
              final active = value.length < _otpLength
                  ? value.length
                  : _otpLength - 1;
              return Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  for (var i = 0; i < _otpLength; i += 1) ...[
                    if (i > 0) const SizedBox(width: AppSpacing.xs),
                    Flexible(
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(
                          maxWidth: AppSize.controlHeight,
                        ),
                        child: AspectRatio(
                          aspectRatio: 0.85,
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              color: colors.surface,
                              borderRadius: BorderRadius.circular(AppRadius.sm),
                              border: focusNode.hasFocus && i == active
                                  ? Border.all(color: colors.primary, width: 2)
                                  : Border.all(color: colors.border),
                            ),
                            child: Center(
                              child: Text(
                                i < value.length ? value[i] : '',
                                style: text.headlineSmall,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ],
              );
            },
          ),
          Positioned.fill(
            child: Opacity(
              opacity: 0,
              child: TextField(
                controller: controller,
                focusNode: focusNode,
                enabled: enabled,
                autofocus: true,
                keyboardType: TextInputType.number,
                autofillHints: const [AutofillHints.oneTimeCode],
                inputFormatters: [
                  FilteringTextInputFormatter.digitsOnly,
                  LengthLimitingTextInputFormatter(_otpLength),
                ],
                showCursor: false,
                enableInteractiveSelection: true,
                decoration: const InputDecoration(
                  border: InputBorder.none,
                  filled: false,
                  counterText: '',
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
