import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/app/navigation/booking_navigation.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:hospital_booking_mobile/core/widgets/app_error_banner.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/core/widgets/resized_network_image.dart';
import 'package:hospital_booking_mobile/features/appointments/application/appointments_controller.dart';
import 'package:hospital_booking_mobile/features/appointments/application/appointment_device_actions.dart';
import 'package:hospital_booking_mobile/features/appointments/presentation/widgets/appointment_qr_ticket.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_state.dart';
import 'package:hospital_booking_mobile/features/home/application/home_content_controller.dart';
import 'package:hospital_booking_mobile/features/home/application/home_dashboard_view_state.dart';
import 'package:hospital_booking_mobile/features/home/application/home_search_history_provider.dart';
import 'package:hospital_booking_mobile/features/home/data/home_search_history_store.dart';
import 'package:hospital_booking_mobile/features/home/domain/home_content.dart';
import 'package:hospital_booking_mobile/features/home/domain/home_search_history_entry.dart';
import 'package:hospital_booking_mobile/features/home/presentation/widgets/home_service_hub.dart';
import 'package:hospital_booking_mobile/features/home/presentation/widgets/home_appointment_action_card.dart';
import 'package:hospital_booking_mobile/features/notifications/application/notifications_controller.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider);
    final homeState = ref.watch(homeContentControllerProvider);
    final content = homeState.content;
    final dashboard = ref.watch(homeDashboardViewStateProvider);
    final user = dashboard.user;
    final isAuthenticated = dashboard.isAuthenticated;
    final isOfflineBrowsing = dashboard.isOfflineBrowsing;
    final sessionError = auth.errorFor(AuthErrorOrigin.session);
    final restoreError = auth.errorFor(AuthErrorOrigin.sessionRestore);
    final hospitalName = content?.siteSettings.hospitalName;
    final upcomingAppointment = dashboard.nextAppointment;
    final unreadNotificationCount = dashboard.unreadNotificationCount;

    return Scaffold(
      backgroundColor: AppPalette.publicCanvas,
      body: RefreshIndicator(
        onRefresh: () => Future.wait([
          ref.read(homeContentControllerProvider.notifier).refresh(),
          if (isAuthenticated)
            ref.read(notificationsControllerProvider.notifier).refresh(),
          if (isAuthenticated)
            ref.read(appointmentsControllerProvider.notifier).refresh(),
        ]),
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverAppBar(
              pinned: true,
              automaticallyImplyLeading: false,
              backgroundColor: Colors.white,
              surfaceTintColor: Colors.transparent,
              elevation: 0,
              scrolledUnderElevation: 2,
              shadowColor: const Color(0x1A172B4D),
              toolbarHeight: 64,
              titleSpacing: 14,
              title: _HomeHeader(
                hospitalName: hospitalName,
                userName: user?.fullName,
                avatar: user?.avatar,
                isAuthenticated: isAuthenticated,
                unreadNotificationCount: unreadNotificationCount,
                onNotifications: isOfflineBrowsing
                    ? ref.read(authControllerProvider.notifier).bootstrapSession
                    : isAuthenticated
                    ? () => context.go('/notifications')
                    : () => context.go('/login'),
              ),
            ),
            if (sessionError != null && restoreError == null)
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
                sliver: SliverToBoxAdapter(
                  child: AppErrorBanner(
                    error: sessionError,
                    onDismiss: ref
                        .read(authControllerProvider.notifier)
                        .dismissError,
                  ),
                ),
              ),
            if (restoreError != null)
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
                sliver: SliverToBoxAdapter(
                  child: _OfflineContentNotice(
                    message: restoreError.message,
                    onRetry: ref
                        .read(authControllerProvider.notifier)
                        .bootstrapSession,
                  ),
                ),
              ),
            if (homeState.error != null &&
                content != null &&
                restoreError == null)
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
                sliver: SliverToBoxAdapter(
                  child: AppErrorBanner(
                    error: homeState.error!,
                    onDismiss: ref
                        .read(homeContentControllerProvider.notifier)
                        .dismissError,
                  ),
                ),
              ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(14, 10, 14, 0),
              sliver: SliverToBoxAdapter(
                child: Column(
                  children: [
                    _HomeSearchBar(
                      onTap: content == null
                          ? ref
                                .read(homeContentControllerProvider.notifier)
                                .refresh
                          : () => _showHomeSearch(
                              context,
                              content,
                              ref.read(homeSearchHistoryStoreProvider),
                            ),
                    ),
                    if (content != null && content.departments.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      _QuickDepartmentChips(
                        items: content.departments.take(5).toList(),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            if (upcomingAppointment != null)
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(14, 12, 14, 0),
                sliver: SliverToBoxAdapter(
                  child: HomeAppointmentActionCard(
                    appointment: upcomingAppointment,
                    onOpen: () => context.push(
                      '/appointments/${Uri.encodeComponent(upcomingAppointment.id)}',
                    ),
                    onShowQr: () => showAppointmentQrTicket(
                      context,
                      appointment: upcomingAppointment,
                      payload: ref
                          .read(appointmentDeviceActionsProvider)
                          .qrPayload(upcomingAppointment),
                    ),
                  ),
                ),
              ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(14, 10, 14, 0),
              sliver: SliverToBoxAdapter(
                child: HomeServiceHub(
                  isAuthenticated: isAuthenticated,
                  isOfflineBrowsing: isOfflineBrowsing,
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(14, 14, 14, 108),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  if (homeState.isInitialLoading) ...[
                    const AppLoadingSkeleton(height: 120),
                    const SizedBox(height: 12),
                    const AppLoadingSkeleton(height: 180),
                  ] else if (content == null) ...[
                    AppEmptyState(
                      icon: Icons.cloud_off_rounded,
                      title: 'Chưa tải được nội dung',
                      message:
                          homeState.error?.message ??
                          'Kéo xuống hoặc thử lại để kết nối máy chủ.',
                      action: FilledButton.icon(
                        onPressed: ref
                            .read(homeContentControllerProvider.notifier)
                            .refresh,
                        icon: const Icon(Icons.refresh_rounded),
                        label: const Text('Thử lại'),
                      ),
                    ),
                  ] else ...[
                    if (homeState.isRefreshing)
                      const LinearProgressIndicator(minHeight: 2),
                    if (homeState.usingCachedData && restoreError == null) ...[
                      const SizedBox(height: 8),
                      const _CachedDataIndicator(),
                    ],
                    if (content.banners.isNotEmpty) ...[
                      _HomeSectionHeader(
                        title: 'Chương trình & ưu đãi',
                        actionLabel: null,
                        onAction: null,
                      ),
                      const SizedBox(height: 6),
                      _HeroCarousel(banners: content.banners),
                    ],
                    if (content.doctors.isNotEmpty) ...[
                      const SizedBox(height: 14),
                      _HomeSectionHeader(
                        title: 'Bác sĩ có lịch hôm nay',
                        subtitle: 'Đặt lịch trực tiếp, không cần chờ đợi.',
                        actionLabel: 'Xem tất cả',
                        onAction: () => context.push('/doctors'),
                      ),
                      const SizedBox(height: 6),
                      _DoctorList(items: content.doctors.take(5).toList()),
                    ],
                    if (content.departments.isNotEmpty) ...[
                      const SizedBox(height: 14),
                      _HomeSectionHeader(
                        title: 'Chuyên khoa nổi bật',
                        actionLabel: 'Xem tất cả',
                        onAction: () => context.push('/departments'),
                      ),
                      const SizedBox(height: 8),
                      _DepartmentList(
                        items: content.departments.take(6).toList(),
                      ),
                    ],
                    if (content.packages.isNotEmpty) ...[
                      const SizedBox(height: 14),
                      _HomeSectionHeader(
                        title: 'Gói khám sức khỏe',
                        actionLabel: 'Xem tất cả',
                        onAction: () => context.push('/packages'),
                      ),
                      const SizedBox(height: 6),
                      _PackageList(items: content.packages.take(5).toList()),
                    ],
                    if (content.siteSettings.emergencyHotline != null) ...[
                      const SizedBox(height: 14),
                      _EmergencyCard(
                        hotline: content.siteSettings.emergencyHotline!,
                        onTap: () => context.push('/support'),
                      ),
                    ],
                  ],
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HomeSectionHeader extends StatelessWidget {
  const _HomeSectionHeader({
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
                color: AppPalette.publicInk,
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
                ).textTheme.bodySmall?.copyWith(color: AppPalette.publicMuted),
              ),
            ],
          ],
        ),
      ),
      if (actionLabel != null)
        TextButton.icon(
          onPressed: onAction,
          style: TextButton.styleFrom(
            foregroundColor: AppPalette.clinicalBlueDark,
            padding: const EdgeInsets.symmetric(horizontal: 6),
          ),
          label: Text(actionLabel!),
          icon: const Icon(Icons.chevron_right_rounded, size: 18),
          iconAlignment: IconAlignment.end,
        ),
    ],
  );
}

class _HomeHeader extends StatelessWidget {
  const _HomeHeader({
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
            border: Border.all(color: AppPalette.clinicalBlue, width: 2),
          ),
          child: CircleAvatar(
            radius: 20,
            backgroundColor: AppPalette.clinicalBlueContainer,
            backgroundImage: resizedNetworkImage(
              context,
              avatar,
              logicalWidth: 40,
              logicalHeight: 40,
            ),
            child: avatar?.trim().isNotEmpty == true
                ? null
                : const Icon(
                    Icons.person_rounded,
                    color: AppPalette.clinicalBlue,
                  ),
          ),
        )
      else
        Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: AppPalette.clinicalBlueContainer,
            borderRadius: BorderRadius.circular(14),
          ),
          child: const Icon(
            Icons.monitor_heart_outlined,
            color: AppPalette.clinicalBlue,
            size: 25,
          ),
        ),
      const SizedBox(width: 10),
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              isAuthenticated ? 'Xin chào,' : 'MEDCARE BOOKING',
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
                fontWeight: FontWeight.w700,
                letterSpacing: isAuthenticated ? 0 : 0.6,
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
      _NotificationBell(
        unreadCount: unreadNotificationCount,
        onTap: onNotifications,
      ),
    ],
  );
}

class _HomeSearchBar extends StatelessWidget {
  const _HomeSearchBar({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Material(
    color: Colors.white,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(14),
      side: const BorderSide(color: AppPalette.publicBorder),
    ),
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      key: const Key('home-search-button'),
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
        child: Row(
          children: [
            const Icon(Icons.search_rounded, color: AppPalette.clinicalBlue),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                'Tìm bác sĩ, chuyên khoa, gói khám',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(
                  context,
                ).textTheme.bodyMedium?.copyWith(color: AppPalette.publicMuted),
              ),
            ),
            Container(
              width: 30,
              height: 30,
              decoration: BoxDecoration(
                color: AppPalette.clinicalBlueContainer,
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(
                Icons.tune_rounded,
                color: AppPalette.clinicalBlue,
                size: 19,
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class _QuickDepartmentChips extends StatelessWidget {
  const _QuickDepartmentChips({required this.items});

  final List<HomeDepartment> items;

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
          avatar: index == 0
              ? const Icon(Icons.favorite_outline_rounded, size: 16)
              : null,
          label: Text(item.name),
          labelStyle: Theme.of(context).textTheme.labelMedium?.copyWith(
            color: index == 0
                ? Colors.white
                : Theme.of(context).colorScheme.onSurface,
            fontWeight: FontWeight.w700,
          ),
          backgroundColor: index == 0 ? AppPalette.clinicalBlue : Colors.white,
          side: BorderSide(
            color: index == 0
                ? AppPalette.clinicalBlue
                : AppPalette.publicBorder,
          ),
          shape: const StadiumBorder(),
          visualDensity: VisualDensity.compact,
        );
      },
    ),
  );
}

class _NotificationBell extends StatelessWidget {
  const _NotificationBell({required this.unreadCount, required this.onTap});

  final int unreadCount;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Stack(
    clipBehavior: Clip.none,
    children: [
      Material(
        color: AppPalette.clinicalBlueContainer,
        shape: const CircleBorder(),
        child: IconButton(
          onPressed: onTap,
          icon: const Icon(
            Icons.notifications_none_rounded,
            color: AppPalette.clinicalBlueDark,
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
                border: Border.all(color: Colors.white, width: 1.5),
              ),
              alignment: Alignment.center,
              child: Text(
                unreadCount > 99 ? '99+' : '$unreadCount',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: Colors.white,
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

class _OfflineContentNotice extends StatelessWidget {
  const _OfflineContentNotice({required this.message, required this.onRetry});

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
        border: Border.all(color: AppPalette.publicBorder),
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

class _CachedDataIndicator extends StatelessWidget {
  const _CachedDataIndicator();

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

void _showHomeSearch(
  BuildContext context,
  HomeContent content,
  HomeSearchHistoryStore historyStore,
) {
  showModalBottomSheet<void>(
    context: context,
    useRootNavigator: true,
    useSafeArea: true,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (sheetContext) => FractionallySizedBox(
      heightFactor: 0.88,
      child: _HomeSearchSheet(
        content: content,
        historyStore: historyStore,
        onSelected: (location) {
          Navigator.of(sheetContext).pop();
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (context.mounted) context.push(location);
          });
        },
      ),
    ),
  );
}

class _HomeSearchSheet extends StatefulWidget {
  const _HomeSearchSheet({
    required this.content,
    required this.historyStore,
    required this.onSelected,
  });

  final HomeContent content;
  final HomeSearchHistoryStore historyStore;
  final ValueChanged<String> onSelected;

  @override
  State<_HomeSearchSheet> createState() => _HomeSearchSheetState();
}

class _HomeSearchSheetState extends State<_HomeSearchSheet> {
  String _query = '';
  List<HomeSearchHistoryEntry> _recent = const [];

  @override
  void initState() {
    super.initState();
    unawaited(_loadRecent());
  }

  List<_HomeSearchResult> get _results {
    final results = <_HomeSearchResult>[
      for (final item in widget.content.departments)
        _HomeSearchResult(
          title: item.name,
          subtitle: 'Chuyên khoa',
          icon: Icons.local_hospital_outlined,
          kind: HomeSearchHistoryKind.department,
          location: '/departments/${Uri.encodeComponent(item.id)}',
        ),
      for (final item in widget.content.doctors)
        _HomeSearchResult(
          title: item.displayName,
          subtitle: item.specialization ?? item.departmentName,
          icon: Icons.person_search_outlined,
          kind: HomeSearchHistoryKind.doctor,
          location: '/doctors/${Uri.encodeComponent(item.id)}',
        ),
      for (final item in widget.content.packages)
        _HomeSearchResult(
          title: item.name,
          subtitle: 'Gói khám • ${formatVnd(item.finalPrice)}',
          icon: Icons.health_and_safety_outlined,
          kind: HomeSearchHistoryKind.medicalPackage,
          location: item.slug == null
              ? '/booking?packageId=${Uri.encodeQueryComponent(item.id)}'
              : '/packages/${Uri.encodeComponent(item.slug!)}',
        ),
    ];
    final normalized = _query.trim().toLowerCase();
    if (normalized.isEmpty) return results.take(10).toList(growable: false);
    final matches = results
        .where(
          (item) =>
              item.title.toLowerCase().contains(normalized) ||
              item.subtitle.toLowerCase().contains(normalized),
        )
        .toList(growable: false);
    final encoded = Uri.encodeQueryComponent(_query.trim());
    return [
      ...matches,
      _HomeSearchResult(
        title: 'Tìm tất cả bác sĩ',
        subtitle: 'Kết quả đầy đủ cho “${_query.trim()}”',
        icon: Icons.manage_search_rounded,
        kind: HomeSearchHistoryKind.doctor,
        location: '/doctors?search=$encoded',
      ),
      _HomeSearchResult(
        title: 'Tìm tất cả gói khám',
        subtitle: 'Kết quả đầy đủ cho “${_query.trim()}”',
        icon: Icons.manage_search_rounded,
        kind: HomeSearchHistoryKind.medicalPackage,
        location: '/packages?search=$encoded',
      ),
    ];
  }

  Future<void> _loadRecent() async {
    try {
      final items = await widget.historyStore.read();
      if (mounted) setState(() => _recent = items);
    } catch (_) {
      // Search remains fully usable when local preferences are unavailable.
    }
  }

  Future<void> _select(_HomeSearchResult item) async {
    try {
      await widget.historyStore.remember(item.toHistoryEntry());
    } catch (_) {
      // Local history is optional and must never block navigation.
    }
    if (mounted) widget.onSelected(item.location);
  }

  Future<void> _clearRecent() async {
    try {
      await widget.historyStore.clear();
    } catch (_) {
      // Still clear the in-memory view for the current search session.
    }
    if (mounted) setState(() => _recent = const []);
  }

  @override
  Widget build(BuildContext context) {
    final results = _results;
    return Material(
      color: Colors.white,
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
            padding: const EdgeInsets.fromLTRB(16, 14, 8, 12),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    'Tìm dịch vụ chăm sóc',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      color: AppPalette.publicInk,
                      fontWeight: FontWeight.w900,
                    ),
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
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: TextField(
              key: const Key('home-search-field'),
              autofocus: true,
              onChanged: (value) => setState(() => _query = value),
              cursorColor: AppPalette.clinicalBlue,
              decoration: InputDecoration(
                hintText: 'Tên bác sĩ, chuyên khoa hoặc gói khám',
                filled: true,
                fillColor: AppPalette.publicSurfaceMuted,
                prefixIcon: const Icon(
                  Icons.search_rounded,
                  color: AppPalette.clinicalBlue,
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppRadius.md),
                  borderSide: const BorderSide(color: AppPalette.publicBorder),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppRadius.md),
                  borderSide: const BorderSide(
                    color: AppPalette.clinicalBlue,
                    width: 1.8,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Expanded(
            child: results.isEmpty
                ? const AppEmptyState(
                    icon: Icons.search_off_rounded,
                    title: 'Không tìm thấy kết quả',
                    message: 'Thử từ khóa ngắn hơn hoặc chọn một dịch vụ khác.',
                  )
                : ListView(
                    keyboardDismissBehavior:
                        ScrollViewKeyboardDismissBehavior.onDrag,
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 28),
                    children: [
                      if (_query.trim().isEmpty && _recent.isNotEmpty) ...[
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                'Tìm gần đây',
                                style: Theme.of(context).textTheme.titleSmall
                                    ?.copyWith(fontWeight: FontWeight.w800),
                              ),
                            ),
                            TextButton(
                              key: const Key('home-search-clear-recent'),
                              onPressed: _clearRecent,
                              child: const Text('Xóa'),
                            ),
                          ],
                        ),
                        for (final item in _recent)
                          _HomeSearchResultTile(
                            item: _HomeSearchResult.fromHistory(item),
                            isRecent: true,
                            onTap: _select,
                          ),
                        const Padding(
                          padding: EdgeInsets.only(top: 12, bottom: 6),
                          child: Text(
                            'Gợi ý dịch vụ',
                            style: TextStyle(fontWeight: FontWeight.w800),
                          ),
                        ),
                      ],
                      for (final item in results)
                        _HomeSearchResultTile(item: item, onTap: _select),
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}

class _HomeSearchResult {
  const _HomeSearchResult({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.kind,
    required this.location,
  });

  factory _HomeSearchResult.fromHistory(HomeSearchHistoryEntry entry) =>
      _HomeSearchResult(
        title: entry.title,
        subtitle: entry.subtitle,
        icon: switch (entry.kind) {
          HomeSearchHistoryKind.department => Icons.local_hospital_outlined,
          HomeSearchHistoryKind.doctor => Icons.person_search_outlined,
          HomeSearchHistoryKind.medicalPackage =>
            Icons.health_and_safety_outlined,
        },
        kind: entry.kind,
        location: entry.location,
      );

  final String title;
  final String subtitle;
  final IconData icon;
  final HomeSearchHistoryKind kind;
  final String location;

  HomeSearchHistoryEntry toHistoryEntry() => HomeSearchHistoryEntry(
    title: title,
    subtitle: subtitle,
    location: location,
    kind: kind,
  );
}

class _HomeSearchResultTile extends StatelessWidget {
  const _HomeSearchResultTile({
    required this.item,
    required this.onTap,
    this.isRecent = false,
  });

  final _HomeSearchResult item;
  final ValueChanged<_HomeSearchResult> onTap;
  final bool isRecent;

  @override
  Widget build(BuildContext context) => Column(
    children: [
      ListTile(
        key: ValueKey(
          '${isRecent ? 'home-search-recent' : 'home-search-result'}-${item.location}',
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 4, vertical: 3),
        onTap: () => onTap(item),
        leading: Container(
          width: 42,
          height: 42,
          decoration: BoxDecoration(
            color: AppPalette.clinicalBlueContainer,
            borderRadius: BorderRadius.circular(13),
          ),
          child: Icon(
            isRecent ? Icons.history_rounded : item.icon,
            color: AppPalette.clinicalBlue,
          ),
        ),
        title: Text(
          item.title,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
        subtitle: Text(
          item.subtitle,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        trailing: const Icon(
          Icons.chevron_right_rounded,
          color: AppPalette.clinicalBlue,
        ),
      ),
      const Divider(height: 1),
    ],
  );
}

class _HeroCarousel extends StatefulWidget {
  const _HeroCarousel({required this.banners});

  final List<HomeBanner> banners;

  @override
  State<_HeroCarousel> createState() => _HeroCarouselState();
}

class _HeroCarouselState extends State<_HeroCarousel>
    with WidgetsBindingObserver {
  static const _autoPlayInterval = Duration(seconds: 6);
  static const _slideDuration = Duration(milliseconds: 450);

  final PageController _pageController = PageController();
  Timer? _autoPlayTimer;
  AppLifecycleState _lifecycleState = AppLifecycleState.resumed;
  int _currentPage = 0;
  bool _isUserInteracting = false;
  bool _isRouteVisible = true;
  bool _animationsEnabled = true;

  List<HomeBanner> get _slides => widget.banners.isEmpty
      ? const [HomeBanner(id: 'fallback', title: '')]
      : widget.banners;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _lifecycleState =
        WidgetsBinding.instance.lifecycleState ?? AppLifecycleState.resumed;
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _isRouteVisible = TickerMode.of(context);
    _animationsEnabled = !MediaQuery.disableAnimationsOf(context);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _syncAutoPlay();
    });
  }

  @override
  void didUpdateWidget(covariant _HeroCarousel oldWidget) {
    super.didUpdateWidget(oldWidget);
    final oldIds = oldWidget.banners.map((item) => item.id).toList();
    final newIds = widget.banners.map((item) => item.id).toList();
    if (!_sameIds(oldIds, newIds)) {
      _currentPage = 0;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && _pageController.hasClients) {
          _pageController.jumpToPage(0);
        }
      });
    }
    _syncAutoPlay();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _lifecycleState = state;
    _syncAutoPlay();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _autoPlayTimer?.cancel();
    _pageController.dispose();
    super.dispose();
  }

  void _syncAutoPlay() {
    _autoPlayTimer?.cancel();
    if (_slides.length < 2 ||
        _isUserInteracting ||
        !_isRouteVisible ||
        !_animationsEnabled ||
        _lifecycleState != AppLifecycleState.resumed) {
      return;
    }
    _autoPlayTimer = Timer.periodic(_autoPlayInterval, (_) => _showNext());
  }

  Future<void> _showNext() async {
    if (!mounted || !_pageController.hasClients) return;
    final nextPage = (_currentPage + 1) % _slides.length;
    setState(() => _currentPage = nextPage);
    await _pageController.animateToPage(
      nextPage,
      duration: _slideDuration,
      curve: Curves.easeOutCubic,
    );
  }

  void _setUserInteracting(bool value) {
    if (_isUserInteracting == value) return;
    _isUserInteracting = value;
    _syncAutoPlay();
  }

  void _selectPage(int index) {
    if (_currentPage != index) {
      setState(() => _currentPage = index);
    }
    _setUserInteracting(true);
    _pageController
        .animateToPage(
          index,
          duration: _slideDuration,
          curve: Curves.easeOutCubic,
        )
        .whenComplete(() {
          if (mounted) _setUserInteracting(false);
        });
  }

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      final bannerHeight = (constraints.maxWidth / 2.02)
          .clamp(166.0, 190.0)
          .toDouble();
      return Column(
        children: [
          Listener(
            onPointerDown: (_) => _setUserInteracting(true),
            onPointerUp: (_) => _setUserInteracting(false),
            onPointerCancel: (_) => _setUserInteracting(false),
            child: SizedBox(
              height: bannerHeight,
              child: PageView.builder(
                key: const Key('home-hero-carousel'),
                controller: _pageController,
                itemCount: _slides.length,
                onPageChanged: (index) {
                  if (_currentPage == index) return;
                  setState(() => _currentPage = index);
                },
                itemBuilder: (_, index) => _HeroBanner(
                  key: ValueKey('home-hero-${_slides[index].id}'),
                  banner: widget.banners.isEmpty ? null : _slides[index],
                ),
              ),
            ),
          ),
          if (_slides.length > 1) ...[
            const SizedBox(height: 4),
            Semantics(
              label: 'Banner ${_currentPage + 1} trên ${_slides.length}',
              liveRegion: true,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(_slides.length, (index) {
                  final selected = index == _currentPage;
                  return Semantics(
                    button: true,
                    selected: selected,
                    label: 'Xem banner ${index + 1}',
                    child: GestureDetector(
                      key: ValueKey('home-hero-indicator-button-$index'),
                      behavior: HitTestBehavior.opaque,
                      onTap: () => _selectPage(index),
                      child: SizedBox(
                        width: 32,
                        height: 24,
                        child: Center(
                          child: AnimatedContainer(
                            key: ValueKey('home-hero-indicator-$index'),
                            duration: const Duration(milliseconds: 220),
                            width: selected ? 24 : 8,
                            height: 6,
                            decoration: BoxDecoration(
                              color: selected
                                  ? AppPalette.clinicalBlue
                                  : AppPalette.publicBorder,
                              borderRadius: BorderRadius.circular(999),
                            ),
                          ),
                        ),
                      ),
                    ),
                  );
                }),
              ),
            ),
          ],
        ],
      );
    },
  );
}

bool _sameIds(List<String> left, List<String> right) {
  if (left.length != right.length) return false;
  for (var index = 0; index < left.length; index++) {
    if (left[index] != right[index]) return false;
  }
  return true;
}

class _HeroBanner extends StatelessWidget {
  const _HeroBanner({this.banner, super.key});

  final HomeBanner? banner;

  @override
  Widget build(BuildContext context) {
    final image = banner?.preferredImage;
    final imageCacheWidth =
        (MediaQuery.sizeOf(context).width *
                MediaQuery.devicePixelRatioOf(context))
            .ceil()
            .clamp(1, 4096);
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppPalette.clinicalBlueDark, Color(0xFF3B82F6)],
        ),
        borderRadius: BorderRadius.circular(24),
      ),
      child: Stack(
        children: [
          if (image != null)
            Positioned.fill(
              child: Image.network(
                image,
                fit: BoxFit.cover,
                cacheWidth: imageCacheWidth,
                filterQuality: FilterQuality.medium,
                errorBuilder: (_, _, _) => const SizedBox.shrink(),
              ),
            ),
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    AppPalette.clinicalBlueDark.withValues(alpha: 0.96),
                    AppPalette.clinicalBlue.withValues(
                      alpha: image == null ? 0.7 : 0.18,
                    ),
                  ],
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(14),
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 138),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.16),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.3),
                      ),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.verified_user_outlined,
                          color: Colors.white,
                          size: 15,
                        ),
                        SizedBox(width: 5),
                        Text(
                          'ĐẶT LỊCH TRỰC TUYẾN',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 0.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 7),
                  Text(
                    banner?.title.isNotEmpty == true
                        ? banner!.title
                        : 'Đặt lịch đúng chuyên khoa,\nan tâm từng bước',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 5),
                  Text(
                    banner?.subtitle ??
                        'Chủ động chọn dịch vụ, bác sĩ và thời gian phù hợp.',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: Color(0xDFFFFFFF)),
                  ),
                  const SizedBox(height: 8),
                  FilledButton.icon(
                    style: FilledButton.styleFrom(
                      minimumSize: const Size(0, 38),
                      backgroundColor: Colors.white,
                      foregroundColor: AppPalette.clinicalBlueDark,
                    ),
                    onPressed: () =>
                        openBookingFromCurrentRoute(context, '/booking'),
                    icon: const Icon(Icons.calendar_month_outlined),
                    label: const Text('Bắt đầu đặt lịch'),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _DepartmentList extends StatelessWidget {
  const _DepartmentList({required this.items});

  final List<HomeDepartment> items;

  @override
  Widget build(BuildContext context) => GridView.builder(
    shrinkWrap: true,
    primary: false,
    padding: EdgeInsets.zero,
    physics: const NeverScrollableScrollPhysics(),
    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
      crossAxisCount: 3,
      mainAxisSpacing: 7,
      crossAxisSpacing: 7,
      mainAxisExtent: 80,
    ),
    itemCount: items.length,
    itemBuilder: (context, index) {
      final item = items[index];
      final palette = _departmentPalettes[index % _departmentPalettes.length];
      return Material(
        color: Theme.of(context).colorScheme.surface,
        clipBehavior: Clip.antiAlias,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
          side: const BorderSide(color: AppPalette.publicBorder),
        ),
        child: InkWell(
          onTap: () =>
              context.push('/departments/${Uri.encodeComponent(item.id)}'),
          child: Padding(
            padding: const EdgeInsets.all(7),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: palette.background,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    Icons.medical_services_outlined,
                    size: 18,
                    color: palette.foreground,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  item.name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                    height: 1.15,
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    },
  );
}

const _departmentPalettes = <({Color background, Color foreground})>[
  (background: Color(0xFFFFECEC), foreground: Color(0xFFD64545)),
  (background: Color(0xFFE7F0FF), foreground: AppPalette.clinicalBlue),
  (background: Color(0xFFE5F8F2), foreground: Color(0xFF16856A)),
  (background: Color(0xFFFFF3DD), foreground: Color(0xFFA4660D)),
  (background: Color(0xFFEAF6FA), foreground: Color(0xFF2B6F9E)),
  (background: Color(0xFFFCEBED), foreground: Color(0xFFB64075)),
];

class _DoctorList extends StatelessWidget {
  const _DoctorList({required this.items});

  final List<HomeDoctor> items;

  @override
  Widget build(BuildContext context) => SizedBox(
    height: 202,
    child: ListView.separated(
      scrollDirection: Axis.horizontal,
      itemCount: items.length,
      separatorBuilder: (_, _) => const SizedBox(width: 10),
      itemBuilder: (context, index) => SizedBox(
        width: 252,
        child: Align(
          alignment: Alignment.topCenter,
          child: _DoctorCard(doctor: items[index]),
        ),
      ),
    ),
  );
}

class _DoctorCard extends StatelessWidget {
  const _DoctorCard({required this.doctor});

  final HomeDoctor doctor;

  @override
  Widget build(BuildContext context) {
    final slots = doctor.todayAvailableSlots.take(2).toList(growable: false);
    final hiddenSlotCount = doctor.todayAvailableSlots.length - slots.length;
    final experienceText = doctor.experience == null
        ? doctor.specialization ?? 'Tư vấn và thăm khám chuyên khoa'
        : '${doctor.experience} năm kinh nghiệm${doctor.specialization == null ? '' : ' • ${doctor.specialization}'}';

    void openBooking() => openBookingFromCurrentRoute(
      context,
      Uri(
        path: '/booking',
        queryParameters: {'doctorId': doctor.id},
      ).toString(),
    );

    final profileLocation = '/doctors/${Uri.encodeComponent(doctor.id)}';

    return Card(
      color: Colors.white,
      shadowColor: const Color(0x12172B4D),
      elevation: 1,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: const BorderSide(color: AppPalette.publicBorder),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.push(profileLocation),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SizedBox(
                height: 62,
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    CircleAvatar(
                      radius: 22,
                      backgroundColor: AppPalette.clinicalBlueContainer,
                      backgroundImage: resizedNetworkImage(
                        context,
                        doctor.avatar,
                        logicalWidth: 44,
                        logicalHeight: 44,
                      ),
                      child: doctor.avatar?.trim().isNotEmpty != true
                          ? const Icon(
                              Icons.person_outline_rounded,
                              color: AppPalette.clinicalBlueDark,
                              size: 20,
                            )
                          : null,
                    ),
                    const SizedBox(width: 9),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            doctor.displayName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.titleSmall
                                ?.copyWith(
                                  color: AppPalette.publicInk,
                                  fontWeight: FontWeight.w900,
                                ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            doctor.departmentName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.labelMedium
                                ?.copyWith(
                                  color: AppPalette.publicMint,
                                  fontWeight: FontWeight.w800,
                                ),
                          ),
                          const SizedBox(height: 3),
                          Row(
                            children: [
                              if (doctor.reviewCount > 0)
                                _DoctorRatingBadge(
                                  rating: doctor.averageRating,
                                  reviewCount: doctor.reviewCount,
                                ),
                              if (doctor.reviewCount > 0)
                                const SizedBox(width: 5),
                              Expanded(
                                child: Text(
                                  experienceText,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: Theme.of(context).textTheme.labelSmall
                                      ?.copyWith(color: AppPalette.publicMuted),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 5),
              SizedBox(
                height: 64,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  decoration: BoxDecoration(
                    color: AppPalette.clinicalBlueContainer,
                    borderRadius: BorderRadius.circular(11),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              slots.isEmpty
                                  ? 'Lịch khám'
                                  : 'Giờ trống gần nhất',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(context).textTheme.labelSmall
                                  ?.copyWith(
                                    color: AppPalette.publicMuted,
                                    fontWeight: FontWeight.w700,
                                  ),
                            ),
                          ),
                          Text(
                            formatVnd(doctor.consultationFee),
                            style: Theme.of(context).textTheme.labelMedium
                                ?.copyWith(
                                  color: AppPalette.publicInk,
                                  fontWeight: FontWeight.w900,
                                ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 3),
                      Row(
                        children: [
                          Expanded(
                            child: slots.isEmpty
                                ? Text(
                                    'Chọn ngày phù hợp',
                                    style: Theme.of(context)
                                        .textTheme
                                        .labelSmall
                                        ?.copyWith(
                                          color: AppPalette.clinicalBlueDark,
                                          fontWeight: FontWeight.w800,
                                        ),
                                  )
                                : Wrap(
                                    spacing: 4,
                                    children: [
                                      for (final slot in slots)
                                        _DoctorSlotChip(label: slot.startTime),
                                    ],
                                  ),
                          ),
                          TextButton(
                            onPressed: () => context.push(profileLocation),
                            style: TextButton.styleFrom(
                              minimumSize: Size.zero,
                              padding: const EdgeInsets.only(left: 6),
                              visualDensity: VisualDensity.compact,
                              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                              foregroundColor: AppPalette.clinicalBlueDark,
                            ),
                            child: Text(
                              hiddenSlotCount > 0
                                  ? 'Xem thêm +$hiddenSlotCount'
                                  : 'Xem thêm giờ',
                              style: const TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 6),
              FilledButton.icon(
                style: FilledButton.styleFrom(
                  minimumSize: const Size(0, 36),
                  backgroundColor: AppPalette.clinicalBlue,
                  foregroundColor: Colors.white,
                  visualDensity: VisualDensity.compact,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                onPressed: openBooking,
                icon: const Icon(Icons.calendar_month_outlined, size: 16),
                label: const Text('Đặt khám ngay'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DoctorRatingBadge extends StatelessWidget {
  const _DoctorRatingBadge({required this.rating, required this.reviewCount});

  final double rating;
  final int reviewCount;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
    decoration: BoxDecoration(
      color: const Color(0xFFFFF0D8),
      borderRadius: BorderRadius.circular(999),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.star_rounded, size: 13, color: Color(0xFFE09B2D)),
        const SizedBox(width: 2),
        Text(
          '${rating.toStringAsFixed(1)} ($reviewCount)',
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
            color: const Color(0xFF785417),
            fontWeight: FontWeight.w800,
            fontSize: 10,
          ),
        ),
      ],
    ),
  );
}

class _DoctorSlotChip extends StatelessWidget {
  const _DoctorSlotChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(7),
    ),
    child: Text(
      label,
      style: Theme.of(context).textTheme.labelSmall?.copyWith(
        color: AppPalette.clinicalBlueDark,
        fontWeight: FontWeight.w800,
      ),
    ),
  );
}

class _PackageList extends StatelessWidget {
  const _PackageList({required this.items});

  final List<HomeMedicalPackage> items;

  @override
  Widget build(BuildContext context) => SizedBox(
    height: 200,
    child: ListView.separated(
      scrollDirection: Axis.horizontal,
      itemCount: items.length,
      separatorBuilder: (_, _) => const SizedBox(width: 10),
      itemBuilder: (context, index) => SizedBox(
        width: 286,
        child: _PackageCard(
          item: items[index],
          isFeatured: items[index].isPopular,
        ),
      ),
    ),
  );
}

class _PackageCard extends StatelessWidget {
  const _PackageCard({required this.item, required this.isFeatured});

  final HomeMedicalPackage item;
  final bool isFeatured;

  @override
  Widget build(BuildContext context) => Card(
    color: isFeatured ? AppPalette.clinicalBlueDark : Colors.white,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(20),
      side: BorderSide(
        color: isFeatured
            ? AppPalette.clinicalBlueDark
            : AppPalette.publicBorder,
      ),
    ),
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      onTap: item.slug == null
          ? () => openBookingFromCurrentRoute(
              context,
              '/booking?packageId=${item.id}',
            )
          : () => context.push('/packages/${Uri.encodeComponent(item.slug!)}'),
      child: Stack(
        children: [
          if (isFeatured)
            const Positioned(
              right: -26,
              top: -22,
              child: Icon(
                Icons.health_and_safety_outlined,
                size: 126,
                color: Color(0x1FFFFFFF),
              ),
            ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        color: isFeatured
                            ? Colors.white.withValues(alpha: 0.16)
                            : Theme.of(context).colorScheme.primaryContainer,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(
                        Icons.health_and_safety_outlined,
                        size: 21,
                        color: isFeatured
                            ? Colors.white
                            : AppPalette.clinicalBlue,
                      ),
                    ),
                    const SizedBox(width: 9),
                    Expanded(
                      child: Wrap(
                        spacing: 6,
                        runSpacing: 5,
                        children: [
                          if (item.isPopular)
                            _PackageTag(
                              label: 'PHỔ BIẾN',
                              foreground: isFeatured
                                  ? Colors.white
                                  : const Color(0xFF9B5B00),
                              background: isFeatured
                                  ? Colors.white.withValues(alpha: 0.16)
                                  : const Color(0xFFFFE7C2),
                            ),
                          if (item.isBhytSupport)
                            _PackageTag(
                              label: 'HỖ TRỢ BHYT',
                              foreground: isFeatured
                                  ? Colors.white
                                  : const Color(0xFF236A9B),
                              background: isFeatured
                                  ? Colors.white.withValues(alpha: 0.16)
                                  : const Color(0xFFDCEEFF),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  item.name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: isFeatured ? Colors.white : AppPalette.publicInk,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                if (item.summary != null) ...[
                  const SizedBox(height: 5),
                  Text(
                    item.summary!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: isFeatured
                          ? const Color(0xDFFFFFFF)
                          : Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
                const Spacer(),
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Chi phí trọn gói',
                            style: Theme.of(context).textTheme.labelSmall
                                ?.copyWith(
                                  color: isFeatured
                                      ? const Color(0xBFFFFFFF)
                                      : Theme.of(
                                          context,
                                        ).colorScheme.onSurfaceVariant,
                                ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            formatVnd(item.finalPrice),
                            style: Theme.of(context).textTheme.titleMedium
                                ?.copyWith(
                                  color: isFeatured
                                      ? Colors.white
                                      : AppPalette.clinicalBlueDark,
                                  fontWeight: FontWeight.w900,
                                ),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 11,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: isFeatured
                            ? Colors.white
                            : Theme.of(context).colorScheme.primaryContainer,
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            'Chi tiết',
                            style: Theme.of(context).textTheme.labelMedium
                                ?.copyWith(
                                  color: AppPalette.clinicalBlueDark,
                                  fontWeight: FontWeight.w800,
                                ),
                          ),
                          const SizedBox(width: 2),
                          const Icon(
                            Icons.arrow_forward_rounded,
                            size: 17,
                            color: AppPalette.clinicalBlueDark,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}

class _PackageTag extends StatelessWidget {
  const _PackageTag({
    required this.label,
    required this.foreground,
    required this.background,
  });

  final String label;
  final Color foreground;
  final Color background;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
    decoration: BoxDecoration(
      color: background,
      borderRadius: BorderRadius.circular(999),
    ),
    child: Text(
      label,
      style: Theme.of(context).textTheme.labelSmall?.copyWith(
        color: foreground,
        fontWeight: FontWeight.w800,
        fontSize: 10,
      ),
    ),
  );
}

class _EmergencyCard extends StatelessWidget {
  const _EmergencyCard({required this.hotline, required this.onTap});

  final String hotline;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Material(
    key: const Key('home-emergency-support-card'),
    color: AppPalette.dangerContainer,
    borderRadius: BorderRadius.circular(18),
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            const CircleAvatar(
              backgroundColor: AppPalette.danger,
              foregroundColor: Colors.white,
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
                      color: AppPalette.danger,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, color: AppPalette.danger),
          ],
        ),
      ),
    ),
  );
}
