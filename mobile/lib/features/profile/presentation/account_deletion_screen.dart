import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/providers/app_providers.dart';
import 'package:hospital_booking_mobile/core/widgets/app_error_banner.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/auth/presentation/login_panel.dart';
import 'package:hospital_booking_mobile/features/profile/application/account_deletion_controller.dart';

/// Xóa tài khoản: nói rõ điều gì bị xóa, điều gì được giữ, rồi xác nhận bằng mã gửi về email.
class AccountDeletionScreen extends ConsumerStatefulWidget {
  const AccountDeletionScreen({super.key});

  @override
  ConsumerState<AccountDeletionScreen> createState() =>
      _AccountDeletionScreenState();
}

class _AccountDeletionScreenState extends ConsumerState<AccountDeletionScreen> {
  final _otpController = TextEditingController();
  final _otpFocus = FocusNode();

  @override
  void dispose() {
    _otpController.dispose();
    _otpFocus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(accountDeletionControllerProvider);
    final controller = ref.read(accountDeletionControllerProvider.notifier);
    final text = Theme.of(context).textTheme;
    final colors = context.colors;
    final challenge = state.challenge;
    final debugOtp = ref.watch(appConfigProvider).enableNetworkLogs
        ? challenge?.debugOtp
        : null;

    return Scaffold(
      appBar: AppBar(title: const Text('Xóa tài khoản')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.md),
          children: [
            if (state.error != null) ...[
              AppErrorBanner(
                error: state.error!,
                onDismiss: controller.dismissError,
              ),
              const SizedBox(height: AppSpacing.md),
            ],
            Text('Khi xóa tài khoản', style: text.titleMedium),
            const SizedBox(height: AppSpacing.sm),
            const _Point(
              icon: Icons.person_off_outlined,
              text:
                  'Tên, email, số điện thoại, giấy tờ, địa chỉ, thông tin BHYT của bạn và người thân bị xóa khỏi tài khoản.',
            ),
            const _Point(
              icon: Icons.logout_outlined,
              text:
                  'Bạn bị đăng xuất trên mọi thiết bị, không nhận thông báo nữa.',
            ),
            const _Point(
              icon: Icons.folder_outlined,
              text:
                  'Kết quả khám, đơn thuốc, hóa đơn được cơ sở khám lưu theo quy định nhưng không còn gắn với tên hay liên hệ của bạn, và bạn không xem lại được trong ứng dụng.',
            ),
            const _Point(
              icon: Icons.mail_outlined,
              text:
                  'Sau này bạn vẫn đăng nhập lại bằng email này được, nhưng đó là tài khoản mới, trống.',
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Cần hủy các lịch chưa khám và thanh toán hóa đơn còn nợ trước. Thao tác này không hoàn tác được.',
              style: text.bodyMedium?.copyWith(color: colors.muted),
            ),
            const SizedBox(height: AppSpacing.lg),
            if (challenge == null)
              FilledButton(
                onPressed: state.isBusy ? null : controller.requestOtp,
                child: Text(
                  state.step == AccountDeletionStep.requesting
                      ? 'Đang gửi mã…'
                      : 'Gửi mã xác nhận về email',
                ),
              )
            else ...[
              Text(
                'Nhập mã 6 số đã gửi tới ${challenge.maskedTarget}.',
                style: text.bodyMedium,
              ),
              if (debugOtp != null) ...[
                const SizedBox(height: AppSpacing.xs),
                Text('Mã thử nghiệm: $debugOtp', style: text.bodySmall),
              ],
              const SizedBox(height: AppSpacing.sm),
              OtpCodeField(
                controller: _otpController,
                focusNode: _otpFocus,
                enabled: !state.isBusy,
              ),
              const SizedBox(height: AppSpacing.md),
              FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: Theme.of(context).colorScheme.error,
                  foregroundColor: Theme.of(context).colorScheme.onError,
                ),
                onPressed: state.isBusy ? null : _confirm,
                child: Text(
                  state.step == AccountDeletionStep.confirming
                      ? 'Đang xóa tài khoản…'
                      : 'Xóa tài khoản',
                ),
              ),
              TextButton(
                onPressed: state.isBusy ? null : controller.requestOtp,
                child: const Text('Gửi lại mã'),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Future<void> _confirm() async {
    final otp = _otpController.text.trim();
    if (!RegExp(r'^\d{6}$').hasMatch(otp)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Mã xác nhận phải có đúng 6 chữ số.')),
      );
      return;
    }
    final sure = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Xóa tài khoản?'),
        content: const Text(
          'Tài khoản và thông tin cá nhân sẽ bị xóa, không hoàn tác được.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Giữ tài khoản'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Xóa'),
          ),
        ],
      ),
    );
    if (sure != true || !mounted) return;
    final messenger = ScaffoldMessenger.of(context);
    final router = GoRouter.of(context);
    final deleted = await ref
        .read(accountDeletionControllerProvider.notifier)
        .confirm(otp);
    if (!deleted) return;
    router.go('/home');
    messenger.showSnackBar(
      const SnackBar(content: Text('Đã xóa tài khoản của bạn.')),
    );
  }
}

class _Point extends StatelessWidget {
  const _Point({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: AppSpacing.sm),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 20, color: context.colors.muted),
        const SizedBox(width: AppSpacing.sm),
        Expanded(child: Text(text)),
      ],
    ),
  );
}
