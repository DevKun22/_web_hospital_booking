import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/core/config/app_brand.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/widgets/app_error_banner.dart';
import 'package:hospital_booking_mobile/core/widgets/app_motion.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/appointments/application/appointment_device_actions.dart';
import 'package:hospital_booking_mobile/features/appointments/application/appointments_controller.dart';
import 'package:hospital_booking_mobile/features/appointments/presentation/widgets/appointment_qr_ticket.dart';
import 'package:hospital_booking_mobile/features/articles/application/latest_articles_provider.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_state.dart';
import 'package:hospital_booking_mobile/features/home/application/home_content_controller.dart';
import 'package:hospital_booking_mobile/features/home/application/home_dashboard_view_state.dart';
import 'package:hospital_booking_mobile/features/home/application/home_search_history_provider.dart';
import 'package:hospital_booking_mobile/features/home/presentation/widgets/home_appointment_action_card.dart';
import 'package:hospital_booking_mobile/features/home/presentation/widgets/home_band.dart';
import 'package:hospital_booking_mobile/features/home/presentation/widgets/home_chrome.dart';
import 'package:hospital_booking_mobile/features/home/presentation/widgets/home_article_list.dart';
import 'package:hospital_booking_mobile/features/home/presentation/widgets/home_department_grid.dart';
import 'package:hospital_booking_mobile/features/home/presentation/widgets/home_doctor_strip.dart';
import 'package:hospital_booking_mobile/features/home/presentation/widgets/home_package_strip.dart';
import 'package:hospital_booking_mobile/features/home/presentation/widgets/home_hero_carousel.dart';
import 'package:hospital_booking_mobile/features/home/presentation/widgets/home_quick_links.dart';
import 'package:hospital_booking_mobile/features/home/presentation/widgets/home_search_sheet.dart';
import 'package:hospital_booking_mobile/features/home/presentation/widgets/home_setup_prompts.dart';
import 'package:hospital_booking_mobile/features/notifications/application/notifications_controller.dart';
import 'package:url_launcher/url_launcher.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  final _scroll = ScrollController();
  final _offset = ValueNotifier<double>(0);

  @override
  void initState() {
    super.initState();
    _scroll.addListener(
      () => _offset.value = _scroll.hasClients ? _scroll.offset : 0,
    );
  }

  @override
  void dispose() {
    _scroll.dispose();
    _offset.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);
    final homeState = ref.watch(homeContentControllerProvider);
    final content = homeState.content;
    final dashboard = ref.watch(homeDashboardViewStateProvider);
    final isAuthenticated = dashboard.isAuthenticated;
    final isOfflineBrowsing = dashboard.isOfflineBrowsing;
    final sessionError = auth.errorFor(AuthErrorOrigin.session);
    final restoreError = auth.errorFor(AuthErrorOrigin.sessionRestore);
    final upcomingAppointment = dashboard.nextAppointment;
    final unreadNotificationCount = dashboard.unreadNotificationCount;
    final articles = ref.watch(latestArticlesProvider).value ?? const [];

    final openSearch = content == null
        ? ref.read(homeContentControllerProvider.notifier).refresh
        : () => showHomeSearch(
            context,
            content,
            ref.read(homeSearchHistoryStoreProvider),
          );
    void openAsk() => unawaited(context.push<void>('/chatbot'));
    final openNotifications = isOfflineBrowsing
        ? ref.read(authControllerProvider.notifier).bootstrapSession
        : () => unawaited(context.push<void>('/notifications'));
    final isDark = Theme.of(context).brightness == Brightness.dark;
    var order = 0;

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
                ref.refresh(latestArticlesProvider.future),
              ]),
              child: CustomScrollView(
                controller: _scroll,
                physics: const AlwaysScrollableScrollPhysics(),
                slivers: [
                  SliverToBoxAdapter(
                    child: _HomeTop(
                      showBell: isAuthenticated,
                      unreadNotificationCount: unreadNotificationCount,
                      onSearch: openSearch,
                      onAsk: openAsk,
                      onNotifications: openNotifications,
                      hero: HomeHeroCarousel(
                        banners: content?.banners ?? const [],
                      ),
                    ),
                  ),
                  if (sessionError != null && restoreError == null)
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(
                        AppSpacing.md,
                        AppSpacing.xs,
                        AppSpacing.md,
                        0,
                      ),
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
                      padding: const EdgeInsets.fromLTRB(
                        AppSpacing.md,
                        AppSpacing.xs,
                        AppSpacing.md,
                        0,
                      ),
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
                      padding: const EdgeInsets.fromLTRB(
                        AppSpacing.md,
                        AppSpacing.xs,
                        AppSpacing.md,
                        0,
                      ),
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
                      padding: const EdgeInsets.fromLTRB(
                        AppSpacing.md,
                        AppSpacing.xs,
                        AppSpacing.md,
                        0,
                      ),
                      sliver: SliverToBoxAdapter(
                        child: FadeSlideIn(
                          order: order++,
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
                    ),
                  if (isAuthenticated)
                    const SliverPadding(
                      padding: EdgeInsets.fromLTRB(
                        AppSpacing.md,
                        AppSpacing.xs,
                        AppSpacing.md,
                        0,
                      ),
                      sliver: SliverToBoxAdapter(child: HomeSetupPrompts()),
                    ),
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(
                      AppSpacing.md,
                      AppSpacing.xs,
                      AppSpacing.md,
                      0,
                    ),
                    sliver: SliverToBoxAdapter(
                      child: FadeSlideIn(
                        order: order++,
                        child: const HomeServiceCard(),
                      ),
                    ),
                  ),
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(
                      AppSpacing.md,
                      AppSpacing.md,
                      AppSpacing.md,
                      appMainContentBottomInset,
                    ),
                    sliver: SliverList(
                      delegate: SliverChildListDelegate([
                        if (homeState.isInitialLoading) ...[
                          const AppLoadingSkeleton(height: 110),
                          const SizedBox(height: AppSpacing.sm),
                          const AppLoadingSkeleton(height: 90),
                        ] else if (content == null) ...[
                          AppEmptyState(
                            icon: Icons.cloud_off_outlined,
                            title: 'Chưa tải được nội dung',
                            message:
                                homeState.error?.message ??
                                'Kéo xuống hoặc thử lại để kết nối máy chủ.',
                            action: FilledButton.icon(
                              onPressed: ref
                                  .read(homeContentControllerProvider.notifier)
                                  .refresh,
                              icon: const Icon(Icons.refresh_outlined),
                              label: const Text('Thử lại'),
                            ),
                          ),
                        ] else ...[
                          if (homeState.usingCachedData &&
                              restoreError == null) ...[
                            const HomeCachedDataIndicator(),
                            const SizedBox(height: AppSpacing.xs),
                          ],
                          if (content.doctors.isNotEmpty)
                            _Section(
                              order: order++,
                              title: 'Bác sĩ nổi bật',
                              onAction: () => context.push('/doctors'),
                              child: HomeDoctorStrip(
                                items: content.doctors.take(6).toList(),
                              ),
                            ),
                          if (content.departments.isNotEmpty)
                            _Section(
                              order: order++,
                              title: 'Chuyên khoa',
                              onAction: () => context.push('/departments'),
                              child: HomeDepartmentGrid(
                                items: content.departments.take(6).toList(),
                              ),
                            ),
                          if (content.packages.isNotEmpty)
                            _Section(
                              order: order++,
                              title: 'Gói khám',
                              onAction: () => context.push('/packages'),
                              child: HomePackageStrip(
                                items: content.packages.take(6).toList(),
                              ),
                            ),
                          if (articles.isNotEmpty)
                            _Section(
                              order: order++,
                              title: 'Kiến thức sức khỏe',
                              onAction: () => unawaited(
                                launchUrl(
                                  Uri.parse('${AppBrand.webUrl}/kien-thuc'),
                                  mode: LaunchMode.externalApplication,
                                ),
                              ),
                              child: HomeArticleList(items: articles),
                            ),
                          if (content.siteSettings.emergencyHotline !=
                              null) ...[
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
            // Nền màu dưới thanh trạng thái để biểu tượng hệ thống luôn đọc được.
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              height: MediaQuery.paddingOf(context).top,
              child: const ColoredBox(color: AppPalette.heroMid),
            ),
            // Thanh tìm kiếm thu gọn hiện dần khi cuộn qua dải đầu.
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              child: ValueListenableBuilder<double>(
                valueListenable: _offset,
                builder: (context, offset, _) {
                  final t = ((offset - 90) / 50).clamp(0.0, 1.0);
                  if (t == 0) return const SizedBox.shrink();
                  return IgnorePointer(
                    ignoring: t < 0.5,
                    child: Opacity(
                      opacity: t,
                      child: Transform.translate(
                        offset: Offset(0, -12 * (1 - t)),
                        child: ColoredBox(
                          color: AppPalette.heroMid,
                          child: Padding(
                            padding: EdgeInsets.fromLTRB(
                              12,
                              MediaQuery.paddingOf(context).top + 8,
                              12,
                              8,
                            ),
                            child: SizedBox(
                              height: 48,
                              child: HomeSearchRow(
                                showBell: isAuthenticated,
                                unreadNotificationCount:
                                    unreadNotificationCount,
                                onSearch: openSearch,
                                onAsk: openAsk,
                                onNotifications: openNotifications,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Một khối nội dung: tiêu đề nhỏ, "Tất cả", rồi dải ngang; hiện dần nối tiếp nhau.
class _Section extends StatelessWidget {
  const _Section({
    required this.order,
    required this.title,
    required this.onAction,
    required this.child,
  });

  final int order;
  final String title;
  final VoidCallback onAction;
  final Widget child;

  @override
  Widget build(BuildContext context) => FadeSlideIn(
    order: order,
    child: Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          HomeSectionHeader(
            title: title,
            actionLabel: 'Tất cả',
            onAction: onAction,
          ),
          const SizedBox(height: AppSpacing.xs),
          child,
        ],
      ),
    ),
  );
}

/// Dải đầu và banner nổi đè lên phía dưới nó.
class _HomeTop extends StatelessWidget {
  const _HomeTop({
    required this.showBell,
    required this.unreadNotificationCount,
    required this.onSearch,
    required this.onAsk,
    required this.onNotifications,
    required this.hero,
  });

  final bool showBell;
  final int unreadNotificationCount;
  final VoidCallback onSearch;
  final VoidCallback onAsk;
  final VoidCallback onNotifications;
  final Widget hero;

  static const double _overlap = 30;

  @override
  Widget build(BuildContext context) {
    final bandHeight = homeBandHeight(context);
    return Stack(
      clipBehavior: Clip.none,
      children: [
        HomeBand(
          showBell: showBell,
          unreadNotificationCount: unreadNotificationCount,
          onSearch: onSearch,
          onAsk: onAsk,
          onNotifications: onNotifications,
        ),
        Padding(
          padding: EdgeInsets.fromLTRB(
            AppSpacing.md,
            bandHeight - _overlap,
            AppSpacing.md,
            0,
          ),
          child: hero,
        ),
      ],
    );
  }
}
