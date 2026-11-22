import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/core/widgets/app_error_banner.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/appointments/application/appointments_controller.dart';
import 'package:hospital_booking_mobile/features/appointments/application/appointment_device_actions.dart';
import 'package:hospital_booking_mobile/features/appointments/presentation/widgets/appointment_qr_ticket.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_state.dart';
import 'package:hospital_booking_mobile/features/home/application/home_content_controller.dart';
import 'package:hospital_booking_mobile/features/home/application/home_dashboard_view_state.dart';
import 'package:hospital_booking_mobile/features/home/application/home_search_history_provider.dart';

import 'package:hospital_booking_mobile/features/home/presentation/widgets/home_appointment_action_card.dart';
import 'package:hospital_booking_mobile/features/notifications/application/notifications_controller.dart';
import 'package:hospital_booking_mobile/features/home/presentation/widgets/home_band.dart';
import 'package:hospital_booking_mobile/features/home/presentation/widgets/home_hero_card.dart';
import 'package:hospital_booking_mobile/features/home/presentation/widgets/home_quick_links.dart';
import 'package:hospital_booking_mobile/features/home/presentation/widgets/home_catalog_sections.dart';
import 'package:hospital_booking_mobile/features/home/presentation/widgets/home_chrome.dart';
import 'package:hospital_booking_mobile/features/home/presentation/widgets/home_doctor_section.dart';
import 'package:hospital_booking_mobile/features/home/presentation/widgets/home_hero_carousel.dart';
import 'package:hospital_booking_mobile/features/home/presentation/widgets/home_search_sheet.dart';
import 'package:hospital_booking_mobile/features/home/presentation/widgets/home_setup_prompts.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';

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
    final upcomingAppointment = dashboard.nextAppointment;
    final unreadNotificationCount = dashboard.unreadNotificationCount;

    final openSearch = content == null
        ? ref.read(homeContentControllerProvider.notifier).refresh
        : () => showHomeSearch(
            context,
            content,
            ref.read(homeSearchHistoryStoreProvider),
          );
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: context.colors.canvas,
      body: AnnotatedRegion<SystemUiOverlayStyle>(
        value: SystemUiOverlayStyle(
          statusBarColor: Colors.transparent,
          statusBarIconBrightness: Brightness.light,
          statusBarBrightness: Brightness.dark,
          systemNavigationBarColor: context.colors.canvas,
          systemNavigationBarIconBrightness: isDark
              ? Brightness.light
              : Brightness.dark,
          systemNavigationBarDividerColor: Colors.transparent,
        ),
        child: Stack(
          children: [
            RefreshIndicator(
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
                  SliverToBoxAdapter(
                    child: _HomeTop(
                      isAuthenticated: isAuthenticated,
                      avatar: user?.avatar,
                      unreadNotificationCount: unreadNotificationCount,
                      onAccount: () =>
                          context.go(isAuthenticated ? '/profile' : '/login'),
                      onSearch: openSearch,
                      onAsk: () => context.push('/chatbot'),
                      onNotifications: isOfflineBrowsing
                          ? ref
                                .read(authControllerProvider.notifier)
                                .bootstrapSession
                          : isAuthenticated
                          ? () => context.push('/notifications')
                          : () => context.push('/login'),
                      card: upcomingAppointment == null
                          ? HomeBookingHeroCard(
                              isAuthenticated: isAuthenticated,
                            )
                          : Column(
                              children: [
                                HomeAppointmentActionCard(
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
                                const SizedBox(height: 4),
                                const Align(
                                  alignment: Alignment.centerLeft,
                                  child: HomeShortcutChips(
                                    items: homeMemberShortcuts,
                                  ),
                                ),
                              ],
                            ),
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
                        child: HomeOfflineContentNotice(
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
                  if (isAuthenticated)
                    const SliverPadding(
                      padding: EdgeInsets.fromLTRB(14, 12, 14, 0),
                      sliver: SliverToBoxAdapter(child: HomeSetupPrompts()),
                    ),
                  const SliverPadding(
                    padding: EdgeInsets.fromLTRB(14, 12, 14, 0),
                    sliver: SliverToBoxAdapter(child: HomeQuickLinks()),
                  ),
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(
                      14,
                      14,
                      14,
                      appMainContentBottomInset,
                    ),
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
                          if (homeState.usingCachedData &&
                              restoreError == null) ...[
                            const SizedBox(height: 8),
                            const HomeCachedDataIndicator(),
                          ],
                          if (content.banners.isNotEmpty) ...[
                            HomeSectionHeader(
                              title: 'Chương trình & ưu đãi',
                              actionLabel: null,
                              onAction: null,
                            ),
                            const SizedBox(height: 6),
                            HomeHeroCarousel(banners: content.banners),
                          ],
                          if (content.doctors.isNotEmpty) ...[
                            const SizedBox(height: 14),
                            HomeSectionHeader(
                              title: 'Bác sĩ nổi bật',
                              subtitle:
                                  'Chọn bác sĩ và khung giờ phù hợp với bạn.',
                              actionLabel: 'Xem tất cả',
                              onAction: () => context.push('/doctors'),
                            ),
                            const SizedBox(height: 6),
                            HomeDoctorList(
                              items: content.doctors.take(5).toList(),
                            ),
                          ],
                          if (content.departments.isNotEmpty) ...[
                            const SizedBox(height: 14),
                            HomeSectionHeader(
                              title: 'Chuyên khoa nổi bật',
                              actionLabel: 'Xem tất cả',
                              onAction: () => context.push('/departments'),
                            ),
                            const SizedBox(height: 8),
                            HomeDepartmentList(
                              items: content.departments.take(6).toList(),
                            ),
                          ],
                          if (content.packages.isNotEmpty) ...[
                            const SizedBox(height: 14),
                            HomeSectionHeader(
                              title: 'Gói khám sức khỏe',
                              actionLabel: 'Xem tất cả',
                              onAction: () => context.push('/packages'),
                            ),
                            const SizedBox(height: 6),
                            HomePackageList(
                              items: content.packages.take(5).toList(),
                            ),
                          ],
                          if (content.siteSettings.emergencyHotline !=
                              null) ...[
                            const SizedBox(height: 14),
                            HomeEmergencyCard(
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
            // Nền màu dưới thanh trạng thái để biểu tượng hệ thống luôn đọc được khi nội dung cuộn lên.
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              height: MediaQuery.paddingOf(context).top,
              child: const ColoredBox(color: AppPalette.heroMid),
            ),
          ],
        ),
      ),
    );
  }
}

/// Dải đầu và thẻ nổi đè lên phía dưới nó (thẻ lịch sắp tới hoặc thẻ mời đặt lịch).
class _HomeTop extends StatelessWidget {
  const _HomeTop({
    required this.isAuthenticated,
    required this.avatar,
    required this.unreadNotificationCount,
    required this.onAccount,
    required this.onSearch,
    required this.onAsk,
    required this.onNotifications,
    required this.card,
  });

  final bool isAuthenticated;
  final String? avatar;
  final int unreadNotificationCount;
  final VoidCallback onAccount;
  final VoidCallback onSearch;
  final VoidCallback onAsk;
  final VoidCallback onNotifications;
  final Widget card;

  static const double _overlap = 34;

  @override
  Widget build(BuildContext context) {
    final bandHeight = homeBandHeight(context);
    return Stack(
      clipBehavior: Clip.none,
      children: [
        HomeBand(
          isAuthenticated: isAuthenticated,
          avatar: avatar,
          unreadNotificationCount: unreadNotificationCount,
          onAccount: onAccount,
          onSearch: onSearch,
          onAsk: onAsk,
          onNotifications: onNotifications,
        ),
        Padding(
          padding: EdgeInsets.fromLTRB(14, bandHeight - _overlap, 14, 0),
          child: card,
        ),
      ],
    );
  }
}
