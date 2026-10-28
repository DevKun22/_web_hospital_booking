import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/providers/app_providers.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/notifications/data/notifications_repository.dart';
import 'package:hospital_booking_mobile/features/notifications/domain/patient_notification.dart';

final notificationsRepositoryProvider = Provider<NotificationsRepository>(
  (ref) => NotificationsRepository(ref.watch(authenticatedDioProvider)),
);

final notificationsControllerProvider =
    NotifierProvider<NotificationsController, NotificationsState>(
      NotificationsController.new,
    );

class NotificationsState {
  const NotificationsState({
    this.items = const [],
    this.total = 0,
    this.unreadCount = 0,
    this.nextPage = 1,
    this.hasNextPage = false,
    this.isInitialLoading = false,
    this.isRefreshing = false,
    this.isLoadingMore = false,
    this.isMarkingAllRead = false,
    this.readingIds = const {},
    this.lastSyncedAt,
    this.error,
  });

  final List<PatientNotification> items;
  final int total;
  final int unreadCount;
  final int nextPage;
  final bool hasNextPage;
  final bool isInitialLoading;
  final bool isRefreshing;
  final bool isLoadingMore;
  final bool isMarkingAllRead;
  final Set<String> readingIds;
  final DateTime? lastSyncedAt;
  final ApiException? error;

  bool get hasItems => items.isNotEmpty;

  NotificationsState copyWith({
    List<PatientNotification>? items,
    int? total,
    int? unreadCount,
    int? nextPage,
    bool? hasNextPage,
    bool? isInitialLoading,
    bool? isRefreshing,
    bool? isLoadingMore,
    bool? isMarkingAllRead,
    Set<String>? readingIds,
    DateTime? lastSyncedAt,
    ApiException? error,
    bool clearError = false,
  }) => NotificationsState(
    items: items ?? this.items,
    total: total ?? this.total,
    unreadCount: unreadCount ?? this.unreadCount,
    nextPage: nextPage ?? this.nextPage,
    hasNextPage: hasNextPage ?? this.hasNextPage,
    isInitialLoading: isInitialLoading ?? this.isInitialLoading,
    isRefreshing: isRefreshing ?? this.isRefreshing,
    isLoadingMore: isLoadingMore ?? this.isLoadingMore,
    isMarkingAllRead: isMarkingAllRead ?? this.isMarkingAllRead,
    readingIds: readingIds ?? this.readingIds,
    lastSyncedAt: lastSyncedAt ?? this.lastSyncedAt,
    error: clearError ? null : (error ?? this.error),
  );
}

class NotificationsController extends Notifier<NotificationsState> {
  static const _pageSize = 20;
  int _requestVersion = 0;
  int _markAllGeneration = 0;
  String? _patientId;

  @override
  NotificationsState build() {
    _requestVersion += 1;
    _patientId = ref.watch(
      authControllerProvider.select((state) => state.user?.id),
    );
    if (_patientId != null) Future<void>.microtask(load);
    return NotificationsState(isInitialLoading: _patientId != null);
  }

  Future<void> load() async {
    if (_patientId == null) return;
    final requestVersion = ++_requestVersion;
    state = const NotificationsState(isInitialLoading: true);
    await _loadFirstPage(requestVersion);
  }

  Future<void> refresh() async {
    if (_patientId == null || state.isInitialLoading || state.isRefreshing) {
      return;
    }
    final requestVersion = ++_requestVersion;
    state = state.copyWith(
      isInitialLoading: state.items.isEmpty,
      isRefreshing: state.items.isNotEmpty,
      isLoadingMore: false,
      clearError: true,
    );
    await _loadFirstPage(requestVersion);
  }

  Future<void> refreshIfStale({required Duration maxAge}) async {
    final lastSyncedAt = state.lastSyncedAt;
    final isFresh =
        lastSyncedAt != null &&
        DateTime.now().difference(lastSyncedAt) < maxAge;
    if (isFresh) return;
    await refresh();
  }

  Future<void> _loadFirstPage(int requestVersion) async {
    try {
      final repository = ref.read(notificationsRepositoryProvider);
      final page = await repository.list(limit: _pageSize);
      if (requestVersion != _requestVersion) return;
      state = NotificationsState(
        items: page.items,
        total: page.total,
        unreadCount: page.unreadCount,
        nextPage: page.page + 1,
        hasNextPage: page.hasNextPage,
        lastSyncedAt: DateTime.now(),
      );
    } on ApiException catch (error) {
      if (requestVersion != _requestVersion) return;
      state = state.copyWith(
        isInitialLoading: false,
        isRefreshing: false,
        error: error,
      );
    }
  }

  Future<void> loadMore() async {
    if (_patientId == null ||
        state.isInitialLoading ||
        state.isRefreshing ||
        state.isLoadingMore ||
        !state.hasNextPage) {
      return;
    }

    final requestVersion = _requestVersion;
    state = state.copyWith(isLoadingMore: true, clearError: true);
    try {
      final page = await ref
          .read(notificationsRepositoryProvider)
          .list(page: state.nextPage, limit: _pageSize);
      if (requestVersion != _requestVersion) return;
      final byId = <String, PatientNotification>{
        for (final item in state.items) item.id: item,
        for (final item in page.items) item.id: item,
      };
      state = state.copyWith(
        items: byId.values.toList(growable: false),
        total: page.total,
        nextPage: page.page + 1,
        hasNextPage: page.hasNextPage,
        isLoadingMore: false,
      );
    } on ApiException catch (error) {
      if (requestVersion != _requestVersion) return;
      state = state.copyWith(isLoadingMore: false, error: error);
    }
  }

  Future<bool> markRead(String id) async {
    final index = state.items.indexWhere((item) => item.id == id);
    if (_patientId == null || index < 0) return false;
    if (state.items[index].isRead) return true;
    if (state.readingIds.contains(id)) return false;

    final requestVersion = _requestVersion;
    final markAllGeneration = _markAllGeneration;
    final previousItem = state.items[index];
    final readingIds = {...state.readingIds, id};
    final optimisticItems = [...state.items];
    optimisticItems[index] = optimisticItems[index].copyWith(
      isRead: true,
      readAt: DateTime.now(),
    );
    state = state.copyWith(
      items: optimisticItems,
      unreadCount: state.unreadCount > 0 ? state.unreadCount - 1 : 0,
      readingIds: readingIds,
      clearError: true,
    );

    try {
      final updated = await ref
          .read(notificationsRepositoryProvider)
          .markRead(id);
      if (requestVersion != _requestVersion) return false;
      state = state.copyWith(
        items: [
          for (final item in state.items)
            if (item.id == id) updated else item,
        ],
        readingIds: {...state.readingIds}..remove(id),
      );
      return true;
    } on ApiException catch (error) {
      if (requestVersion != _requestVersion) return false;
      final currentItems = [...state.items];
      final currentIndex = currentItems.indexWhere((item) => item.id == id);
      final canRollback =
          currentIndex >= 0 && _markAllGeneration == markAllGeneration;
      if (canRollback) currentItems[currentIndex] = previousItem;
      state = state.copyWith(
        items: currentItems,
        unreadCount: canRollback ? state.unreadCount + 1 : state.unreadCount,
        readingIds: {...state.readingIds}..remove(id),
        error: error,
      );
      return false;
    }
  }

  Future<bool> markAllRead() async {
    if (_patientId == null ||
        state.unreadCount == 0 ||
        state.isMarkingAllRead) {
      return false;
    }
    final requestVersion = _requestVersion;
    _markAllGeneration += 1;
    state = state.copyWith(isMarkingAllRead: true, clearError: true);

    try {
      await ref.read(notificationsRepositoryProvider).markAllRead();
      if (requestVersion != _requestVersion) return false;
      final readAt = DateTime.now();
      state = state.copyWith(
        items: [
          for (final item in state.items)
            if (item.isRead)
              item
            else
              item.copyWith(isRead: true, readAt: readAt),
        ],
        unreadCount: 0,
        isMarkingAllRead: false,
      );
      return true;
    } on ApiException catch (error) {
      if (requestVersion != _requestVersion) return false;
      state = state.copyWith(isMarkingAllRead: false, error: error);
      return false;
    }
  }

  void dismissError() => state = state.copyWith(clearError: true);
}
