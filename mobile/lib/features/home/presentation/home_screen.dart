import 'dart:async';
import 'package:flutter/material.dart';
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
import 'package:hospital_booking_mobile/features/home/presentation/widgets/home_service_hub.dart';
import 'package:hospital_booking_mobile/features/home/presentation/widgets/home_catalog_sections.dart';
import 'package:hospital_booking_mobile/features/home/presentation/widgets/home_chrome.dart';
import 'package:hospital_booking_mobile/features/home/presentation/widgets/home_doctor_section.dart';
import 'package:hospital_booking_mobile/features/home/presentation/widgets/home_hero_carousel.dart';
import 'package:hospital_booking_mobile/features/home/presentation/widgets/home_search_sheet.dart';
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
    final hospitalName = content?.siteSettings.hospitalName;
    final upcomingAppointment = dashboard.nextAppointment;
    final unreadNotificationCount = dashboard.unreadNotificationCount;

    return Scaffold(
      backgroundColor: context.colors.canvas,
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
              backgroundColor: context.colors.surface,
              surfaceTintColor: Colors.transparent,
              elevation: 0,
              scrolledUnderElevation: 2,
              shadowColor: context.colors.shadowTint,
              toolbarHeight: 64,
              titleSpacing: 14,
              title: HomeHeader(
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
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(14, 10, 14, 0),
              sliver: SliverToBoxAdapter(
                child: Column(
                  children: [
                    HomeSearchBar(
                      onTap: content == null
                          ? ref
                                .read(homeContentControllerProvider.notifier)
                                .refresh
                          : () => showHomeSearch(
                              context,
                              content,
                              ref.read(homeSearchHistoryStoreProvider),
                            ),
                    ),
                    if (content != null && content.departments.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      HomeQuickDepartmentChips(
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
                    if (homeState.usingCachedData && restoreError == null) ...[
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
                        subtitle: 'Chọn bác sĩ và khung giờ phù hợp với bạn.',
                        actionLabel: 'Xem tất cả',
                        onAction: () => context.push('/doctors'),
                      ),
                      const SizedBox(height: 6),
                      HomeDoctorList(items: content.doctors.take(5).toList()),
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
                      HomePackageList(items: content.packages.take(5).toList()),
                    ],
                    if (content.siteSettings.emergencyHotline != null) ...[
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
    );
  }
}
