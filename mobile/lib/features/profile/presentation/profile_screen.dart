import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:hospital_booking_mobile/core/widgets/app_error_banner.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/booking/application/booking_flow_controller.dart';
import 'package:hospital_booking_mobile/features/booking/application/booking_submission_controller.dart';
import 'package:hospital_booking_mobile/features/notifications/application/push_notifications_controller.dart';
import 'package:hospital_booking_mobile/features/profile/application/patient_profile_controller.dart';
import 'package:hospital_booking_mobile/features/profile/presentation/widgets/profile_menu_widgets.dart';
import 'package:hospital_booking_mobile/features/profile/presentation/widgets/profile_summary_widgets.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(patientProfileControllerProvider);
    final isLoggingOut = ref.watch(
      authControllerProvider.select((state) => state.isLoggingOut),
    );
    final controller = ref.read(patientProfileControllerProvider.notifier);
    final pushState = ref.watch(pushNotificationsControllerProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Hồ sơ người khám'),
        actions: [
          if (state.profile != null)
            IconButton(
              tooltip: 'Chỉnh sửa hồ sơ',
              onPressed: state.isSaving
                  ? null
                  : () => _openEditor(context, ref),
              icon: const Icon(Icons.edit_outlined),
            ),
        ],
      ),
      body: SafeArea(
        child: state.isInitialLoading && state.profile == null
            ? const ProfileLoading()
            : RefreshIndicator(
                onRefresh: controller.refresh,
                child: ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(
                    16,
                    8,
                    16,
                    appFloatingActionContentBottomInset,
                  ),
                  children: [
                    if (state.error != null) ...[
                      AppErrorBanner(
                        error: state.error!,
                        onDismiss: controller.dismissError,
                      ),
                      const SizedBox(height: 14),
                    ],
                    if (state.profile == null)
                      AppEmptyState(
                        icon: Icons.person_off_outlined,
                        title: 'Không tải được hồ sơ',
                        message:
                            'Kiểm tra kết nối mạng rồi thử đồng bộ lại hồ sơ người khám.',
                        action: FilledButton.icon(
                          onPressed: controller.refresh,
                          icon: const Icon(Icons.refresh_rounded),
                          label: const Text('Thử lại'),
                        ),
                      )
                    else ...[
                      if (state.isRefreshing)
                        const LinearProgressIndicator(minHeight: 2),
                      if (state.isRefreshing) const SizedBox(height: 12),
                      ProfileHeader(profile: state.profile!),
                      const SizedBox(height: 14),
                      ProfileCompletionCard(profile: state.profile!),
                      const SizedBox(height: 14),
                      ProfileSection(
                        title: 'Thông tin cá nhân',
                        icon: Icons.badge_outlined,
                        children: [
                          ProfileRow(
                            label: 'Ngày sinh',
                            value: state.profile!.dateOfBirth == null
                                ? null
                                : formatDateVi(state.profile!.dateOfBirth!),
                          ),
                          ProfileRow(
                            label: 'Giới tính',
                            value: state.profile!.gender?.label,
                          ),
                          ProfileRow(label: 'CCCD', value: state.profile!.cccd),
                          ProfileRow(
                            label: 'Địa chỉ',
                            value: state.profile!.address,
                            showDivider: false,
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      ProfileInsuranceCard(profile: state.profile!),
                      const SizedBox(height: 14),
                      ProfileHealthSnapshot(profile: state.profile!),
                      const SizedBox(height: 14),
                      const ProfileGroupTitle(title: 'Thẻ số & bảo mật'),
                      const SizedBox(height: 8),
                      ProfilePatientShortcuts(),
                      const SizedBox(height: 14),
                      const ProfileGroupTitle(title: 'Ứng dụng & hỗ trợ'),
                      const SizedBox(height: 8),
                      ProfileAppSupportSection(pushState: pushState),
                      const SizedBox(height: 20),
                      FilledButton.icon(
                        onPressed: () => _openEditor(context, ref),
                        icon: const Icon(Icons.edit_outlined),
                        label: const Text('Chỉnh sửa hồ sơ'),
                      ),
                      const SizedBox(height: 12),
                    ],
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
                        isLoggingOut
                            ? 'Đang đăng xuất…'
                            : 'Đăng xuất thiết bị này',
                      ),
                    ),
                  ],
                ),
              ),
      ),
    );
  }

  Future<void> _openEditor(BuildContext context, WidgetRef ref) async {
    final updated = await context.push<bool>('/profile/edit');
    if (!context.mounted || updated != true) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        const SnackBar(content: Text('Đã cập nhật hồ sơ người khám.')),
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
      final discarded = await submissionController.discardPending();
      if (!context.mounted) return;
      if (!discarded) {
        final error = ref.read(bookingSubmissionControllerProvider).error;
        messenger.showSnackBar(
          SnackBar(
            content: Text(
              error?.message ??
                  'Chưa thể giải phóng lịch đang giữ. Vui lòng thử lại.',
            ),
          ),
        );
        return;
      }
      await ref.read(bookingFlowControllerProvider.notifier).clearSelection();
    }
    final loggedOut = await ref.read(authControllerProvider.notifier).logout();
    if (!context.mounted || !loggedOut) return;

    context.go('/home');
    // `loggedOut` is a transition state used by the route guard to leave the
    // protected profile without immediately opening login again. Once the
    // guest home is selected, restore the normal guest state so a later tap on
    // a protected feature opens login and preserves that destination.
    ref.read(authControllerProvider.notifier).restartLogin();
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
        'Lịch $bookingCode vẫn đang được giữ và chờ OTP. Nếu tiếp tục đăng xuất, ứng dụng sẽ hủy giữ lịch trên máy chủ và giải phóng khung giờ ngay.',
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
          child: const Text('Bỏ lịch và đăng xuất'),
        ),
      ],
    ),
  );
}
