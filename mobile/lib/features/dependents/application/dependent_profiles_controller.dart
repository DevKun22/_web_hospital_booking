import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/providers/app_providers.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/dependents/data/dependent_profiles_repository.dart';
import 'package:hospital_booking_mobile/features/dependents/domain/dependent_profile.dart';

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

class DependentProfilesController extends Notifier<DependentProfilesState> {
  String? _ownerId;
  int _requestVersion = 0;

  @override
  DependentProfilesState build() {
    _ownerId = ref.watch(
      authControllerProvider.select((state) => state.user?.id),
    );
    if (_ownerId != null) Future<void>.microtask(load);
    return DependentProfilesState(isLoading: _ownerId != null);
  }

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

  Future<void> refreshIfStale({required Duration maxAge}) async {
    final lastSyncedAt = state.lastSyncedAt;
    if (lastSyncedAt != null &&
        DateTime.now().difference(lastSyncedAt) < maxAge) {
      return;
    }
    await load(force: true);
  }

  Future<bool> save(DependentProfileDraft draft, {String? id}) async {
    if (_ownerId == null || state.isSaving) return false;
    state = state.copyWith(isSaving: true, clearError: true);
    try {
      final repository = ref.read(dependentProfilesRepositoryProvider);
      final saved = id == null
          ? await repository.create(draft)
          : await repository.update(id, draft);
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
      return true;
    } on ApiException catch (error) {
      state = state.copyWith(isSaving: false, error: error);
      return false;
    }
  }

  Future<bool> archive(String id) async {
    if (_ownerId == null || state.isSaving) return false;
    state = state.copyWith(isSaving: true, clearError: true);
    try {
      await ref.read(dependentProfilesRepositoryProvider).archive(id);
      state = DependentProfilesState(
        items: state.items.where((item) => item.id != id).toList(),
        loaded: true,
        lastSyncedAt: DateTime.now(),
      );
      return true;
    } on ApiException catch (error) {
      state = state.copyWith(isSaving: false, error: error);
      return false;
    }
  }

  void dismissError() => state = state.copyWith(clearError: true);
}
