import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/widgets/app_info_list.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/profile/application/patient_profile_controller.dart';
import 'package:hospital_booking_mobile/features/profile/domain/patient_profile.dart';
import 'package:hospital_booking_mobile/features/profile/presentation/profile_actions.dart';
import 'package:hospital_booking_mobile/features/profile/presentation/widgets/profile_summary_widgets.dart';

/// Bảo hiểm y tế và sức khỏe dạng xem: thẻ BHYT, bốn ô chỉ số, các dòng dị ứng và tiền sử; chạm để sửa riêng từng mục.
class ProfileHealthScreen extends ConsumerWidget {
  const ProfileHealthScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(patientProfileControllerProvider);
    final profile = state.profile;
    return Scaffold(
      appBar: AppBar(title: const Text('Bảo hiểm và sức khỏe')),
      body: SafeArea(
        child: profile == null
            ? (state.isInitialLoading
                  ? const Padding(
                      padding: EdgeInsets.all(AppSpacing.page),
                      child: AppLoadingSkeleton(height: 220),
                    )
                  : const AppEmptyState(
                      icon: Icons.person_off_outlined,
                      title: 'Chưa có dữ liệu hồ sơ',
                      message: 'Quay lại và thử đồng bộ hồ sơ một lần nữa.',
                    ))
            : ListView(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.page,
                  0,
                  AppSpacing.page,
                  AppSpacing.xxl,
                ),
                children: _body(context, ref, profile, state.isSaving),
              ),
      ),
    );
  }

  List<Widget> _body(
    BuildContext context,
    WidgetRef ref,
    PatientProfile profile,
    bool saving,
  ) {
    final edits = ProfileEdits(context, ref, profile);
    VoidCallback? tap(Future<void> Function() action) =>
        saving ? null : () => action();
    return [
      const SizedBox(height: AppSpacing.xs),
      _InsuranceCard(profile: profile),
      const SizedBox(height: AppSpacing.sm),
      AppInfoCard(
        children: [
          AppInfoSwitchRow(
            key: const ValueKey('switch-bhyt'),
            title: 'Tôi có dùng BHYT',
            value: profile.hasBhyt,
            onChanged: saving
                ? null
                : (value) =>
                      saveProfileFields(context, ref, {'hasBHYT': value}),
          ),
          if (profile.hasBhyt) ...[
            AppInfoRow(
              key: const ValueKey('row-insuranceCode'),
              label: 'Mã thẻ',
              value: profile.healthInsuranceCode,
              addLabel: 'Thêm mã thẻ',
              onTap: tap(edits.insuranceCode),
            ),
            AppInfoRow(
              key: const ValueKey('row-registeredHospital'),
              label: 'Nơi đăng ký khám ban đầu',
              value: profile.registeredHospital,
              addLabel: 'Thêm nơi đăng ký',
              onTap: tap(edits.registeredHospital),
            ),
          ],
        ],
      ),
      const AppInfoSectionTitle('Chỉ số sức khỏe'),
      _MetricGrid(profile: profile, edits: edits, saving: saving),
      AppInfoSection(
        title: 'Dị ứng và tiền sử',
        footer: profile.hasHealthConsent
            ? null
            : 'Đây là dữ liệu nhạy cảm: lần đầu lưu sẽ hỏi bạn đồng ý.',
        children: [
          AppInfoRow(
            key: const ValueKey('row-allergies'),
            label: 'Dị ứng',
            value: profile.allergies,
            addLabel: 'Thêm dị ứng',
            onTap: tap(
              () => edits.healthText('allergies', 'Dị ứng', profile.allergies),
            ),
          ),
          AppInfoRow(
            key: const ValueKey('row-medicalHistory'),
            label: 'Tiền sử bệnh',
            value: profile.medicalHistory,
            addLabel: 'Thêm tiền sử bệnh',
            onTap: tap(
              () => edits.healthText(
                'medicalHistory',
                'Tiền sử bệnh',
                profile.medicalHistory,
              ),
            ),
          ),
          AppInfoRow(
            key: const ValueKey('row-familyHistory'),
            label: 'Tiền sử gia đình',
            value: profile.familyHistory,
            addLabel: 'Thêm tiền sử gia đình',
            onTap: tap(
              () => edits.healthText(
                'familyHistory',
                'Tiền sử gia đình',
                profile.familyHistory,
              ),
            ),
          ),
        ],
      ),
    ];
  }
}

/// Thẻ BHYT dạng hình thẻ: số thẻ ẩn bớt và nơi đăng ký; không dùng BHYT thì hiện thẻ xám.
class _InsuranceCard extends StatelessWidget {
  const _InsuranceCard({required this.profile});

  final PatientProfile profile;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final text = Theme.of(context).textTheme;
    final active = profile.hasBhyt;
    final code = maskInsuranceCode(profile.healthInsuranceCode);
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        gradient: active
            ? LinearGradient(colors: [AppPalette.heroDeep, AppPalette.heroMid])
            : null,
        color: active ? null : colors.surfaceMuted,
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'Thẻ bảo hiểm y tế',
                  style: text.labelMedium?.copyWith(
                    color: active ? Colors.white70 : colors.muted,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 3,
                ),
                decoration: BoxDecoration(
                  color: active ? Colors.white24 : colors.surface,
                  borderRadius: BorderRadius.circular(AppRadius.pill),
                ),
                child: Text(
                  active ? 'Đang dùng' : 'Không dùng',
                  style: text.labelMedium?.copyWith(
                    color: active ? Colors.white : colors.muted,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            active
                ? (code ?? 'Chưa có mã thẻ')
                : 'Bật công tắc bên dưới để thêm thẻ',
            style: text.titleLarge?.copyWith(
              color: active ? Colors.white : colors.muted,
              letterSpacing: active && code != null ? 1.2 : 0,
            ),
          ),
          if (active && profile.registeredHospital != null) ...[
            const SizedBox(height: 4),
            Text(
              'Nơi đăng ký: ${profile.registeredHospital}',
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: text.bodySmall?.copyWith(color: Colors.white70),
            ),
          ],
        ],
      ),
    );
  }
}

/// Bốn ô chỉ số (nhóm máu, chiều cao, cân nặng, huyết áp): chạm ô nào sửa ô đó.
class _MetricGrid extends StatelessWidget {
  const _MetricGrid({
    required this.profile,
    required this.edits,
    required this.saving,
  });

  final PatientProfile profile;
  final ProfileEdits edits;
  final bool saving;

  @override
  Widget build(BuildContext context) {
    final tiles = [
      ('metric-bloodType', 'Nhóm máu', profile.bloodType, edits.bloodType),
      (
        'metric-height',
        'Chiều cao',
        profile.height == null ? null : '${profileNumber(profile.height)} cm',
        edits.height,
      ),
      (
        'metric-weight',
        'Cân nặng',
        profile.weight == null ? null : '${profileNumber(profile.weight)} kg',
        edits.weight,
      ),
      (
        'metric-bloodPressure',
        'Huyết áp',
        profile.bloodPressure,
        edits.bloodPressure,
      ),
    ];
    return LayoutBuilder(
      builder: (context, constraints) {
        const gap = AppSpacing.xs;
        final width = (constraints.maxWidth - gap) / 2;
        final colors = context.colors;
        final text = Theme.of(context).textTheme;
        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: [
            for (final tile in tiles)
              SizedBox(
                width: width,
                child: Material(
                  color: colors.surface,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppRadius.md),
                    side: BorderSide(color: colors.border, width: 0.5),
                  ),
                  child: InkWell(
                    key: ValueKey(tile.$1),
                    customBorder: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppRadius.md),
                    ),
                    onTap: saving ? null : () => tile.$4(),
                    child: Padding(
                      padding: const EdgeInsets.all(AppSpacing.sm),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            tile.$2,
                            style: text.labelMedium?.copyWith(
                              color: colors.muted,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            tile.$3 ?? 'Thêm',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: tile.$3 == null
                                ? text.bodyLarge?.copyWith(
                                    color: colors.primary,
                                    fontWeight: FontWeight.w600,
                                  )
                                : text.titleSmall,
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}

String profileNumber(double? value) {
  if (value == null) return '—';
  return value == value.roundToDouble()
      ? value.toInt().toString()
      : value.toStringAsFixed(1);
}
