import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/core/providers/app_providers.dart';
import 'package:hospital_booking_mobile/core/widgets/app_error_banner.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/booking/application/booking_flow_controller.dart';
import 'package:hospital_booking_mobile/features/booking/application/booking_submission_controller.dart';
import 'package:hospital_booking_mobile/features/booking/domain/booking_submission.dart';

class BookingVerifyOtpScreen extends ConsumerStatefulWidget {
  const BookingVerifyOtpScreen({super.key});

  @override
  ConsumerState<BookingVerifyOtpScreen> createState() =>
      _BookingVerifyOtpScreenState();
}

class _BookingVerifyOtpScreenState
    extends ConsumerState<BookingVerifyOtpScreen> {
  final _otpController = TextEditingController();
  Timer? _timer;
  late DateTime _resendAvailableAt;

  @override
  void initState() {
    super.initState();
    _resendAvailableAt = DateTime.now().add(const Duration(seconds: 60));
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() {});
      ref.read(bookingSubmissionControllerProvider.notifier).expirePending();
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _otpController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(bookingSubmissionControllerProvider);
    final config = ref.watch(appConfigProvider);
    final pending = state.pending;
    final isBusy = state.isBusy;

    ref.listen(
      bookingSubmissionControllerProvider.select((value) => value.status),
      (previous, next) {
        if (next == BookingSubmissionStatus.success &&
            previous != BookingSubmissionStatus.success) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) context.go('/booking/success');
          });
        }
      },
    );

    return PopScope<void>(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop && !isBusy) context.go('/home');
      },
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Xác thực đặt lịch'),
          leading: IconButton(
            onPressed: isBusy ? null : () => context.go('/home'),
            tooltip: 'Về trang chủ',
            icon: const Icon(Icons.close_rounded),
          ),
        ),
        body: SafeArea(
          child: switch (state.status) {
            BookingSubmissionStatus.restoring => const Center(
              child: CircularProgressIndicator(),
            ),
            BookingSubmissionStatus.expired => AppEmptyState(
              icon: Icons.timer_off_outlined,
              title: 'Đã hết thời gian giữ lịch',
              message:
                  state.error?.message ??
                  'Vui lòng chọn lại khung giờ để tạo lịch mới.',
              action: FilledButton.icon(
                onPressed: _chooseAgain,
                icon: const Icon(Icons.event_repeat_outlined),
                label: const Text('Chọn lại lịch'),
              ),
            ),
            _ when pending == null => AppEmptyState(
              icon: Icons.mark_email_read_outlined,
              title: 'Không có lịch chờ xác thực',
              message: 'Hãy chọn lịch khám trước khi nhập mã OTP.',
              action: FilledButton(
                onPressed: () => context.go('/booking'),
                child: const Text('Chọn lịch khám'),
              ),
            ),
            _ => _buildOtpForm(context, pending, config.enableNetworkLogs),
          },
        ),
      ),
    );
  }

  Widget _buildOtpForm(
    BuildContext context,
    PendingBooking pending,
    bool showDebugOtp,
  ) {
    final state = ref.watch(bookingSubmissionControllerProvider);
    final remaining = pending.holdExpiresAt?.difference(DateTime.now());
    final secondsUntilResend = _resendAvailableAt
        .difference(DateTime.now())
        .inSeconds
        .clamp(0, 60);
    final target = pending.otpTarget?.toString().trim();

    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(24, 12, 24, 32),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 480),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Icon(Icons.mark_email_unread_outlined, size: 58),
              const SizedBox(height: 18),
              Text(
                'Nhập mã OTP',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                target == null || target.isEmpty
                    ? 'Mã xác thực đã được gửi qua kênh bạn đã chọn.'
                    : 'Mã xác thực đã được gửi đến ${_maskTarget(target)}.',
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  AppStatusBadge(
                    label: 'MÃ LỊCH ${pending.bookingCode}',
                    tone: AppStatusTone.info,
                    icon: Icons.confirmation_number_outlined,
                  ),
                  if (remaining != null) ...[
                    const SizedBox(width: 8),
                    AppStatusBadge(
                      label: 'GIỮ ${_formatRemaining(remaining)}',
                      tone: remaining.inMinutes < 2
                          ? AppStatusTone.warning
                          : AppStatusTone.success,
                      icon: Icons.timer_outlined,
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 22),
              if (pending.otpDeliveryStatus == 'FAILED') ...[
                const _DeliveryNotice(
                  icon: Icons.sms_failed_outlined,
                  message:
                      'Máy chủ chưa gửi được OTP. Vui lòng đợi hết thời gian giới hạn rồi chọn gửi lại.',
                  warning: true,
                ),
                const SizedBox(height: 12),
              ] else if (pending.otpDeliveryStatus == 'PENDING') ...[
                const _DeliveryNotice(
                  icon: Icons.outgoing_mail,
                  message:
                      'Yêu cầu gửi OTP đang được xử lý. Nếu chưa nhận được mã, bạn có thể gửi lại sau thời gian chờ.',
                ),
                const SizedBox(height: 12),
              ],
              if (showDebugOtp && pending.debugOtp != null) ...[
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Text(
                      'OTP local: ${pending.debugOtp}',
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
              ],
              if (state.error != null) ...[
                AppErrorBanner(
                  error: state.error!,
                  onDismiss: ref
                      .read(bookingSubmissionControllerProvider.notifier)
                      .dismissError,
                ),
                const SizedBox(height: 16),
              ],
              TextField(
                controller: _otpController,
                enabled: !state.isBusy,
                keyboardType: TextInputType.number,
                maxLength: 6,
                textAlign: TextAlign.center,
                autofillHints: const [AutofillHints.oneTimeCode],
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  letterSpacing: 10,
                  fontWeight: FontWeight.w800,
                ),
                decoration: const InputDecoration(
                  labelText: 'Mã OTP gồm 6 số',
                  counterText: '',
                ),
                onSubmitted: (_) => _verify(),
              ),
              const SizedBox(height: 18),
              FilledButton(
                onPressed: state.isBusy ? null : _verify,
                child: state.status == BookingSubmissionStatus.verifyingOtp
                    ? const SizedBox.square(
                        dimension: 22,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Xác nhận lịch khám'),
              ),
              const SizedBox(height: 8),
              TextButton(
                onPressed: state.isBusy || secondsUntilResend > 0
                    ? null
                    : _resend,
                child: Text(
                  secondsUntilResend > 0
                      ? 'Gửi lại mã sau ${secondsUntilResend}s'
                      : state.status == BookingSubmissionStatus.resendingOtp
                      ? 'Đang gửi lại…'
                      : 'Gửi lại mã OTP',
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Bạn có thể về Trang chủ và tiếp tục xác thực sau, miễn là lịch vẫn còn thời gian giữ.',
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

  Future<void> _verify() async {
    final otp = _otpController.text.trim();
    if (!RegExp(r'^\d{6}$').hasMatch(otp)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('OTP phải có đúng 6 chữ số.')),
      );
      return;
    }
    FocusScope.of(context).unfocus();
    await ref.read(bookingSubmissionControllerProvider.notifier).verifyOtp(otp);
  }

  Future<void> _resend() async {
    setState(() {
      _resendAvailableAt = DateTime.now().add(const Duration(seconds: 60));
    });
    final sent = await ref
        .read(bookingSubmissionControllerProvider.notifier)
        .resendOtp();
    if (!mounted || !sent) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(const SnackBar(content: Text('Đã gửi lại mã OTP.')));
  }

  Future<void> _chooseAgain() async {
    await ref.read(bookingSubmissionControllerProvider.notifier).reset();
    await ref.read(bookingFlowControllerProvider.notifier).refreshSlots();
    if (mounted) context.go('/booking');
  }
}

class _DeliveryNotice extends StatelessWidget {
  const _DeliveryNotice({
    required this.icon,
    required this.message,
    this.warning = false,
  });

  final IconData icon;
  final String message;
  final bool warning;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: warning ? colors.errorContainer : colors.secondaryContainer,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            icon,
            color: warning
                ? colors.onErrorContainer
                : colors.onSecondaryContainer,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: TextStyle(
                color: warning
                    ? colors.onErrorContainer
                    : colors.onSecondaryContainer,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

String _maskTarget(String value) {
  if (value.contains('@')) {
    final parts = value.split('@');
    final name = parts.first;
    final visible = name.length <= 2
        ? name.characters.first
        : name.substring(0, 2);
    return '$visible***@${parts.last}';
  }
  if (value.length <= 4) return value;
  return '${value.substring(0, 3)}***${value.substring(value.length - 3)}';
}

String _formatRemaining(Duration duration) {
  final seconds = duration.inSeconds.clamp(0, 24 * 60 * 60);
  final minutesPart = seconds ~/ 60;
  final secondsPart = seconds % 60;
  return '${minutesPart.toString().padLeft(2, '0')}:${secondsPart.toString().padLeft(2, '0')}';
}
