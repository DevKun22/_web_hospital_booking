import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/design/app_design_tokens.dart';
import 'package:hospital_booking_mobile/app/navigation/booking_navigation.dart';

/// Lối tắt dạng viên dưới thẻ nổi.
typedef HomeShortcut = ({String label, IconData icon, String location});

const homeMemberShortcuts = <HomeShortcut>[
  (
    label: 'Đặt lịch',
    icon: Icons.event_available_rounded,
    location: '/booking',
  ),
  (
    label: 'Thanh toán',
    icon: Icons.receipt_long_rounded,
    location: '/invoices',
  ),
  (
    label: 'Kết quả',
    icon: Icons.folder_shared_outlined,
    location: '/medical-records',
  ),
];

const homeGuestShortcuts = <HomeShortcut>[
  (
    label: 'Giờ trống hôm nay',
    icon: Icons.schedule_rounded,
    location: '/doctors',
  ),
  (label: 'Gói khám', icon: Icons.inventory_2_outlined, location: '/packages'),
  (label: 'Hỏi Kun', icon: Icons.auto_awesome_rounded, location: '/chatbot'),
];

/// Thẻ nổi đè lên dải đầu khi chưa có lịch sắp tới: mời đặt lịch ngay.
class HomeBookingHeroCard extends StatelessWidget {
  const HomeBookingHeroCard({super.key, required this.isAuthenticated});

  final bool isAuthenticated;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final colors = context.colors;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(AppRadius.xl),
        border: Border.all(color: colors.border),
        boxShadow: AppShadow.soft,
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              isAuthenticated
                  ? 'Đặt lịch khám mới'
                  : 'Đặt lịch khám trực tuyến',
              style: text.titleMedium,
            ),
            const SizedBox(height: AppSpacing.xxs),
            Text(
              'Chọn bác sĩ và giờ còn trống, xác nhận bằng mã OTP gửi về email.',
              style: text.bodyMedium?.copyWith(color: colors.textSoft),
            ),
            const SizedBox(height: AppSpacing.sm),
            FilledButton.icon(
              key: const Key('home-hero-book'),
              onPressed: () => openBookingFromCurrentRoute(context, '/booking'),
              icon: const Icon(Icons.arrow_forward_rounded),
              label: const Text('Đặt lịch ngay'),
            ),
            const SizedBox(height: AppSpacing.xs),
            HomeShortcutChips(
              items: isAuthenticated ? homeMemberShortcuts : homeGuestShortcuts,
            ),
          ],
        ),
      ),
    );
  }
}

class HomeShortcutChips extends StatelessWidget {
  const HomeShortcutChips({super.key, required this.items});

  final List<HomeShortcut> items;

  @override
  Widget build(BuildContext context) => Wrap(
    spacing: AppSpacing.xs,
    runSpacing: 0,
    children: [
      for (final item in items)
        ActionChip(
          avatar: Icon(item.icon, size: 18, color: context.colors.primary),
          label: Text(item.label),
          onPressed: () => context.push(item.location),
          backgroundColor: context.colors.primarySoft,
          side: BorderSide.none,
          shape: const StadiumBorder(),
          visualDensity: VisualDensity.compact,
          labelStyle: Theme.of(
            context,
          ).textTheme.labelMedium?.copyWith(color: context.colors.primaryDark),
        ),
    ],
  );
}
