import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/providers/app_providers.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/invoices/data/invoices_repository.dart';
import 'package:hospital_booking_mobile/features/invoices/domain/patient_invoice.dart';

final invoicesRepositoryProvider = Provider<InvoicesRepository>(
  (ref) => InvoicesRepository(ref.watch(authenticatedDioProvider)),
);

final invoicesControllerProvider =
    NotifierProvider<InvoicesController, InvoicesState>(InvoicesController.new);

final invoiceDetailProvider = FutureProvider.autoDispose
    .family<PatientInvoice, String>((ref, invoiceId) async {
      ref.watch(authControllerProvider.select((state) => state.user?.id));
      return ref.watch(invoicesRepositoryProvider).getById(invoiceId);
    });

class InvoicesState {
  const InvoicesState({
    this.items = const [],
    this.total = 0,
    this.nextPage = 1,
    this.hasNextPage = false,
    this.isInitialLoading = false,
    this.isRefreshing = false,
    this.isLoadingMore = false,
    this.error,
  });

  final List<PatientInvoice> items;
  final int total;
  final int nextPage;
  final bool hasNextPage;
  final bool isInitialLoading;
  final bool isRefreshing;
  final bool isLoadingMore;
  final ApiException? error;

  bool get hasItems => items.isNotEmpty;

  InvoicesState copyWith({
    List<PatientInvoice>? items,
    int? total,
    int? nextPage,
    bool? hasNextPage,
    bool? isInitialLoading,
    bool? isRefreshing,
    bool? isLoadingMore,
    ApiException? error,
    bool clearError = false,
  }) => InvoicesState(
    items: items ?? this.items,
    total: total ?? this.total,
    nextPage: nextPage ?? this.nextPage,
    hasNextPage: hasNextPage ?? this.hasNextPage,
    isInitialLoading: isInitialLoading ?? this.isInitialLoading,
    isRefreshing: isRefreshing ?? this.isRefreshing,
    isLoadingMore: isLoadingMore ?? this.isLoadingMore,
    error: clearError ? null : (error ?? this.error),
  );
}

class InvoicesController extends Notifier<InvoicesState> {
  static const _pageSize = 20;
  int _requestVersion = 0;
  String? _patientId;

  @override
  InvoicesState build() {
    _requestVersion += 1;
    _patientId = ref.watch(
      authControllerProvider.select((state) => state.user?.id),
    );
    if (_patientId != null) Future<void>.microtask(load);
    return InvoicesState(isInitialLoading: _patientId != null);
  }

  Future<void> load() async {
    if (_patientId == null) return;
    final requestVersion = ++_requestVersion;
    state = const InvoicesState(isInitialLoading: true);
    await _loadFirstPage(requestVersion);
  }

  Future<void> refresh() async {
    if (_patientId == null) return;
    final requestVersion = ++_requestVersion;
    state = state.copyWith(
      isInitialLoading: state.items.isEmpty,
      isRefreshing: state.items.isNotEmpty,
      isLoadingMore: false,
      clearError: true,
    );
    await _loadFirstPage(requestVersion);
  }

  Future<void> _loadFirstPage(int requestVersion) async {
    try {
      final page = await ref
          .read(invoicesRepositoryProvider)
          .list(limit: _pageSize);
      if (requestVersion != _requestVersion) return;
      state = InvoicesState(
        items: page.items,
        total: page.total,
        nextPage: page.page + 1,
        hasNextPage: page.hasNextPage,
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
          .read(invoicesRepositoryProvider)
          .list(page: state.nextPage, limit: _pageSize);
      if (requestVersion != _requestVersion) return;
      final byId = <String, PatientInvoice>{
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

  void dismissError() => state = state.copyWith(clearError: true);
}
