import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/core/config/app_brand.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/design/app_design_tokens.dart';
import 'package:url_launcher/url_launcher.dart';

/// Bốn lối vào dịch vụ trong một nền xanh nhạt bo tròn. Kiến thức mở trang web của cơ sở.
class HomeQuickLinks extends StatelessWidget {
  const HomeQuickLinks({super.key});

  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: BoxDecoration(
      color: context.colors.primarySoft,
      borderRadius: BorderRadius.circular(AppRadius.xl),
    ),
    child: Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.xs,
        vertical: AppSpacing.sm,
      ),
      child: Row(
        children: [
          _QuickLink(
            key: const Key('home-link-departments'),
            icon: Icons.medical_services_outlined,
            label: 'Chuyên khoa',
            onTap: () => context.go('/services'),
          ),
          _QuickLink(
            key: const Key('home-link-doctors'),
            icon: Icons.groups_2_outlined,
            label: 'Bác sĩ',
            onTap: () => unawaited(context.push<void>('/doctors')),
          ),
          _QuickLink(
            key: const Key('home-link-packages'),
            icon: Icons.inventory_2_outlined,
            label: 'Gói khám',
            onTap: () => unawaited(context.push<void>('/packages')),
          ),
          _QuickLink(
            key: const Key('home-link-knowledge'),
            icon: Icons.menu_book_outlined,
            label: 'Kiến thức',
            onTap: () => unawaited(
              launchUrl(
                Uri.parse('${AppBrand.webUrl}/kien-thuc'),
                mode: LaunchMode.externalApplication,
              ),
            ),
          ),
        ],
      ),
    ),
  );
}

class _QuickLink extends StatelessWidget {
  const _QuickLink({
    super.key,
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Expanded(
    child: Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: context.colors.surface,
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                child: Icon(icon, color: context.colors.primary, size: 26),
              ),
              const SizedBox(height: 6),
              Text(
                label,
                maxLines: 2,
                textAlign: TextAlign.center,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: context.colors.primaryDark,
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}
