import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/providers/app_providers.dart';
import 'package:hospital_booking_mobile/features/home/data/home_content_cache.dart';
import 'package:hospital_booking_mobile/features/home/data/home_repository.dart';
import 'package:hospital_booking_mobile/features/home/domain/home_content.dart';

final homeContentCacheProvider = Provider<HomeContentCache>(
  (ref) => SharedHomeContentCache(),
);

final homeRepositoryProvider = Provider<HomeRepository>(
  (ref) => HomeRepository(
    dio: ref.watch(authDioProvider),
    cache: ref.watch(homeContentCacheProvider),
  ),
);

final homeContentControllerProvider =
    NotifierProvider<HomeContentController, HomeContentState>(
      HomeContentController.new,
    );

class HomeContentState {
  const HomeContentState({
    this.content,
    this.error,
    this.isInitialLoading = false,
    this.isRefreshing = false,
    this.usingCachedData = false,
  });

  final HomeContent? content;
  final ApiException? error;
  final bool isInitialLoading;
  final bool isRefreshing;
  final bool usingCachedData;

  bool get hasContent => content != null;
}

class HomeContentController extends Notifier<HomeContentState> {
  int _requestVersion = 0;

  @override
  HomeContentState build() {
    Future<void>.microtask(load);
    return const HomeContentState(isInitialLoading: true);
  }

  Future<void> load() async {
    final requestVersion = ++_requestVersion;
    final repository = ref.read(homeRepositoryProvider);
    HomeContent? cached;
    try {
      cached = await repository.readCached();
    } catch (_) {
      // A damaged or unavailable local cache must never block fresh content.
    }
    if (requestVersion != _requestVersion) return;
    if (cached != null) {
      state = HomeContentState(
        content: cached,
        isRefreshing: true,
        usingCachedData: true,
      );
    }
    await _fetch(repository, cached, requestVersion);
  }

  Future<void> refresh() async {
    final requestVersion = ++_requestVersion;
    final current = state.content;
    state = HomeContentState(
      content: current,
      isInitialLoading: current == null,
      isRefreshing: current != null,
      usingCachedData: state.usingCachedData,
    );
    await _fetch(ref.read(homeRepositoryProvider), current, requestVersion);
  }

  Future<void> _fetch(
    HomeRepository repository,
    HomeContent? fallback,
    int requestVersion,
  ) async {
    try {
      final content = await repository.fetchAndCache();
      if (requestVersion != _requestVersion) return;
      state = HomeContentState(content: content);
    } on ApiException catch (error) {
      if (requestVersion != _requestVersion) return;
      state = HomeContentState(
        content: fallback,
        error: error,
        usingCachedData: fallback != null,
      );
    }
  }

  void dismissError() => state = HomeContentState(
    content: state.content,
    usingCachedData: state.usingCachedData,
  );
}
