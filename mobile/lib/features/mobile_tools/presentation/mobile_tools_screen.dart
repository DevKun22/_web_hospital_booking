import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/app/theme/app_theme.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:hospital_booking_mobile/core/widgets/app_error_banner.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/profile/application/patient_profile_controller.dart';
import 'package:hospital_booking_mobile/features/profile/domain/patient_profile.dart';
import 'package:hospital_booking_mobile/features/security/application/app_lock_controller.dart';
import 'package:qr_flutter/qr_flutter.dart';

class MobileToolsScreen extends ConsumerWidget {
  const MobileToolsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileState = ref.watch(patientProfileControllerProvider);
    final lockState = ref.watch(appLockControllerProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Tiện ích trên điện thoại')),
      body: RefreshIndicator(
        onRefresh: ref.read(patientProfileControllerProvider.notifier).refresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
          children: [
            const AppPageIntro(
              title: 'Nhanh hơn nhưng vẫn an toàn',
              subtitle:
                  'Dùng thẻ bệnh nhân số và khóa cục bộ để hạn chế lộ dữ liệu khi người khác cầm điện thoại.',
              badge: 'Chỉ trên mobile',
            ),
            const SizedBox(height: 18),
            if (profileState.error != null) ...[
              AppErrorBanner(
                error: profileState.error!,
                onDismiss: ref
                    .read(patientProfileControllerProvider.notifier)
                    .dismissError,
              ),
              const SizedBox(height: 14),
            ],
            if (profileState.isInitialLoading && profileState.profile == null)
              const AppLoadingSkeleton(height: 330)
            else if (profileState.profile == null)
              AppEmptyState(
                icon: Icons.badge_outlined,
                title: 'Chưa tải được hồ sơ',
                message: 'Kết nối mạng và thử đồng bộ lại hồ sơ bệnh nhân.',
                action: FilledButton.icon(
                  onPressed: ref
                      .read(patientProfileControllerProvider.notifier)
                      .refresh,
                  icon: const Icon(Icons.refresh_rounded),
                  label: const Text('Thử lại'),
                ),
              )
            else
              _DigitalPatientCard(profile: profileState.profile!),
            const SizedBox(height: 18),
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
            const SizedBox(height: 14),
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
    padding: const EdgeInsets.all(20),
    decoration: BoxDecoration(
      gradient: const LinearGradient(
        colors: [AppTheme.primaryDark, AppTheme.primary],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      borderRadius: BorderRadius.circular(24),
      boxShadow: [
        BoxShadow(
          color: AppTheme.primaryDark.withValues(alpha: 0.18),
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
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'THẺ BỆNH NHÂN SỐ',
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: Colors.white70,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.8,
                    ),
                  ),
                  Text(
                    profile.fullName,
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.all(7),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
              ),
              child: QrImageView(
                data: 'HB-PATIENT:${profile.id}',
                size: 82,
                padding: EdgeInsets.zero,
                semanticsLabel: 'QR thẻ bệnh nhân số',
              ),
            ),
          ],
        ),
        const SizedBox(height: 22),
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
        const SizedBox(height: 16),
        Text(
          'Thẻ hiện dùng để trình bày mã hồ sơ trên điện thoại. Nhân viên vẫn tra cứu và xác minh danh tính theo quy trình của bệnh viện.',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: Colors.white.withValues(alpha: 0.82),
            height: 1.4,
          ),
        ),
      ],
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
      Text(label, style: const TextStyle(color: Colors.white70, fontSize: 12)),
      const SizedBox(height: 2),
      Text(
        value,
        style: const TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.w800,
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
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.fingerprint_rounded, color: AppTheme.primary),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Khóa ứng dụng',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
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
          const SizedBox(height: 6),
          Text(
            state.supported
                ? 'Yêu cầu vân tay, khuôn mặt hoặc mã khóa thiết bị sau khi ứng dụng chạy nền.'
                : 'Thiết bị chưa sẵn sàng. Hãy thiết lập khóa màn hình trong phần Cài đặt hệ thống.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
          if (state.message != null) ...[
            const SizedBox(height: 8),
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
      const SizedBox(width: 9),
      Expanded(
        child: Text(
          'Ứng dụng không gửi dữ liệu vân tay hoặc khuôn mặt lên máy chủ. Hệ điều hành chỉ trả về kết quả xác thực thành công hoặc thất bại.',
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
  final normalized = value?.trim();
  if (normalized == null || normalized.isEmpty) return 'Đã đăng ký';
  if (normalized.length <= 6) return normalized;
  return '${normalized.substring(0, 3)}•••${normalized.substring(normalized.length - 3)}';
}
