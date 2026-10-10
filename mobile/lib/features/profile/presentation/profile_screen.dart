import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/app/theme/app_theme.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:hospital_booking_mobile/core/widgets/app_error_banner.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/booking/application/booking_flow_controller.dart';
import 'package:hospital_booking_mobile/features/booking/application/booking_submission_controller.dart';
import 'package:hospital_booking_mobile/features/profile/application/patient_profile_controller.dart';
import 'package:hospital_booking_mobile/features/profile/domain/patient_profile.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(patientProfileControllerProvider);
    final isLoggingOut = ref.watch(
      authControllerProvider.select((state) => state.isLoggingOut),
    );
    final controller = ref.read(patientProfileControllerProvider.notifier);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Hồ sơ bệnh nhân'),
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
            ? const _ProfileLoading()
            : RefreshIndicator(
                onRefresh: controller.refresh,
                child: ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
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
                            'Kiểm tra kết nối mạng rồi thử đồng bộ lại hồ sơ bệnh nhân.',
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
                      _ProfileHeader(profile: state.profile!),
                      const SizedBox(height: 14),
                      _CompletionCard(profile: state.profile!),
                      const SizedBox(height: 14),
                      _ProfileSection(
                        title: 'Thông tin cá nhân',
                        icon: Icons.badge_outlined,
                        children: [
                          _ProfileRow(
                            label: 'Ngày sinh',
                            value: state.profile!.dateOfBirth == null
                                ? null
                                : formatDateVi(state.profile!.dateOfBirth!),
                          ),
                          _ProfileRow(
                            label: 'Giới tính',
                            value: state.profile!.gender?.label,
                          ),
                          _ProfileRow(
                            label: 'CCCD',
                            value: state.profile!.cccd,
                          ),
                          _ProfileRow(
                            label: 'Địa chỉ',
                            value: state.profile!.address,
                            showDivider: false,
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      _InsuranceCard(profile: state.profile!),
                      const SizedBox(height: 14),
                      _HealthSnapshot(profile: state.profile!),
                      const SizedBox(height: 14),
                      _PatientShortcuts(),
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
        const SnackBar(content: Text('Đã cập nhật hồ sơ bệnh nhân.')),
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

class _ProfileHeader extends StatelessWidget {
  const _ProfileHeader({required this.profile});

  final PatientProfile profile;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(20),
    decoration: BoxDecoration(
      gradient: const LinearGradient(
        colors: [AppTheme.primaryDark, AppTheme.primary],
      ),
      borderRadius: BorderRadius.circular(22),
    ),
    child: Row(
      children: [
        CircleAvatar(
          radius: 34,
          backgroundColor: Colors.white.withValues(alpha: 0.18),
          child: Text(
            profile.fullName.isEmpty
                ? 'B'
                : profile.fullName.substring(0, 1).toUpperCase(),
            style: Theme.of(context).textTheme.headlineMedium?.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                profile.fullName,
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                profile.phone ?? 'Chưa cập nhật số điện thoại',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Colors.white.withValues(alpha: 0.86),
                ),
              ),
              if (profile.isPhoneVerified) ...[
                const SizedBox(height: 8),
                const AppStatusBadge(
                  label: 'Đã xác thực',
                  tone: AppStatusTone.success,
                  icon: Icons.verified_outlined,
                ),
              ],
            ],
          ),
        ),
      ],
    ),
  );
}

class _CompletionCard extends StatelessWidget {
  const _CompletionCard({required this.profile});

  final PatientProfile profile;

  @override
  Widget build(BuildContext context) => Card(
    margin: EdgeInsets.zero,
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.fact_check_outlined),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Mức độ hoàn thiện hồ sơ',
                  style: Theme.of(
                    context,
                  ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
                ),
              ),
              Text(
                '${profile.completionPercent}%',
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  color: Theme.of(context).colorScheme.primary,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          LinearProgressIndicator(
            value: profile.completionPercent / 100,
            minHeight: 8,
            borderRadius: BorderRadius.circular(999),
          ),
          const SizedBox(height: 10),
          Text(
            profile.completionPercent >= 90
                ? 'Hồ sơ đã đủ thông tin để hỗ trợ tiếp nhận nhanh hơn.'
                : 'Bổ sung thông tin còn thiếu để bệnh viện tiếp nhận thuận tiện hơn.',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    ),
  );
}

class _InsuranceCard extends StatelessWidget {
  const _InsuranceCard({required this.profile});

  final PatientProfile profile;

  @override
  Widget build(BuildContext context) => _ProfileSection(
    title: 'Bảo hiểm y tế',
    icon: Icons.health_and_safety_outlined,
    children: [
      _ProfileRow(
        label: 'Trạng thái',
        value: profile.hasBhyt ? 'Có sử dụng BHYT' : 'Không sử dụng BHYT',
      ),
      if (profile.hasBhyt) ...[
        _ProfileRow(label: 'Mã thẻ BHYT', value: profile.healthInsuranceCode),
        _ProfileRow(
          label: 'Nơi đăng ký KCB',
          value: profile.registeredHospital,
          showDivider: false,
        ),
      ] else
        const _ProfileRow(
          label: 'Thông tin',
          value: 'Có thể bổ sung khi chỉnh sửa hồ sơ',
          showDivider: false,
        ),
    ],
  );
}

class _HealthSnapshot extends StatelessWidget {
  const _HealthSnapshot({required this.profile});

  final PatientProfile profile;

  @override
  Widget build(BuildContext context) => _ProfileSection(
    title: 'Thông tin sức khỏe',
    icon: Icons.monitor_heart_outlined,
    children: [
      _ProfileRow(label: 'Nhóm máu', value: profile.bloodType),
      _ProfileRow(
        label: 'Chiều cao / Cân nặng',
        value: profile.height == null && profile.weight == null
            ? null
            : '${_number(profile.height)} cm · ${_number(profile.weight)} kg',
      ),
      _ProfileRow(label: 'Huyết áp', value: profile.bloodPressure),
      _ProfileRow(label: 'Dị ứng', value: profile.allergies),
      _ProfileRow(
        label: 'Tiền sử bệnh',
        value: profile.medicalHistory,
        showDivider: false,
      ),
    ],
  );
}

class _PatientShortcuts extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Card(
    margin: EdgeInsets.zero,
    child: Column(
      children: [
        ListTile(
          leading: const Icon(Icons.event_note_outlined),
          title: const Text('Lịch khám của tôi'),
          trailing: const Icon(Icons.chevron_right_rounded),
          onTap: () => context.push('/appointments'),
        ),
        const Divider(height: 1),
        ListTile(
          leading: const Icon(Icons.folder_shared_outlined),
          title: const Text('Kết quả khám'),
          trailing: const Icon(Icons.chevron_right_rounded),
          onTap: () => context.push('/medical-records'),
        ),
        const Divider(height: 1),
        ListTile(
          leading: const Icon(Icons.medication_outlined),
          title: const Text('Đơn thuốc'),
          trailing: const Icon(Icons.chevron_right_rounded),
          onTap: () => context.push('/prescriptions'),
        ),
        const Divider(height: 1),
        ListTile(
          leading: const Icon(Icons.receipt_long_outlined),
          title: const Text('Hóa đơn và BHYT'),
          trailing: const Icon(Icons.chevron_right_rounded),
          onTap: () => context.push('/invoices'),
        ),
      ],
    ),
  );
}

class _ProfileSection extends StatelessWidget {
  const _ProfileSection({
    required this.title,
    required this.icon,
    required this.children,
  });

  final String title;
  final IconData icon;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Card(
    margin: EdgeInsets.zero,
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: Theme.of(context).colorScheme.primary),
              const SizedBox(width: 10),
              Text(
                title,
                style: Theme.of(
                  context,
                ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ...children,
        ],
      ),
    ),
  );
}

class _ProfileRow extends StatelessWidget {
  const _ProfileRow({
    required this.label,
    required this.value,
    this.showDivider = true,
  });

  final String label;
  final String? value;
  final bool showDivider;

  @override
  Widget build(BuildContext context) => Column(
    children: [
      Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 118,
              child: Text(
                label,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                value?.trim().isNotEmpty == true ? value! : 'Chưa cập nhật',
                textAlign: TextAlign.right,
                style: Theme.of(
                  context,
                ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
      ),
      if (showDivider) const Divider(height: 1),
    ],
  );
}

class _ProfileLoading extends StatelessWidget {
  const _ProfileLoading();

  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(16),
    children: const [
      AppLoadingSkeleton(height: 150),
      SizedBox(height: 14),
      AppLoadingSkeleton(height: 130),
      SizedBox(height: 14),
      AppLoadingSkeleton(height: 300),
    ],
  );
}

String _number(double? value) {
  if (value == null) return '—';
  return value == value.roundToDouble()
      ? value.toInt().toString()
      : value.toStringAsFixed(1);
}
