import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/features/catalog/domain/catalog_entities.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/core/widgets/resized_network_image.dart';

import 'package:hospital_booking_mobile/core/config/app_brand.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';

class HomeSectionHeader extends StatelessWidget {
  const HomeSectionHeader({
    super.key,
    required this.title,
    required this.actionLabel,
    required this.onAction,
    this.subtitle,
  });

  final String title;
  final String? subtitle;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.center,
    children: [
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                color: context.colors.ink,
                fontWeight: FontWeight.w900,
                letterSpacing: -0.2,
              ),
            ),
            if (subtitle != null) ...[
              const SizedBox(height: 2),
              Text(
                subtitle!,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(
                  context,
                ).textTheme.bodySmall?.copyWith(color: context.colors.muted),
              ),
            ],
          ],
        ),
      ),
      if (actionLabel != null)
        TextButton.icon(
          onPressed: onAction,
          style: TextButton.styleFrom(
            foregroundColor: context.colors.primaryDark,
            padding: const EdgeInsets.symmetric(horizontal: 6),
          ),
          label: Text(actionLabel!),
          icon: const Icon(Icons.chevron_right_rounded, size: 18),
          iconAlignment: IconAlignment.end,
        ),
    ],
  );
}

class HomeHeader extends StatelessWidget {
  const HomeHeader({
    super.key,
    required this.hospitalName,
    required this.userName,
    required this.avatar,
    required this.isAuthenticated,
    required this.unreadNotificationCount,
    required this.onNotifications,
  });

  final String? hospitalName;
  final String? userName;
  final String? avatar;
  final bool isAuthenticated;
  final int unreadNotificationCount;
  final VoidCallback onNotifications;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      if (isAuthenticated)
        Container(
          padding: const EdgeInsets.all(2),
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: context.colors.primary, width: 2),
          ),
          child: CircleAvatar(
            radius: 20,
            backgroundColor: context.colors.primarySoft,
            backgroundImage: resizedNetworkImage(
              context,
              avatar,
              logicalWidth: 40,
              logicalHeight: 40,
            ),
            child: avatar?.trim().isNotEmpty == true
                ? null
                : Icon(Icons.person_rounded, color: context.colors.primary),
          ),
        )
      else
        Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: context.colors.primarySoft,
            borderRadius: BorderRadius.circular(14),
          ),
          child: Icon(
            Icons.monitor_heart_outlined,
            color: context.colors.primary,
            size: 25,
          ),
        ),
      const SizedBox(width: 10),
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              isAuthenticated ? 'Xin chào,' : AppBrand.name,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
                fontWeight: FontWeight.w700,
                letterSpacing: 0,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              isAuthenticated
                  ? (userName?.trim().isNotEmpty == true
                        ? userName!
                        : 'Người khám')
                  : hospitalName ?? 'Hệ thống đặt lịch khám',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(
                context,
              ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w900),
            ),
          ],
        ),
      ),
      HomeNotificationBell(
        unreadCount: unreadNotificationCount,
        onTap: onNotifications,
      ),
    ],
  );
}

class HomeSearchBar extends StatelessWidget {
  const HomeSearchBar({super.key, required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Material(
    color: context.colors.surface,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(14),
      side: BorderSide(color: context.colors.border),
    ),
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      key: const Key('home-search-button'),
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
        child: Row(
          children: [
            Icon(Icons.search_rounded, color: context.colors.primary),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                'Tìm bác sĩ, chuyên khoa, gói khám',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(
                  context,
                ).textTheme.bodyMedium?.copyWith(color: context.colors.muted),
              ),
            ),
            Container(
              width: 30,
              height: 30,
              decoration: BoxDecoration(
                color: context.colors.primarySoft,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                Icons.tune_rounded,
                color: context.colors.primary,
                size: 19,
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class HomeQuickDepartmentChips extends StatelessWidget {
  const HomeQuickDepartmentChips({super.key, required this.items});

  final List<CatalogDepartment> items;

  @override
  Widget build(BuildContext context) => SizedBox(
    height: 34,
    child: ListView.separated(
      scrollDirection: Axis.horizontal,
      itemCount: items.length,
      separatorBuilder: (_, _) => const SizedBox(width: 8),
      itemBuilder: (context, index) {
        final item = items[index];
        return ActionChip(
          onPressed: () =>
              context.push('/departments/${Uri.encodeComponent(item.id)}'),
          avatar: const Icon(Icons.medical_services_outlined, size: 16),
          label: Text(item.name),
          labelStyle: Theme.of(context).textTheme.labelMedium?.copyWith(
            color: Theme.of(context).colorScheme.onSurface,
            fontWeight: FontWeight.w700,
          ),
          backgroundColor: context.colors.surface,
          side: BorderSide(color: context.colors.border),
          shape: const StadiumBorder(),
          visualDensity: VisualDensity.compact,
        );
      },
    ),
  );
}

class HomeNotificationBell extends StatelessWidget {
  const HomeNotificationBell({
    super.key,
    required this.unreadCount,
    required this.onTap,
  });

  final int unreadCount;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Stack(
    clipBehavior: Clip.none,
    children: [
      Material(
        color: context.colors.primarySoft,
        shape: const CircleBorder(),
        child: IconButton(
          onPressed: onTap,
          icon: Icon(
            Icons.notifications_none_rounded,
            color: context.colors.primaryDark,
            size: 22,
          ),
          tooltip: unreadCount == 0
              ? 'Thông báo'
              : '$unreadCount thông báo chưa đọc',
        ),
      ),
      if (unreadCount > 0)
        Positioned(
          right: 3,
          top: 3,
          child: IgnorePointer(
            child: Container(
              constraints: const BoxConstraints(minWidth: 18, minHeight: 18),
              padding: const EdgeInsets.symmetric(horizontal: 4),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.error,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: context.colors.surface, width: 1.5),
              ),
              alignment: Alignment.center,
              child: Text(
                unreadCount > 99 ? '99+' : '$unreadCount',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: Theme.of(context).colorScheme.onError,
                  fontSize: 9,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
          ),
        ),
    ],
  );
}

class HomeOfflineContentNotice extends StatelessWidget {
  const HomeOfflineContentNotice({
    super.key,
    required this.message,
    required this.onRetry,
  });

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Container(
      key: const Key('home-offline-content-notice'),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: context.colors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: colorScheme.surface,
                  borderRadius: BorderRadius.circular(13),
                ),
                child: Icon(
                  Icons.cloud_off_outlined,
                  color: colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Đang dùng nội dung đã lưu',
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '$message Bạn vẫn có thể xem nội dung công khai đã lưu; hãy kết nối lại để mở lịch khám và hồ sơ cá nhân.',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: colorScheme.onSurfaceVariant,
                        height: 1.35,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.cloud_sync_outlined, size: 20),
              label: const Text('Kết nối lại'),
            ),
          ),
        ],
      ),
    );
  }
}

class HomeCachedDataIndicator extends StatelessWidget {
  const HomeCachedDataIndicator({super.key});

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Icon(
        Icons.sync_rounded,
        size: 16,
        color: Theme.of(context).colorScheme.onSurfaceVariant,
      ),
      const SizedBox(width: 6),
      Expanded(
        child: Text(
          'Đang hiển thị dữ liệu đã lưu và kiểm tra cập nhật…',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
        ),
      ),
    ],
  );
}

class HomeEmergencyCard extends StatelessWidget {
  const HomeEmergencyCard({
    super.key,
    required this.hotline,
    required this.onTap,
  });

  final String hotline;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Material(
    key: const Key('home-emergency-support-card'),
    color: context.colors.dangerContainer,
    borderRadius: BorderRadius.circular(18),
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            CircleAvatar(
              backgroundColor: context.colors.danger,
              foregroundColor: Theme.of(context).colorScheme.onError,
              child: Icon(Icons.emergency_rounded),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Cấp cứu khẩn cấp 24/7',
                    style: Theme.of(context).textTheme.labelLarge,
                  ),
                  Text(
                    hotline,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      color: context.colors.danger,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
            Icon(Icons.chevron_right_rounded, color: context.colors.danger),
          ],
        ),
      ),
    ),
  );
}
