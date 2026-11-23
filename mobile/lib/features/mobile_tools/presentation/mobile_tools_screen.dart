import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:hospital_booking_mobile/core/widgets/app_error_banner.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/profile/application/patient_profile_controller.dart';
import 'package:hospital_booking_mobile/features/profile/domain/patient_profile.dart';
import 'package:hospital_booking_mobile/features/profile/presentation/widgets/profile_summary_widgets.dart';
import 'package:hospital_booking_mobile/features/security/application/app_lock_controller.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';

class MobileToolsScreen extends ConsumerWidget {
  const MobileToolsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileState = ref.watch(patientProfileControllerProvider);
    final lockState = ref.watch(appLockControllerProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Thẻ số & bảo mật')),
      body: RefreshIndicator(
        onRefresh: ref.read(patientProfileControllerProvider.notifier).refresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.md,
            AppSpacing.xs,
            AppSpacing.md,
            AppSpacing.xxl,
          ),
          children: [
            if (profileState.error != null) ...[
              AppErrorBanner(
                error: profileState.error!,
                onDismiss: ref
                    .read(patientProfileControllerProvider.notifier)
                    .dismissError,
              ),
              const SizedBox(height: AppSpacing.md),
            ],
            if (profileState.isInitialLoading && profileState.profile == null)
              const AppLoadingSkeleton(height: 330)
            else if (profileState.profile == null)
              AppEmptyState(
                icon: Icons.badge_outlined,
                title: 'Chưa tải được hồ sơ',
                message: 'Kết nối mạng và thử đồng bộ lại hồ sơ người khám.',
                action: FilledButton.icon(
                  onPressed: ref
                      .read(patientProfileControllerProvider.notifier)
                      .refresh,
                  icon: const Icon(Icons.refresh_outlined),
                  label: const Text('Thử lại'),
                ),
              )
            else
              _DigitalPatientCard(profile: profileState.profile!),
            const SizedBox(height: AppSpacing.lg),
            _SecurityCard(
              state: lockState,
              onChanged: (enabled) async {
                final changed = await ref
                    .read(appLockControllerProvider.notifier)
                    .setEnabled(enabled);
                if (!context.mounted) return;
                ScaffoldMessenger.of(context)
                  ..hideCurrentSnackBar()
                  ..showSnackBar(
                    SnackBar(
                      content: Text(
                        changed
                            ? enabled
                                  ? 'Đã bật khóa ứng dụng trên thiết bị này.'
                                  : 'Đã tắt khóa ứng dụng trên thiết bị này.'
                            : ref.read(appLockControllerProvider).message ??
                                  'Cài đặt chưa thay đổi.',
                      ),
                    ),
                  );
              },
            ),
            const SizedBox(height: AppSpacing.md),
            const _PrivacyNotice(),
          ],
        ),
      ),
    );
  }
}

class _DigitalPatientCard extends StatelessWidget {
  const _DigitalPatientCard({required this.profile});

  final PatientProfile profile;

  @override
  Widget build(BuildContext context) => Container(
    key: const Key('digital-patient-card'),
    padding: const EdgeInsets.all(AppSpacing.lg),
    decoration: BoxDecoration(
      gradient: LinearGradient(
        colors: [AppPalette.heroDeep, AppPalette.heroMid],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      borderRadius: BorderRadius.circular(AppRadius.xl),
      boxShadow: [
        BoxShadow(
          color: AppPalette.heroDeep.withValues(alpha: 0.18),
          blurRadius: 20,
          offset: const Offset(0, 8),
        ),
      ],
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const AppBrandMark(size: 42),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'THẺ KHÁM SỐ',
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: AppPalette.onHeroMuted,
                      fontWeight: AppFontWeight.strong,
                      letterSpacing: 0.8,
                    ),
                  ),
                  Text(
                    profile.fullName,
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      color: AppPalette.onHero,
                      fontWeight: AppFontWeight.strong,
                    ),
                  ),
                ],
              ),
            ),
            InkWell(
              key: const Key('digital-card-qr'),
              onTap: () => _showLargeQr(context, profile),
              borderRadius: BorderRadius.circular(AppRadius.md),
              child: Container(
                padding: const EdgeInsets.all(AppSpacing.xs),
                decoration: BoxDecoration(
                  color: AppPalette.onHero,
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                child: QrImageView(
                  data: 'HB-PATIENT:${profile.id}',
                  size: 82,
                  padding: EdgeInsets.zero,
                  semanticsLabel: 'Mã QR thẻ khám số, chạm để phóng to',
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),
        Wrap(
          spacing: 24,
          runSpacing: 12,
          children: [
            _CardValue(
              label: 'Ngày sinh',
              value: profile.dateOfBirth == null
                  ? 'Chưa cập nhật'
                  : formatDateVi(profile.dateOfBirth!),
            ),
            _CardValue(
              label: 'BHYT',
              value: profile.hasBhyt
                  ? _maskCode(profile.healthInsuranceCode)
                  : 'Không sử dụng',
            ),
            _CardValue(label: 'Mã hồ sơ', value: _shortId(profile.id)),
          ],
        ),
        const SizedBox(height: AppSpacing.md),
        Text(
          'Chạm vào mã QR để phóng to và đưa cho nhân viên khi đến khám. Danh tính vẫn được xác minh theo quy trình của cơ sở khám.',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: AppPalette.onHeroMuted,
            height: 1.4,
          ),
        ),
      ],
    ),
  );
}

void _showLargeQr(BuildContext context, PatientProfile profile) {
  showDialog<void>(
    context: context,
    builder: (dialogContext) => Dialog(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              profile.fullName,
              style: Theme.of(dialogContext).textTheme.titleMedium?.copyWith(
                fontWeight: AppFontWeight.strong,
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            Container(
              padding: const EdgeInsets.all(AppSpacing.sm),
              decoration: BoxDecoration(
                color: AppPalette.onHero,
                borderRadius: BorderRadius.circular(AppRadius.lg),
              ),
              child: QrImageView(
                data: 'HB-PATIENT:${profile.id}',
                size: 240,
                padding: EdgeInsets.zero,
                semanticsLabel: 'Mã QR thẻ khám số',
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              'Mã hồ sơ ${_shortId(profile.id)}',
              style: Theme.of(dialogContext).textTheme.bodySmall,
            ),
            const SizedBox(height: AppSpacing.sm),
            FilledButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('Đóng'),
            ),
          ],
        ),
      ),
    ),
  );
}

class _CardValue extends StatelessWidget {
  const _CardValue({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(label, style: const TextStyle(color: AppPalette.onHeroMuted)),
      const SizedBox(height: AppSpacing.hair),
      Text(
        value,
        style: const TextStyle(
          color: AppPalette.onHero,
          fontWeight: AppFontWeight.strong,
        ),
      ),
    ],
  );
}

class _SecurityCard extends StatelessWidget {
  const _SecurityCard({required this.state, required this.onChanged});

  final AppLockState state;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) => Card(
    margin: EdgeInsets.zero,
    child: Padding(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.fingerprint_outlined, color: context.colors.primary),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  'Khóa ứng dụng',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: AppFontWeight.strong,
                  ),
                ),
              ),
              Switch(
                key: const Key('app-lock-switch'),
                value: state.enabled,
                onChanged: state.isChecking || state.isAuthenticating
                    ? null
                    : onChanged,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            state.supported
                ? 'Yêu cầu vân tay, khuôn mặt hoặc mã khóa máy khi mở lại ứng dụng sau 5 phút chạy nền.'
                : 'Thiết bị chưa sẵn sàng. Hãy thiết lập khóa màn hình trong phần Cài đặt hệ thống.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
          if (state.message != null) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              state.message!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ],
        ],
      ),
    ),
  );
}

class _PrivacyNotice extends StatelessWidget {
  const _PrivacyNotice();

  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Icon(
        Icons.privacy_tip_outlined,
        size: 20,
        color: Theme.of(context).colorScheme.onSurfaceVariant,
      ),
      const SizedBox(width: AppSpacing.xs),
      Expanded(
        child: Text(
          'Vân tay và khuôn mặt chỉ nằm trên máy của bạn, ứng dụng không thu thập hay gửi đi.',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: Theme.of(context).colorScheme.onSurfaceVariant,
            height: 1.4,
          ),
        ),
      ),
    ],
  );
}

String _shortId(String value) {
  final compact = value.replaceAll('-', '').toUpperCase();
  return compact.length <= 8 ? compact : compact.substring(0, 8);
}

String _maskCode(String? value) {
  return maskInsuranceCode(value) ?? 'Đã đăng ký';
}
