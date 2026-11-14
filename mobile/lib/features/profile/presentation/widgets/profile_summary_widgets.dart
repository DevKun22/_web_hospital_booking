import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/core/theme/app_theme.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/profile/domain/patient_profile.dart';
import 'package:hospital_booking_mobile/features/profile/presentation/widgets/profile_menu_widgets.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';

class ProfileHeader extends StatelessWidget {
  const ProfileHeader({super.key, required this.profile});

  final PatientProfile profile;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(20),
    decoration: BoxDecoration(
      gradient: LinearGradient(
        colors: [AppPalette.heroDeep, AppPalette.heroMid],
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
                profile.phone == null
                    ? 'Chưa cập nhật số điện thoại'
                    : maskPhone(profile.phone!),
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

class ProfileCompletionCard extends StatelessWidget {
  const ProfileCompletionCard({super.key, required this.profile});

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

class ProfileInsuranceCard extends StatelessWidget {
  const ProfileInsuranceCard({super.key, required this.profile});

  final PatientProfile profile;

  @override
  Widget build(BuildContext context) => ProfileSection(
    title: 'Bảo hiểm y tế',
    icon: Icons.health_and_safety_outlined,
    children: [
      ProfileRow(
        label: 'Trạng thái',
        value: profile.hasBhyt ? 'Có sử dụng BHYT' : 'Không sử dụng BHYT',
      ),
      if (profile.hasBhyt) ...[
        ProfileRow(
          label: 'Mã thẻ BHYT',
          value: maskInsuranceCode(profile.healthInsuranceCode),
        ),
        ProfileRow(
          label: 'Nơi đăng ký KCB',
          value: profile.registeredHospital,
          showDivider: false,
        ),
      ] else
        const ProfileRow(
          label: 'Thông tin',
          value: 'Có thể bổ sung khi chỉnh sửa hồ sơ',
          showDivider: false,
        ),
    ],
  );
}

class ProfileHealthSnapshot extends StatelessWidget {
  const ProfileHealthSnapshot({super.key, required this.profile});

  final PatientProfile profile;

  @override
  Widget build(BuildContext context) => ProfileSection(
    title: 'Thông tin sức khỏe',
    icon: Icons.monitor_heart_outlined,
    children: [
      ProfileRow(label: 'Nhóm máu', value: profile.bloodType),
      ProfileRow(
        label: 'Chiều cao / Cân nặng',
        value: profile.height == null && profile.weight == null
            ? null
            : '${profileNumber(profile.height)} cm · ${profileNumber(profile.weight)} kg',
      ),
      ProfileRow(label: 'Huyết áp', value: profile.bloodPressure),
      ProfileRow(label: 'Dị ứng', value: profile.allergies),
      ProfileRow(
        label: 'Tiền sử bệnh',
        value: profile.medicalHistory,
        showDivider: false,
      ),
    ],
  );
}

String profileNumber(double? value) {
  if (value == null) return '—';
  return value == value.roundToDouble()
      ? value.toInt().toString()
      : value.toStringAsFixed(1);
}

/// Che giữa mã thẻ BHYT, chỉ để lại 3 ký tự đầu và cuối.
String? maskInsuranceCode(String? value) {
  final normalized = value?.trim();
  if (normalized == null || normalized.isEmpty) return null;
  if (normalized.length <= 6) return normalized;
  return '${normalized.substring(0, 3)}•••${normalized.substring(normalized.length - 3)}';
}

String maskPhone(String value) {
  final digits = value.replaceAll(RegExp(r'\D'), '');
  if (digits.length < 7) return value;
  return '${digits.substring(0, 4)} ••• ${digits.substring(digits.length - 3)}';
}
