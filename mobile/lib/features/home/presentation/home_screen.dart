import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/app/navigation/booking_navigation.dart';
import 'package:hospital_booking_mobile/app/theme/app_theme.dart';
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
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
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
              backgroundColor: Theme.of(context).scaffoldBackgroundColor,
              surfaceTintColor: Colors.transparent,
              elevation: 0,
              scrolledUnderElevation: 2,
              shadowColor: const Color(0x1A173033),
              toolbarHeight: 68,
              titleSpacing: 16,
              title: _HomeHeader(
                hospitalName: hospitalName,
                avatar: user?.avatar,
                isAuthenticated: isAuthenticated,
                unreadNotificationCount: unreadNotificationCount,
                onNotifications: isOfflineBrowsing
                    ? ref.read(authControllerProvider.notifier).bootstrapSession
                    : isAuthenticated
                    ? () => context.go('/notifications')
                    : () => context.go('/login'),
                onProfile: () =>
                    context.go(isAuthenticated ? '/profile' : '/login'),
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
            if (upcomingAppointment != null)
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
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
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
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
                    if (!isAuthenticated) ...[
                      const SizedBox(height: 10),
                      _ChatbotTeaser(onTap: () => context.push('/chatbot')),
                    ],
                  ],
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              sliver: SliverToBoxAdapter(
                child: HomeServiceHub(
                  isAuthenticated: isAuthenticated,
                  isOfflineBrowsing: isOfflineBrowsing,
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 108),
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
                    _HeroCarousel(banners: content.banners),
                    if (content.packages.isNotEmpty) ...[
                      const SizedBox(height: 18),
                      AppSectionHeader(
                        title: 'Gói khám nổi bật',
                        actionLabel: 'Xem tất cả',
                        onAction: () => context.push('/packages'),
                      ),
                      const SizedBox(height: 6),
                      _PackageList(items: content.packages.take(5).toList()),
                    ],
                    if (content.departments.isNotEmpty) ...[
                      const SizedBox(height: 18),
                      AppSectionHeader(
                        title: 'Chuyên khoa phổ biến',
                        actionLabel: 'Xem tất cả',
                        onAction: () => context.push('/departments'),
                      ),
                      const SizedBox(height: 6),
                      _DepartmentList(
                        items: content.departments.take(8).toList(),
                      ),
                    ],
                    if (content.doctors.isNotEmpty) ...[
                      const SizedBox(height: 20),
                      AppSectionHeader(
                        title: 'Bác sĩ chuyên khoa',
                        actionLabel: 'Xem tất cả',
                        onAction: () => context.push('/doctors'),
                      ),
                      const SizedBox(height: 6),
                      ...content.doctors
                          .take(2)
                          .map(
                            (doctor) => Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child: _DoctorCard(doctor: doctor),
                            ),
                          ),
                    ],
                    if (content.faqs.isNotEmpty) ...[
                      const SizedBox(height: 10),
                      const AppSectionHeader(title: 'Hỏi đáp & hướng dẫn khám'),
                      const SizedBox(height: 8),
                      _FaqList(items: content.faqs.take(3).toList()),
                    ],
                    if (content.siteSettings.emergencyHotline != null) ...[
                      const SizedBox(height: 20),
                      _EmergencyCard(
                        hotline: content.siteSettings.emergencyHotline!,
                        onTap: () => context.push('/support'),
                      ),
                    ],
                  ],
                  if (!isAuthenticated && !isOfflineBrowsing) ...[
                    const SizedBox(height: 22),
                    _GuestLoginCard(onLogin: () => context.push('/login')),
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

class _HomeHeader extends StatelessWidget {
  const _HomeHeader({
    required this.hospitalName,
    required this.avatar,
    required this.isAuthenticated,
    required this.unreadNotificationCount,
    required this.onNotifications,
    required this.onProfile,
  });

  final String? hospitalName;
  final String? avatar;
  final bool isAuthenticated;
  final int unreadNotificationCount;
  final VoidCallback onNotifications;
  final VoidCallback onProfile;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      const AppBrandMark(size: 42),
      const SizedBox(width: 10),
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(
                  Icons.local_hospital_outlined,
                  size: 14,
                  color: AppTheme.primary,
                ),
                const SizedBox(width: 4),
                Text(
                  'MEDCARE BOOKING',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: AppTheme.clinicalInk,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.6,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 2),
            Text(
              hospitalName ?? 'Hệ thống đặt lịch khám',
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
      const SizedBox(width: 6),
      Material(
        color: AppTheme.primary,
        shape: const CircleBorder(),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onProfile,
          child: CircleAvatar(
            radius: 21,
            backgroundColor: AppTheme.primary,
            backgroundImage: isAuthenticated
                ? resizedNetworkImage(
                    context,
                    avatar,
                    logicalWidth: 42,
                    logicalHeight: 42,
                  )
                : null,
            child: avatar?.trim().isNotEmpty == true
                ? null
                : Icon(
                    isAuthenticated
                        ? Icons.person_rounded
                        : Icons.login_rounded,
                    color: Colors.white,
                    size: 21,
                  ),
          ),
        ),
      ),
    ],
  );
}

class _HomeSearchBar extends StatelessWidget {
  const _HomeSearchBar({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Material(
    color: AppPalette.surfaceMuted,
    borderRadius: BorderRadius.circular(15),
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      key: const Key('home-search-button'),
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Row(
          children: [
            const Icon(Icons.search_rounded, color: AppPalette.mutedInk),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                'Tìm bác sĩ, chuyên khoa, gói khám',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
            ),
            const Icon(Icons.tune_rounded, color: AppTheme.primary, size: 20),
          ],
        ),
      ),
    ),
  );
}

class _ChatbotTeaser extends StatelessWidget {
  const _ChatbotTeaser({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.fromLTRB(12, 10, 10, 10),
    decoration: BoxDecoration(
      gradient: const LinearGradient(
        colors: [Color(0xFFBDF4EA), Color(0xFFDCEEFF)],
      ),
      borderRadius: BorderRadius.circular(16),
    ),
    child: Row(
      children: [
        const CircleAvatar(
          radius: 20,
          backgroundColor: AppTheme.primary,
          foregroundColor: Colors.white,
          child: Icon(Icons.smart_toy_rounded, size: 21),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Trợ lý sức khỏe AI 24/7',
                style: Theme.of(
                  context,
                ).textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 2),
              Text(
                'Gợi ý chuyên khoa và hỗ trợ đặt lịch',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: 8),
        OutlinedButton(
          style: OutlinedButton.styleFrom(
            minimumSize: const Size(0, AppSize.minimumTouchTarget),
            padding: const EdgeInsets.symmetric(horizontal: 12),
            backgroundColor: Colors.white,
          ),
          onPressed: onTap,
          child: const Text('Trò chuyện'),
        ),
      ],
    ),
  );
}

class _GuestLoginCard extends StatelessWidget {
  const _GuestLoginCard({required this.onLogin});

  final VoidCallback onLogin;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: AppPalette.successContainer,
      borderRadius: BorderRadius.circular(20),
      border: Border.all(color: AppPalette.border),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Đã có tài khoản bệnh nhân?',
          style: Theme.of(
            context,
          ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 5),
        Text(
          'Đăng nhập để theo dõi lịch khám, hồ sơ, đơn thuốc và thông báo.',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: 13),
        OutlinedButton.icon(
          onPressed: onLogin,
          icon: const Icon(Icons.login_rounded),
          label: const Text('Đăng nhập'),
        ),
      ],
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
        color: Theme.of(context).colorScheme.primaryContainer,
        shape: const CircleBorder(),
        child: IconButton(
          onPressed: onTap,
          icon: const Icon(
            Icons.notifications_none_rounded,
            color: AppTheme.primaryDark,
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
        border: Border.all(color: AppTheme.softBorder),
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
          subtitle: 'Gói khám • ${_formatVnd(item.finalPrice)}',
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
            padding: const EdgeInsets.fromLTRB(16, 14, 8, 12),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    'Tìm dịch vụ chăm sóc',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
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
              decoration: const InputDecoration(
                hintText: 'Tên bác sĩ, chuyên khoa hoặc gói khám',
                prefixIcon: Icon(Icons.search_rounded),
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
            color: Theme.of(context).colorScheme.primaryContainer,
            borderRadius: BorderRadius.circular(13),
          ),
          child: Icon(
            isRecent ? Icons.history_rounded : item.icon,
            color: AppTheme.primary,
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
        trailing: const Icon(Icons.chevron_right_rounded),
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
      final bannerHeight = (constraints.maxWidth / 1.72)
          .clamp(198.0, 224.0)
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
            const SizedBox(height: 10),
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
                            height: 8,
                            decoration: BoxDecoration(
                              color: selected
                                  ? AppTheme.primary
                                  : AppTheme.softBorder,
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
          colors: [AppTheme.primary, Color(0xFF0A9290)],
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
                    AppTheme.primary.withValues(alpha: 0.96),
                    AppTheme.primary.withValues(
                      alpha: image == null ? 0.7 : 0.18,
                    ),
                  ],
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(18),
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 164),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const AppStatusBadge(
                    label: 'CHĂM SÓC TOÀN DIỆN',
                    tone: AppStatusTone.success,
                    icon: Icons.health_and_safety_outlined,
                  ),
                  const SizedBox(height: 10),
                  Text(
                    banner?.title.isNotEmpty == true
                        ? banner!.title
                        : 'Đặt lịch đúng chuyên khoa,\nan tâm từng bước',
                    maxLines: 3,
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
                  const SizedBox(height: 11),
                  FilledButton.icon(
                    style: FilledButton.styleFrom(
                      minimumSize: const Size(0, 40),
                      backgroundColor: Colors.white,
                      foregroundColor: AppTheme.primary,
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
  Widget build(BuildContext context) => SizedBox(
    height: 48,
    child: ListView.separated(
      scrollDirection: Axis.horizontal,
      itemCount: items.length,
      separatorBuilder: (_, _) => const SizedBox(width: 8),
      itemBuilder: (context, index) {
        final item = items[index];
        final isHighlighted = index == 0;
        return ActionChip(
          onPressed: () =>
              context.push('/departments/${Uri.encodeComponent(item.id)}'),
          avatar: Icon(
            Icons.medical_services_outlined,
            size: 18,
            color: isHighlighted ? Colors.white : AppTheme.primary,
          ),
          label: Text(item.name, maxLines: 1, overflow: TextOverflow.ellipsis),
          labelStyle: Theme.of(context).textTheme.labelLarge?.copyWith(
            color: isHighlighted ? Colors.white : AppTheme.clinicalInk,
            fontWeight: FontWeight.w700,
          ),
          backgroundColor: isHighlighted ? AppTheme.primary : Colors.white,
          side: BorderSide(
            color: isHighlighted ? AppTheme.primary : AppTheme.softBorder,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(999),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 8),
          materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
          visualDensity: VisualDensity.compact,
        );
      },
    ),
  );
}

class _DoctorCard extends StatelessWidget {
  const _DoctorCard({required this.doctor});

  final HomeDoctor doctor;

  @override
  Widget build(BuildContext context) {
    final slots = doctor.todayAvailableSlots.take(2).toList(growable: false);
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

    return Card(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: const BorderSide(color: AppTheme.softBorder),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                CircleAvatar(
                  radius: 29,
                  backgroundColor: Theme.of(
                    context,
                  ).colorScheme.primaryContainer,
                  backgroundImage: resizedNetworkImage(
                    context,
                    doctor.avatar,
                    logicalWidth: 58,
                    logicalHeight: 58,
                  ),
                  child: doctor.avatar?.trim().isNotEmpty != true
                      ? const Icon(
                          Icons.person_outline_rounded,
                          color: AppTheme.primaryDark,
                          size: 27,
                        )
                      : null,
                ),
                const SizedBox(width: 11),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              doctor.displayName,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(context).textTheme.titleSmall
                                  ?.copyWith(fontWeight: FontWeight.w900),
                            ),
                          ),
                          if (doctor.reviewCount > 0) ...[
                            const SizedBox(width: 6),
                            _DoctorRatingBadge(
                              rating: doctor.averageRating,
                              reviewCount: doctor.reviewCount,
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 3),
                      Text(
                        doctor.departmentName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Theme.of(context).colorScheme.secondary,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        experienceText,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 11),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 9),
              decoration: BoxDecoration(
                color: const Color(0xFFF0F4FC),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          slots.isEmpty ? 'Lịch khám' : 'Giờ trống hôm nay',
                          style: Theme.of(context).textTheme.labelSmall
                              ?.copyWith(
                                color: Theme.of(
                                  context,
                                ).colorScheme.onSurfaceVariant,
                              ),
                        ),
                        const SizedBox(height: 5),
                        if (slots.isEmpty)
                          InkWell(
                            onTap: openBooking,
                            borderRadius: BorderRadius.circular(7),
                            child: const Padding(
                              padding: EdgeInsets.symmetric(
                                horizontal: 2,
                                vertical: 2,
                              ),
                              child: Text(
                                'Xem giờ trống →',
                                style: TextStyle(
                                  color: AppTheme.primary,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                          )
                        else
                          Wrap(
                            spacing: 5,
                            children: [
                              for (final slot in slots)
                                _DoctorSlotChip(label: slot.startTime),
                            ],
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 10),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        'Phí khám',
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                      ),
                      const SizedBox(height: 5),
                      Text(
                        _formatVnd(doctor.consultationFee),
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          color: AppTheme.clinicalInk,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size(0, 40),
                      padding: const EdgeInsets.symmetric(horizontal: 10),
                      backgroundColor: const Color(0xFFF5F8FE),
                    ),
                    onPressed: () => context.push(
                      '/doctors/${Uri.encodeComponent(doctor.id)}',
                    ),
                    child: const Text('Xem hồ sơ'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: FilledButton(
                    style: FilledButton.styleFrom(
                      minimumSize: const Size(0, 40),
                      padding: const EdgeInsets.symmetric(horizontal: 10),
                    ),
                    onPressed: openBooking,
                    child: const Text('Đặt khám'),
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
        color: AppTheme.primary,
        fontWeight: FontWeight.w800,
      ),
    ),
  );
}

class _FaqList extends StatelessWidget {
  const _FaqList({required this.items});

  final List<HomeFaq> items;

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(10),
      child: Column(
        children: [
          for (var index = 0; index < items.length; index++) ...[
            DecoratedBox(
              decoration: BoxDecoration(
                color: const Color(0xFFF0F5F7),
                borderRadius: BorderRadius.circular(12),
              ),
              child: ExpansionTile(
                tilePadding: const EdgeInsets.symmetric(horizontal: 12),
                childrenPadding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                dense: true,
                shape: const Border(),
                collapsedShape: const Border(),
                title: Text(
                  items[index].question,
                  style: Theme.of(
                    context,
                  ).textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w700),
                ),
                children: [
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Text(items[index].answer),
                  ),
                ],
              ),
            ),
            if (index < items.length - 1) const SizedBox(height: 6),
          ],
        ],
      ),
    ),
  );
}

class _PackageList extends StatelessWidget {
  const _PackageList({required this.items});

  final List<HomeMedicalPackage> items;

  @override
  Widget build(BuildContext context) => SizedBox(
    height: 220,
    child: ListView.separated(
      scrollDirection: Axis.horizontal,
      itemCount: items.length,
      separatorBuilder: (_, _) => const SizedBox(width: 10),
      itemBuilder: (context, index) => SizedBox(
        width: 306,
        child: _PackageCard(item: items[index], isFeatured: index == 0),
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
    color: isFeatured ? AppTheme.primaryDark : Colors.white,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(20),
      side: BorderSide(
        color: isFeatured ? AppTheme.primaryDark : AppTheme.softBorder,
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
                        color: isFeatured ? Colors.white : AppTheme.primary,
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
                    color: isFeatured ? Colors.white : AppTheme.clinicalInk,
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
                            _formatVnd(item.finalPrice),
                            style: Theme.of(context).textTheme.titleMedium
                                ?.copyWith(
                                  color: isFeatured
                                      ? Colors.white
                                      : AppTheme.primaryDark,
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
                                  color: AppTheme.primaryDark,
                                  fontWeight: FontWeight.w800,
                                ),
                          ),
                          const SizedBox(width: 2),
                          const Icon(
                            Icons.arrow_forward_rounded,
                            size: 17,
                            color: AppTheme.primaryDark,
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

String _formatVnd(double value) {
  final digits = value.round().toString();
  final buffer = StringBuffer();
  for (var index = 0; index < digits.length; index += 1) {
    if (index > 0 && (digits.length - index) % 3 == 0) buffer.write('.');
    buffer.write(digits[index]);
  }
  return '${buffer.toString()} đ';
}
