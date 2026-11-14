import 'dart:async';
import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/app/navigation/booking_navigation.dart';
import 'package:hospital_booking_mobile/features/home/domain/home_content.dart';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';

class HomeHeroCarousel extends StatefulWidget {
  const HomeHeroCarousel({super.key, required this.banners});

  final List<HomeBanner> banners;

  @override
  State<HomeHeroCarousel> createState() => _HeroCarouselState();
}

class _HeroCarouselState extends State<HomeHeroCarousel>
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
  void didUpdateWidget(covariant HomeHeroCarousel oldWidget) {
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
                                  ? context.colors.primary
                                  : context.colors.border,
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
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppPalette.heroDeep, AppPalette.heroMid],
        ),
        borderRadius: BorderRadius.circular(24),
      ),
      child: Stack(
        children: [
          if (image != null)
            Positioned.fill(
              child: Image(
                image: ResizeImage.resizeIfNeeded(
                  imageCacheWidth,
                  null,
                  CachedNetworkImageProvider(image),
                ),
                fit: BoxFit.cover,
                filterQuality: FilterQuality.medium,
                errorBuilder: (_, _, _) => const SizedBox.shrink(),
              ),
            ),
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    AppPalette.heroDeep.withValues(alpha: 0.96),
                    AppPalette.heroMid.withValues(
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
                    style: const TextStyle(color: AppPalette.onHeroMuted),
                  ),
                  const SizedBox(height: 8),
                  FilledButton.icon(
                    style: FilledButton.styleFrom(
                      minimumSize: const Size(0, 38),
                      backgroundColor: Colors.white,
                      foregroundColor: AppPalette.heroDeep,
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
