import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/app/router/route_guard.dart';
import 'package:hospital_booking_mobile/app/theme/app_theme.dart';
import 'package:hospital_booking_mobile/core/widgets/app_error_banner.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/core/widgets/resized_network_image.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_state.dart';
import 'package:hospital_booking_mobile/features/home/application/home_content_controller.dart';
import 'package:hospital_booking_mobile/features/home/domain/home_content.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider);
    final homeState = ref.watch(homeContentControllerProvider);
    final content = homeState.content;
    final user = auth.user;
    final isAuthenticated = auth.isAuthenticated;
    final isOfflineBrowsing = auth.status == AuthStatus.offlineBrowsing;
    final sessionError = auth.errorFor(AuthErrorOrigin.session);
    final restoreError = auth.errorFor(AuthErrorOrigin.sessionRestore);
    final hospitalName = content?.siteSettings.hospitalName;

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 20,
        title: Row(
          children: [
            const AppBrandMark(size: 36),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                hospitalName?.isNotEmpty == true
                    ? hospitalName!
                    : 'Hospital Booking',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            onPressed: isOfflineBrowsing
                ? ref.read(authControllerProvider.notifier).bootstrapSession
                : () => context.push(
                    isAuthenticated ? '/profile' : loginLocation('/profile'),
                  ),
            icon: Icon(
              isOfflineBrowsing
                  ? Icons.cloud_sync_outlined
                  : isAuthenticated
                  ? Icons.account_circle_outlined
                  : Icons.login_rounded,
            ),
            tooltip: isOfflineBrowsing
                ? 'Khôi phục phiên'
                : isAuthenticated
                ? 'Hồ sơ'
                : 'Đăng nhập',
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: ref.read(homeContentControllerProvider.notifier).refresh,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
            children: [
              if (sessionError != null) ...[
                AppErrorBanner(
                  error: sessionError,
                  onDismiss: ref
                      .read(authControllerProvider.notifier)
                      .dismissError,
                ),
                const SizedBox(height: 16),
              ],
              if (restoreError != null) ...[
                AppErrorBanner(error: restoreError),
                const SizedBox(height: 8),
                Text(
                  'Bạn đang xem nội dung công khai đã lưu. Kết nối lại để mở lịch khám và hồ sơ cá nhân.',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
                Align(
                  alignment: Alignment.centerLeft,
                  child: TextButton.icon(
                    onPressed: ref
                        .read(authControllerProvider.notifier)
                        .bootstrapSession,
                    icon: const Icon(Icons.cloud_sync_outlined),
                    label: const Text('Khôi phục phiên'),
                  ),
                ),
                const SizedBox(height: 8),
              ],
              if (homeState.error != null &&
                  content != null &&
                  restoreError == null) ...[
                AppErrorBanner(
                  error: homeState.error!,
                  onDismiss: ref
                      .read(homeContentControllerProvider.notifier)
                      .dismissError,
                ),
                const SizedBox(height: 8),
                TextButton.icon(
                  onPressed: ref
                      .read(homeContentControllerProvider.notifier)
                      .refresh,
                  icon: const Icon(Icons.refresh_rounded),
                  label: const Text('Thử tải dữ liệu mới'),
                ),
                const SizedBox(height: 8),
              ],
              Text(
                isAuthenticated
                    ? 'Xin chào, ${user?.fullName ?? 'bệnh nhân'}'
                    : 'Chăm sóc sức khỏe dễ dàng hơn',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                isAuthenticated
                    ? 'Dịch vụ và thông tin khám của bạn luôn được đồng bộ.'
                    : 'Khám phá dịch vụ và đặt lịch mà chưa cần tài khoản.',
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 20),
              if (homeState.isInitialLoading) ...[
                const AppLoadingSkeleton(height: 230),
                const SizedBox(height: 20),
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
                if (homeState.usingCachedData) ...[
                  const SizedBox(height: 8),
                  Text(
                    'Đang hiển thị dữ liệu đã lưu và kiểm tra cập nhật…',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
                const SizedBox(height: 10),
                _HeroCarousel(banners: content.banners),
                const SizedBox(height: 14),
                const _ChatbotPromptCard(),
                const SizedBox(height: 22),
                const AppSectionHeader(title: 'Dịch vụ của bạn'),
                const SizedBox(height: 10),
                _ServiceGrid(
                  isAuthenticated: isAuthenticated,
                  isOfflineBrowsing: isOfflineBrowsing,
                ),
                if (content.departments.isNotEmpty) ...[
                  const SizedBox(height: 24),
                  AppSectionHeader(
                    title: 'Chuyên khoa phổ biến',
                    actionLabel: 'Xem tất cả',
                    onAction: () => context.push('/departments'),
                  ),
                  const SizedBox(height: 10),
                  _DepartmentList(items: content.departments.take(8).toList()),
                ],
                if (content.doctors.isNotEmpty) ...[
                  const SizedBox(height: 24),
                  const AppSectionHeader(title: 'Bác sĩ nổi bật'),
                  const SizedBox(height: 10),
                  ...content.doctors
                      .take(3)
                      .map(
                        (doctor) => Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: _DoctorCard(doctor: doctor),
                        ),
                      ),
                ],
                if (content.packages.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  const AppSectionHeader(title: 'Gói khám được quan tâm'),
                  const SizedBox(height: 10),
                  ...content.packages
                      .take(2)
                      .map(
                        (item) => Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: _PackageCard(item: item),
                        ),
                      ),
                ],
                if (content.faqs.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  const AppSectionHeader(title: 'Hỏi đáp & hướng dẫn khám'),
                  const SizedBox(height: 8),
                  Card(
                    child: Column(
                      children: content.faqs
                          .take(4)
                          .map(
                            (faq) => ExpansionTile(
                              title: Text(faq.question),
                              childrenPadding: const EdgeInsets.fromLTRB(
                                16,
                                0,
                                16,
                                16,
                              ),
                              children: [
                                Align(
                                  alignment: Alignment.centerLeft,
                                  child: Text(faq.answer),
                                ),
                              ],
                            ),
                          )
                          .toList(growable: false),
                    ),
                  ),
                ],
                if (content.siteSettings.emergencyHotline != null) ...[
                  const SizedBox(height: 20),
                  _EmergencyCard(
                    hotline: content.siteSettings.emergencyHotline!,
                  ),
                ],
              ],
              if (!isAuthenticated && !isOfflineBrowsing) ...[
                const SizedBox(height: 22),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(18),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Đã có tài khoản bệnh nhân?',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'Đăng nhập để xem lịch, hồ sơ sức khỏe và kết quả khám trên mọi thiết bị.',
                          style: Theme.of(context).textTheme.bodyMedium
                              ?.copyWith(
                                color: Theme.of(
                                  context,
                                ).colorScheme.onSurfaceVariant,
                              ),
                        ),
                        const SizedBox(height: 14),
                        OutlinedButton.icon(
                          onPressed: () => context.push('/login'),
                          icon: const Icon(Icons.login_rounded),
                          label: const Text('Đăng nhập'),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _ChatbotPromptCard extends StatelessWidget {
  const _ChatbotPromptCard();

  @override
  Widget build(BuildContext context) => InkWell(
    onTap: () => context.push('/chatbot'),
    borderRadius: BorderRadius.circular(18),
    child: Ink(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFDDF7F2), Color(0xFFEAF4FC)],
        ),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppTheme.softBorder),
      ),
      child: Row(
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              color: AppTheme.primary,
              borderRadius: BorderRadius.circular(15),
            ),
            child: const Icon(Icons.smart_toy_outlined, color: Colors.white),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Trợ lý đặt lịch 24/7',
                  style: Theme.of(
                    context,
                  ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 3),
                Text(
                  'Tìm chuyên khoa, bác sĩ và lịch trống phù hợp.',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          const Icon(Icons.arrow_forward_rounded, color: AppTheme.primary),
        ],
      ),
    ),
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
      final bannerHeight = (constraints.maxWidth / 1.48)
          .clamp(238.0, 280.0)
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
            padding: const EdgeInsets.all(20),
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 190),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const AppStatusBadge(
                    label: 'CHĂM SÓC TOÀN DIỆN',
                    tone: AppStatusTone.success,
                    icon: Icons.health_and_safety_outlined,
                  ),
                  const SizedBox(height: 14),
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
                  const SizedBox(height: 8),
                  Text(
                    banner?.subtitle ??
                        'Chủ động chọn dịch vụ, bác sĩ và thời gian phù hợp.',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: Color(0xDFFFFFFF)),
                  ),
                  const SizedBox(height: 16),
                  FilledButton.icon(
                    style: FilledButton.styleFrom(
                      minimumSize: const Size(0, 44),
                      backgroundColor: Colors.white,
                      foregroundColor: AppTheme.primary,
                    ),
                    onPressed: () => context.go('/booking'),
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

class _ServiceGrid extends StatelessWidget {
  const _ServiceGrid({
    required this.isAuthenticated,
    required this.isOfflineBrowsing,
  });

  final bool isAuthenticated;
  final bool isOfflineBrowsing;

  @override
  Widget build(BuildContext context) => GridView.count(
    shrinkWrap: true,
    physics: const NeverScrollableScrollPhysics(),
    crossAxisCount: 2,
    mainAxisSpacing: 12,
    crossAxisSpacing: 12,
    childAspectRatio: 1.15,
    children: [
      _FeatureCard(
        icon: Icons.calendar_month_outlined,
        label: 'Đặt lịch khám',
        detail: 'Không cần tài khoản',
        onTap: () => context.go('/booking'),
      ),
      _FeatureCard(
        icon: Icons.event_note_outlined,
        label: 'Lịch khám của tôi',
        detail: isOfflineBrowsing
            ? 'Cần kết nối mạng'
            : isAuthenticated
            ? 'Đã đăng nhập'
            : 'Cần đăng nhập',
        onTap: () => _openProtected(context, '/appointments'),
      ),
      _FeatureCard(
        icon: Icons.description_outlined,
        label: 'Kết quả khám',
        detail: isOfflineBrowsing
            ? 'Cần kết nối mạng'
            : 'Bảo vệ bằng tài khoản',
        onTap: () => _openProtected(context, '/medical-records'),
      ),
      _FeatureCard(
        icon: Icons.medication_outlined,
        label: 'Đơn thuốc',
        detail: isOfflineBrowsing
            ? 'Cần kết nối mạng'
            : 'Bảo vệ bằng tài khoản',
        onTap: () => _openProtected(context, '/prescriptions'),
      ),
    ],
  );

  void _openProtected(BuildContext context, String location) {
    if (isOfflineBrowsing) {
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          const SnackBar(
            content: Text(
              'Cần kết nối mạng và khôi phục phiên để mở thông tin cá nhân.',
            ),
          ),
        );
      return;
    }
    context.push(isAuthenticated ? location : loginLocation(location));
  }
}

class _DepartmentList extends StatelessWidget {
  const _DepartmentList({required this.items});

  final List<HomeDepartment> items;

  @override
  Widget build(BuildContext context) => SizedBox(
    height: 98,
    child: ListView.separated(
      scrollDirection: Axis.horizontal,
      itemCount: items.length,
      separatorBuilder: (_, _) => const SizedBox(width: 10),
      itemBuilder: (context, index) {
        final item = items[index];
        return InkWell(
          onTap: () =>
              context.push('/departments/${Uri.encodeComponent(item.id)}'),
          borderRadius: BorderRadius.circular(18),
          child: Container(
            width: 116,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: AppTheme.softBorder),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(
                  Icons.medical_services_outlined,
                  color: AppTheme.primary,
                ),
                const Spacer(),
                Text(
                  item.name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.labelLarge,
                ),
              ],
            ),
          ),
        );
      },
    ),
  );
}

class _DoctorCard extends StatelessWidget {
  const _DoctorCard({required this.doctor});

  final HomeDoctor doctor;

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            radius: 28,
            backgroundColor: Theme.of(context).colorScheme.primaryContainer,
            backgroundImage: resizedNetworkImage(
              context,
              doctor.avatar,
              logicalWidth: 56,
              logicalHeight: 56,
            ),
            child: doctor.avatar?.trim().isNotEmpty != true
                ? const Icon(Icons.person_outline_rounded)
                : null,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  doctor.displayName,
                  style: Theme.of(context).textTheme.titleSmall,
                ),
                const SizedBox(height: 4),
                Text(
                  doctor.specialization ?? doctor.departmentName,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        _formatVnd(doctor.consultationFee),
                        style: const TextStyle(
                          color: AppTheme.primaryDark,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    IconButton.outlined(
                      onPressed: () => context.push(
                        '/doctors/${Uri.encodeComponent(doctor.id)}',
                      ),
                      tooltip: 'Xem hồ sơ',
                      icon: const Icon(Icons.person_search_outlined),
                    ),
                    const SizedBox(width: 8),
                    FilledButton(
                      style: FilledButton.styleFrom(
                        minimumSize: const Size(0, 38),
                        padding: const EdgeInsets.symmetric(horizontal: 14),
                      ),
                      onPressed: () => context.push(
                        Uri(
                          path: '/booking',
                          queryParameters: {'doctorId': doctor.id},
                        ).toString(),
                      ),
                      child: const Text('Đặt khám'),
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

class _PackageCard extends StatelessWidget {
  const _PackageCard({required this.item});

  final HomeMedicalPackage item;

  @override
  Widget build(BuildContext context) => Card(
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      onTap: item.slug == null
          ? () => context.push('/booking?packageId=${item.id}')
          : () => context.push('/packages/${Uri.encodeComponent(item.slug!)}'),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                if (item.isPopular)
                  const AppStatusBadge(
                    label: 'PHỔ BIẾN',
                    tone: AppStatusTone.warning,
                  ),
                if (item.isBhytSupport)
                  const AppStatusBadge(
                    label: 'HỖ TRỢ BHYT',
                    tone: AppStatusTone.info,
                  ),
              ],
            ),
            const SizedBox(height: 10),
            Text(item.name, style: Theme.of(context).textTheme.titleMedium),
            if (item.summary != null) ...[
              const SizedBox(height: 5),
              Text(
                item.summary!,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
            ],
            const SizedBox(height: 12),
            Text(
              _formatVnd(item.finalPrice),
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                color: AppTheme.primaryDark,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 10),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                Text(
                  'Xem chi tiết',
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: AppTheme.primary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(width: 4),
                const Icon(
                  Icons.arrow_forward_rounded,
                  size: 18,
                  color: AppTheme.primary,
                ),
              ],
            ),
          ],
        ),
      ),
    ),
  );
}

class _EmergencyCard extends StatelessWidget {
  const _EmergencyCard({required this.hotline});

  final String hotline;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: const Color(0xFFFCEBED),
      borderRadius: BorderRadius.circular(18),
    ),
    child: Row(
      children: [
        const CircleAvatar(
          backgroundColor: Color(0xFFB64048),
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
                  color: const Color(0xFFB64048),
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
        ),
        const Icon(Icons.phone_in_talk_rounded, color: Color(0xFFB64048)),
      ],
    ),
  );
}

class _FeatureCard extends StatelessWidget {
  const _FeatureCard({
    required this.icon,
    required this.label,
    required this.detail,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final String detail;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Card(
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(18),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.primaryContainer,
                borderRadius: BorderRadius.circular(13),
              ),
              child: Icon(icon, color: Theme.of(context).colorScheme.primary),
            ),
            const Spacer(),
            Text(label, style: Theme.of(context).textTheme.titleSmall),
            const SizedBox(height: 3),
            Text(
              detail,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
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
