import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/booking/application/booking_flow_controller.dart';
import 'package:hospital_booking_mobile/features/booking/application/booking_submission_controller.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;
    final isLoggingOut = ref.watch(
      authControllerProvider.select((state) => state.isLoggingOut),
    );

    return Scaffold(
      appBar: AppBar(title: const Text('Hồ sơ bệnh nhân')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            CircleAvatar(
              radius: 42,
              child: Text(
                (user?.fullName.isNotEmpty ?? false)
                    ? user!.fullName.substring(0, 1).toUpperCase()
                    : 'B',
                style: Theme.of(context).textTheme.headlineMedium,
              ),
            ),
            const SizedBox(height: 20),
            Card(
              child: Column(
                children: [
                  ListTile(
                    leading: const Icon(Icons.person_outline),
                    title: const Text('Họ và tên'),
                    subtitle: Text(user?.fullName ?? 'Chưa cập nhật'),
                  ),
                  const Divider(height: 1),
                  ListTile(
                    leading: const Icon(Icons.phone_outlined),
                    title: const Text('Số điện thoại'),
                    subtitle: Text(user?.phone ?? 'Chưa cập nhật'),
                  ),
                  const Divider(height: 1),
                  ListTile(
                    leading: const Icon(Icons.email_outlined),
                    title: const Text('Email'),
                    subtitle: Text(user?.email ?? 'Chưa cập nhật'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            OutlinedButton.icon(
              style: OutlinedButton.styleFrom(
                foregroundColor: Theme.of(context).colorScheme.error,
              ),
              onPressed: isLoggingOut
                  ? null
                  : () => _requestLogout(context, ref),
              icon: isLoggingOut
                  ? const SizedBox.square(
                      dimension: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.logout),
              label: Text(
                isLoggingOut ? 'Đang đăng xuất…' : 'Đăng xuất thiết bị này',
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _requestLogout(BuildContext context, WidgetRef ref) async {
    final submissionController = ref.read(
      bookingSubmissionControllerProvider.notifier,
    );
    await submissionController.waitUntilRestored();
    if (!context.mounted) return;
    final submission = ref.read(bookingSubmissionControllerProvider);
    final pending = submission.pending;
    final bool? confirmed;
    if (pending == null) {
      confirmed = await _showStandardConfirmation(context);
    } else {
      confirmed = await _showPendingBookingConfirmation(
        context,
        bookingCode: pending.bookingCode,
      );
    }
    if (confirmed != true || !context.mounted) return;

    final messenger = ScaffoldMessenger.of(context);
    if (pending != null) {
      await submissionController.reset();
      await ref.read(bookingFlowControllerProvider.notifier).clearSelection();
    }
    final loggedOut = await ref.read(authControllerProvider.notifier).logout();
    if (!context.mounted || !loggedOut) return;

    context.go('/home');
    messenger
      ..hideCurrentSnackBar()
      ..showSnackBar(
        const SnackBar(content: Text('Đã đăng xuất khỏi thiết bị này.')),
      );
  }

  Future<bool?> _showStandardConfirmation(
    BuildContext context,
  ) => showDialog<bool>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      icon: const Icon(Icons.logout_rounded),
      title: const Text('Đăng xuất khỏi thiết bị?'),
      content: const Text(
        'Bạn sẽ cần xác thực OTP khi đăng nhập lại. Các lịch khám đã đặt trên hệ thống không bị xóa.',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(dialogContext, false),
          child: const Text('Ở lại'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(dialogContext, true),
          child: const Text('Đăng xuất'),
        ),
      ],
    ),
  );

  Future<bool?> _showPendingBookingConfirmation(
    BuildContext context, {
    required String bookingCode,
  }) => showDialog<bool>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      icon: const Icon(Icons.warning_amber_rounded),
      title: const Text('Bạn còn lịch chờ xác thực'),
      content: Text(
        'Lịch $bookingCode vẫn đang được giữ và chờ OTP. Đăng xuất sẽ xóa thông tin tiếp tục xác thực khỏi thiết bị; lịch trên hệ thống sẽ tự hết hạn nếu không được xác thực.',
      ),
      actions: [
        TextButton(
          onPressed: () {
            Navigator.pop(dialogContext, false);
            context.go('/booking/verify');
          },
          child: const Text('Tiếp tục xác thực'),
        ),
        FilledButton(
          style: FilledButton.styleFrom(
            backgroundColor: Theme.of(context).colorScheme.error,
            foregroundColor: Theme.of(context).colorScheme.onError,
          ),
          onPressed: () => Navigator.pop(dialogContext, true),
          child: const Text('Đăng xuất và bỏ phiên'),
        ),
      ],
    ),
  );
}
