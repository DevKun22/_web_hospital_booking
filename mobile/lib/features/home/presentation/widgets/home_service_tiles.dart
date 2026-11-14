import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/core/design/app_design_tokens.dart';
import 'package:hospital_booking_mobile/features/home/presentation/widgets/home_service_catalog.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';

class HomeAllServicesSheet extends StatelessWidget {
  const HomeAllServicesSheet({
    super.key,
    required this.accessStatus,
    required this.onSelected,
  });

  final String? Function(HomeService service) accessStatus;
  final ValueChanged<HomeService> onSelected;

  @override
  Widget build(BuildContext context) => Material(
    color: Theme.of(context).colorScheme.surface,
    borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
    clipBehavior: Clip.antiAlias,
    child: Column(
      children: [
        const SizedBox(height: 10),
        Container(
          width: 42,
          height: 4,
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.outlineVariant,
            borderRadius: BorderRadius.circular(999),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 8, 10),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Tất cả dịch vụ',
                      style: Theme.of(context).textTheme.headlineSmall
                          ?.copyWith(fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Các tiện ích đang có sẵn trong hệ thống',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
              IconButton(
                onPressed: () => Navigator.of(context).pop(),
                tooltip: 'Đóng',
                icon: const Icon(Icons.close_rounded),
              ),
            ],
          ),
        ),
        const Divider(height: 1),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
            children: [
              for (final section in homeServiceSections) ...[
                HomeServiceSectionView(
                  section: section,
                  accessStatus: accessStatus,
                  onSelected: onSelected,
                ),
                if (section != homeServiceSections.last)
                  const SizedBox(height: 22),
              ],
            ],
          ),
        ),
      ],
    ),
  );
}

class HomeServiceSectionView extends StatelessWidget {
  const HomeServiceSectionView({
    super.key,
    required this.section,
    required this.accessStatus,
    required this.onSelected,
  });

  final HomeServiceSection section;
  final String? Function(HomeService service) accessStatus;
  final ValueChanged<HomeService> onSelected;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        section.title,
        style: Theme.of(
          context,
        ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
      ),
      const SizedBox(height: 10),
      DecoratedBox(
        decoration: BoxDecoration(
          color: context.colors.surface,
          border: Border.all(color: context.colors.border),
          borderRadius: BorderRadius.circular(18),
        ),
        child: Column(
          children: [
            for (var index = 0; index < section.services.length; index++) ...[
              HomeServiceListTile(
                service: section.services[index],
                statusLabel: accessStatus(section.services[index]),
                onTap: () => onSelected(section.services[index]),
              ),
              if (index < section.services.length - 1)
                const Divider(height: 1, indent: 66),
            ],
          ],
        ),
      ),
    ],
  );
}

class HomeServiceTile extends StatelessWidget {
  const HomeServiceTile({
    super.key,
    required this.icon,
    required this.label,
    required this.statusLabel,
    required this.backgroundColor,
    required this.foregroundColor,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final String? statusLabel;
  final Color backgroundColor;
  final Color foregroundColor;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Material(
    color: context.colors.surface,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(16),
      side: BorderSide(color: context.colors.border),
    ),
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      onTap: onTap,
      child: Stack(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(3, 5, 3, 3),
            child: Column(
              children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: backgroundColor,
                    borderRadius: BorderRadius.circular(11),
                  ),
                  child: Icon(icon, size: 19, color: foregroundColor),
                ),
                const SizedBox(height: 3),
                Expanded(
                  child: Center(
                    child: Text(
                      label,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: context.colors.ink,
                        fontSize: 9.5,
                        height: 1.08,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (statusLabel != null)
            Positioned(
              right: 5,
              top: 5,
              child: Container(
                width: statusLabel == 'Cần mạng' ? null : 16,
                height: 16,
                padding: statusLabel == 'Cần mạng'
                    ? const EdgeInsets.symmetric(horizontal: 4)
                    : EdgeInsets.zero,
                decoration: BoxDecoration(
                  color: context.colors.primarySoft,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.lock_outline_rounded,
                      size: 9,
                      color: context.colors.primaryDark,
                    ),
                    if (statusLabel == 'Cần mạng') ...[
                      const SizedBox(width: 2),
                      Text(
                        statusLabel!,
                        style: TextStyle(
                          color: context.colors.primaryDark,
                          fontSize: 7.5,
                          height: 1,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
        ],
      ),
    ),
  );
}

class HomeServiceListTile extends StatelessWidget {
  const HomeServiceListTile({
    super.key,
    required this.service,
    required this.statusLabel,
    required this.onTap,
  });

  final HomeService service;
  final String? statusLabel;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => ListTile(
    onTap: onTap,
    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
    leading: Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        color: context.colors.primarySoft,
        borderRadius: BorderRadius.circular(13),
      ),
      child: Icon(service.icon, size: 21, color: context.colors.primary),
    ),
    title: Text(
      service.label,
      style: Theme.of(
        context,
      ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
    ),
    subtitle: Text(service.description),
    trailing: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (statusLabel != null)
          Padding(
            padding: const EdgeInsets.only(right: 4),
            child: Text(
              statusLabel!,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
          ),
        const Icon(Icons.chevron_right_rounded),
      ],
    ),
  );
}
