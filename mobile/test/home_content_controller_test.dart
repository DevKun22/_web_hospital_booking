import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/features/home/application/home_content_controller.dart';
import 'package:hospital_booking_mobile/features/home/data/home_content_cache.dart';
import 'package:hospital_booking_mobile/features/home/data/home_repository.dart';
import 'package:hospital_booking_mobile/features/home/domain/home_content.dart';

class _FakeHomeRepository extends HomeRepository {
  _FakeHomeRepository({required this.cached, required this.fetch})
    : super(dio: Dio(), cache: MemoryHomeContentCache());

  final HomeContent? cached;
  final Future<HomeFetchResult> Function() fetch;

  @override
  Future<HomeContent?> readCached() async => cached;

  @override
  Future<HomeFetchResult> fetchAndCache({HomeContent? fallback}) => fetch();
}

HomeContent _content(String title) => HomeContent(
  banners: [HomeBanner(id: title, title: title)],
  departments: const [],
  doctors: const [],
  packages: const [],
  faqs: const [],
  siteSettings: const HomeSiteSettings(),
  fetchedAt: DateTime(2030),
);

void main() {
  test('keeps cached home content visible when refresh is offline', () async {
    final networkGate = Completer<HomeFetchResult>();
    final cached = _content('Dữ liệu đã lưu');
    final repository = _FakeHomeRepository(
      cached: cached,
      fetch: () => networkGate.future,
    );
    final container = ProviderContainer(
      overrides: [homeRepositoryProvider.overrideWithValue(repository)],
    );
    addTearDown(container.dispose);

    container.read(homeContentControllerProvider);
    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);

    var state = container.read(homeContentControllerProvider);
    expect(state.content, same(cached));
    expect(state.isRefreshing, isTrue);
    expect(state.usingCachedData, isTrue);

    networkGate.completeError(
      const ApiException(
        kind: ApiErrorKind.network,
        message: 'Không thể kết nối máy chủ.',
      ),
    );
    await Future<void>.delayed(Duration.zero);

    state = container.read(homeContentControllerProvider);
    expect(state.content, same(cached));
    expect(state.isRefreshing, isFalse);
    expect(state.error?.kind, ApiErrorKind.network);
    expect(state.usingCachedData, isTrue);
  });
}
