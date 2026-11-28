import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/providers/app_providers.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/dependents/data/dependent_profiles_repository.dart';
import 'package:hospital_booking_mobile/features/dependents/domain/dependent_profile.dart';

import 'package:hospital_booking_mobile/core/state/synced_notifier.dart';

final dependentProfilesRepositoryProvider =
    Provider<DependentProfilesRepository>(
      (ref) => DependentProfilesRepository(ref.watch(authenticatedDioProvider)),
    );

final dependentProfilesControllerProvider =
    NotifierProvider<DependentProfilesController, DependentProfilesState>(
      DependentProfilesController.new,
    );

class DependentProfilesState {
  const DependentProfilesState({
    this.items = const [],
    this.isLoading = false,
    this.isSaving = false,
    this.loaded = false,
    this.lastSyncedAt,
    this.error,
  });

  final List<DependentProfile> items;
  final bool isLoading;
  final bool isSaving;
  final bool loaded;
  final DateTime? lastSyncedAt;
  final ApiException? error;

  DependentProfilesState copyWith({
    List<DependentProfile>? items,
    bool? isLoading,
    bool? isSaving,
    bool? loaded,
    DateTime? lastSyncedAt,
    ApiException? error,
    bool clearError = false,
  }) => DependentProfilesState(
    items: items ?? this.items,
    isLoading: isLoading ?? this.isLoading,
    isSaving: isSaving ?? this.isSaving,
    loaded: loaded ?? this.loaded,
    lastSyncedAt: lastSyncedAt ?? this.lastSyncedAt,
    error: clearError ? null : (error ?? this.error),
  );
}

class DependentProfilesController
    extends SyncedNotifier<DependentProfilesState> {
  String? _ownerId;
  int _requestVersion = 0;

  @override
  DependentProfilesState build() {
    _requestVersion += 1;
    _ownerId = ref.watch(
      authControllerProvider.select((state) => state.user?.id),
    );
    if (_ownerId != null) Future<void>.microtask(load);
    return DependentProfilesState(isLoading: _ownerId != null);
  }

  @override
  DateTime? get lastSyncedAt => state.lastSyncedAt;

  @override
  Future<void> refresh() => load(force: true);

  Future<void> load({bool force = false}) async {
    if (_ownerId == null || state.isSaving) return;
    if (state.loaded && !force) return;
    final version = ++_requestVersion;
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final items = await ref.read(dependentProfilesRepositoryProvider).list();
      if (version != _requestVersion) return;
      state = DependentProfilesState(
        items: items,
        loaded: true,
        lastSyncedAt: DateTime.now(),
      );
    } on ApiException catch (error) {
      if (version != _requestVersion) return;
      state = state.copyWith(isLoading: false, loaded: true, error: error);
    }
  }

  /// Thêm hồ sơ người thân mới; trả hồ sơ vừa tạo, null khi máy chủ từ chối (xem [DependentProfilesState.error]).
  Future<DependentProfile?> create(DependentProfileDraft draft) =>
      _save(() => ref.read(dependentProfilesRepositoryProvider).create(draft));

  /// Sửa riêng các trường vừa đổi của một hồ sơ.
  Future<bool> updateFields(String id, Map<String, Object?> fields) async =>
      await _save(
        () => ref.read(dependentProfilesRepositoryProvider).update(id, fields),
      ) !=
      null;

  Future<DependentProfile?> _save(
    Future<DependentProfile> Function() action,
  ) async {
    if (_ownerId == null || state.isSaving) return null;
    final version = _requestVersion;
    final ownerId = _ownerId;
    state = state.copyWith(isSaving: true, clearError: true);
    try {
      final saved = await action();
      // Đã đăng xuất hoặc đổi tài khoản trong lúc lưu: không chèn hồ sơ của người trước vào danh sách người sau.
      if (!_isCurrent(version, ownerId)) return null;
      final next = [...state.items];
      final index = next.indexWhere((item) => item.id == saved.id);
      if (index < 0) {
        next.insert(0, saved);
      } else {
        next[index] = saved;
      }
      state = DependentProfilesState(
        items: next,
        loaded: true,
        lastSyncedAt: DateTime.now(),
      );
      return saved;
    } on ApiException catch (error) {
      if (!_isCurrent(version, ownerId)) return null;
      state = state.copyWith(isSaving: false, error: error);
      return null;
    }
  }

  Future<bool> archive(String id) async {
    if (_ownerId == null || state.isSaving) return false;
    final version = _requestVersion;
    final ownerId = _ownerId;
    state = state.copyWith(isSaving: true, clearError: true);
    try {
      await ref.read(dependentProfilesRepositoryProvider).archive(id);
      if (!_isCurrent(version, ownerId)) return false;
      state = DependentProfilesState(
        items: state.items.where((item) => item.id != id).toList(),
        loaded: true,
        lastSyncedAt: DateTime.now(),
      );
      return true;
    } on ApiException catch (error) {
      if (!_isCurrent(version, ownerId)) return false;
      state = state.copyWith(isSaving: false, error: error);
      return false;
    }
  }

  bool _isCurrent(int version, String? ownerId) =>
      version == _requestVersion && ownerId == _ownerId;

  void dismissError() => state = state.copyWith(clearError: true);
}
