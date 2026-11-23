import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:hospital_booking_mobile/core/widgets/app_info_list.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/profile/application/patient_profile_controller.dart';
import 'package:hospital_booking_mobile/features/profile/domain/patient_profile.dart';
import 'package:hospital_booking_mobile/features/profile/presentation/profile_actions.dart';

/// Thông tin cá nhân dạng xem: chạm một dòng để sửa riêng dòng đó, không có nút lưu chung.
class ProfilePersonalScreen extends ConsumerWidget {
  const ProfilePersonalScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(patientProfileControllerProvider);
    final profile = state.profile;
    return Scaffold(
      appBar: AppBar(title: const Text('Thông tin cá nhân')),
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
                children: _rows(context, ref, profile, state.isSaving),
              ),
      ),
    );
  }

  List<Widget> _rows(
    BuildContext context,
    WidgetRef ref,
    PatientProfile profile,
    bool saving,
  ) {
    final edits = ProfileEdits(context, ref, profile);
    void Function()? tap(Future<void> Function() action) =>
        saving ? null : () => action();
    return [
      AppInfoSection(
        title: 'Cơ bản',
        children: [
          AppInfoRow(
            key: const ValueKey('row-fullName'),
            label: 'Họ và tên',
            value: profile.fullName,
            onTap: tap(edits.fullName),
          ),
          AppInfoRow(
            key: const ValueKey('row-dateOfBirth'),
            label: 'Ngày sinh',
            value: profile.dateOfBirth == null
                ? null
                : formatDateVi(profile.dateOfBirth!),
            addLabel: 'Thêm ngày sinh',
            onTap: tap(edits.dateOfBirth),
          ),
          AppInfoRow(
            key: const ValueKey('row-gender'),
            label: 'Giới tính',
            value: profile.gender?.label,
            addLabel: 'Thêm giới tính',
            onTap: tap(edits.gender),
          ),
        ],
      ),
      AppInfoSection(
        title: 'Liên hệ',
        footer:
            'Email là tên đăng nhập, đã xác thực bằng OTP nên không đổi được ở đây.',
        children: [
          AppInfoRow(
            key: const ValueKey('row-email'),
            label: 'Email đăng nhập',
            value: profile.email,
            trailing: profile.isEmailVerified
                ? AppInfoTrailing.verified
                : AppInfoTrailing.locked,
          ),
          AppInfoRow(
            key: const ValueKey('row-phone'),
            label: 'Số điện thoại',
            value: profile.phone,
            addLabel: 'Thêm số điện thoại',
            onTap: tap(edits.phone),
          ),
        ],
      ),
      AppInfoSection(
        title: 'Giấy tờ và địa chỉ',
        children: [
          AppInfoRow(
            key: const ValueKey('row-cccd'),
            label: 'CCCD',
            value: profile.cccd,
            addLabel: 'Thêm số CCCD',
            onTap: tap(edits.cccd),
          ),
          AppInfoRow(
            key: const ValueKey('row-address'),
            label: 'Địa chỉ',
            value: profile.address,
            addLabel: 'Thêm địa chỉ',
            onTap: tap(edits.address),
          ),
        ],
      ),
      Padding(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.xxs,
          AppSpacing.md,
          AppSpacing.xxs,
          0,
        ),
        child: Text(
          'Chạm vào một dòng để sửa riêng dòng đó. Sửa xong là lưu ngay.',
          style: Theme.of(
            context,
          ).textTheme.bodySmall?.copyWith(color: context.colors.muted),
        ),
      ),
    ];
  }
}
