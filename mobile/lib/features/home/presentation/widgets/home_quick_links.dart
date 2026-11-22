import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/core/config/app_brand.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/design/app_design_tokens.dart';
import 'package:hospital_booking_mobile/core/widgets/app_motion.dart';
import 'package:url_launcher/url_launcher.dart';

/// Thẻ Dịch vụ: bốn lối vào và "Xem tất cả" mở trang Tất cả dịch vụ (tab Dịch vụ). Kiến thức mở website của cơ sở.
class HomeServiceCard extends StatelessWidget {
  const HomeServiceCard({super.key});

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final colors = context.colors;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: colors.border, width: 0.5),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.sm,
          AppSpacing.xs,
          AppSpacing.sm,
          AppSpacing.sm,
        ),
        child: Column(
          children: [
            Row(
              children: [
                Expanded(child: Text('Dịch vụ', style: text.titleSmall)),
                TextButton(
                  key: const Key('home-link-all'),
                  onPressed: () => context.go('/services'),
                  style: TextButton.styleFrom(
                    minimumSize: const Size(0, 32),
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    foregroundColor: colors.primary,
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text('Xem tất cả'),
                      Icon(Icons.chevron_right_rounded, size: 18),
                    ],
                  ),
                ),
              ],
            ),
            Row(
              children: [
                _ServiceLink(
                  key: const Key('home-link-departments'),
                  icon: Icons.medical_services_outlined,
                  label: 'Chuyên khoa',
                  tint: context.colors.tintPairs[1],
                  onTap: () => unawaited(context.push<void>('/departments')),
                ),
                _ServiceLink(
                  key: const Key('home-link-doctors'),
                  icon: Icons.groups_2_outlined,
                  label: 'Bác sĩ',
                  tint: context.colors.tintPairs[4],
                  onTap: () => unawaited(context.push<void>('/doctors')),
                ),
                _ServiceLink(
                  key: const Key('home-link-packages'),
                  icon: Icons.inventory_2_outlined,
                  label: 'Gói khám',
                  tint: context.colors.tintPairs[3],
                  onTap: () => unawaited(context.push<void>('/packages')),
                ),
                _ServiceLink(
                  key: const Key('home-link-knowledge'),
                  icon: Icons.menu_book_outlined,
                  label: 'Kiến thức',
                  tint: context.colors.tintPairs[5],
                  onTap: () => unawaited(
                    launchUrl(
                      Uri.parse('${AppBrand.webUrl}/kien-thuc'),
                      mode: LaunchMode.externalApplication,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _ServiceLink extends StatelessWidget {
  const _ServiceLink({
    super.key,
    required this.icon,
    required this.label,
    required this.tint,
    required this.onTap,
  });

  final IconData icon;
  final ({Color background, Color foreground}) tint;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Expanded(
    child: Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      child: PressScale(
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(AppRadius.md),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 2),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: tint.background,
                    borderRadius: BorderRadius.circular(AppRadius.md),
                  ),
                  child: Icon(icon, color: tint.foreground, size: 22),
                ),
                const SizedBox(height: 4),
                Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: context.colors.textSoft,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}
