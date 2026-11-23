import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/errors/swallowed_error.dart';
import 'package:hospital_booking_mobile/features/invoices/application/invoices_controller.dart';
import 'package:hospital_booking_mobile/features/invoices/application/patient_payment_controller.dart';
import 'package:hospital_booking_mobile/features/invoices/domain/patient_payment.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:uuid/uuid.dart';

/// Lưu mã giao dịch đang chờ của từng hóa đơn để mở lại ứng dụng vẫn thấy kết quả.
abstract interface class PendingPaymentStore {
  Future<String?> read(String invoiceId);
  Future<void> write(String invoiceId, String paymentId);
  Future<void> clear(String invoiceId);
}

class SharedPendingPaymentStore implements PendingPaymentStore {
  SharedPendingPaymentStore({SharedPreferencesAsync? preferences})
    : _preferences = preferences ?? SharedPreferencesAsync();

  final SharedPreferencesAsync _preferences;

  String _key(String invoiceId) => 'pending_payment_v1_$invoiceId';

  @override
  Future<String?> read(String invoiceId) =>
      _preferences.getString(_key(invoiceId));

  @override
  Future<void> write(String invoiceId, String paymentId) =>
      _preferences.setString(_key(invoiceId), paymentId);

  @override
  Future<void> clear(String invoiceId) => _preferences.remove(_key(invoiceId));
}

final pendingPaymentStoreProvider = Provider<PendingPaymentStore>(
  (ref) => SharedPendingPaymentStore(),
);

/// Mở trang thanh toán của cổng; tách ra để kiểm thử không phải gọi nền tảng thật.
final paymentUrlLauncherProvider = Provider<Future<bool> Function(Uri)>(
  (ref) =>
      (uri) => launchUrl(uri, mode: LaunchMode.externalApplication),
);

class InvoicePaymentState {
  const InvoicePaymentState({
    this.transaction,
    this.isCreating = false,
    this.isRefreshing = false,
    this.errorMessage,
  });

  final PatientPaymentTransaction? transaction;
  final bool isCreating;
  final bool isRefreshing;
  final String? errorMessage;

  bool get isPending => transaction?.status == PatientPaymentStatus.pending;

  InvoicePaymentState copyWith({
    PatientPaymentTransaction? transaction,
    bool? isCreating,
    bool? isRefreshing,
    String? errorMessage,
    bool clearError = false,
  }) => InvoicePaymentState(
    transaction: transaction ?? this.transaction,
    isCreating: isCreating ?? this.isCreating,
    isRefreshing: isRefreshing ?? this.isRefreshing,
    errorMessage: clearError ? null : errorMessage ?? this.errorMessage,
  );
}

final invoicePaymentProvider = NotifierProvider.autoDispose
    .family<InvoicePaymentController, InvoicePaymentState, String>(
      InvoicePaymentController.new,
    );

/// Thanh toán trực tuyến của một hóa đơn: tạo giao dịch, mở cổng, hỏi kết quả định kỳ và khi app quay lại.
/// Giữ trạng thái ở đây (không ở widget) nên rời màn rồi quay lại vẫn thấy giao dịch đang chờ.
class InvoicePaymentController extends Notifier<InvoicePaymentState> {
  InvoicePaymentController(this.invoiceId);

  final String invoiceId;

  static const _pollInterval = Duration(seconds: 5);
  static const _maxWait = Duration(minutes: 15);

  Timer? _timer;
  DateTime? _pollStartedAt;

  @override
  InvoicePaymentState build() {
    ref.onDispose(() => _timer?.cancel());
    Future<void>.microtask(_resume);
    return const InvoicePaymentState();
  }

  Future<void> _resume() async {
    String? paymentId;
    try {
      paymentId = await ref.read(pendingPaymentStoreProvider).read(invoiceId);
    } catch (error) {
      logSwallowedError('invoice_payment_controller', error);
    }
    if (paymentId == null || state.transaction != null) return;
    try {
      final payment = await ref
          .read(patientPaymentControllerProvider)
          .refresh(paymentId);
      if (ref.mounted) _apply(payment);
    } on ApiException {
      // Không xác định được giao dịch cũ: coi như chưa có, người dùng có thể thanh toán lại.
      await _forget();
    }
  }

  /// Gọi khi ứng dụng quay lại từ trình duyệt hoặc khi người dùng bấm kiểm tra.
  Future<void> refresh() async {
    final current = state.transaction;
    if (current == null || state.isRefreshing) return;
    state = state.copyWith(isRefreshing: true);
    try {
      final payment = await ref
          .read(patientPaymentControllerProvider)
          .refresh(current.id);
      if (ref.mounted) _apply(payment);
    } on ApiException catch (error) {
      if (ref.mounted) state = state.copyWith(errorMessage: error.message);
    } finally {
      if (ref.mounted) state = state.copyWith(isRefreshing: false);
    }
  }

  Future<void> start(String provider) async {
    if (state.isCreating) return;
    _timer?.cancel();
    state = const InvoicePaymentState(isCreating: true);
    try {
      final payment = await ref
          .read(patientPaymentControllerProvider)
          .create(
            invoiceId: invoiceId,
            provider: provider,
            idempotencyKey: 'mobile:$invoiceId:${const Uuid().v4()}',
          );
      if (!ref.mounted) return;
      state = InvoicePaymentState(transaction: payment);
      await ref.read(pendingPaymentStoreProvider).write(invoiceId, payment.id);
      await _open(payment);
      if (ref.mounted) _startPolling();
    } on ApiException catch (error) {
      if (ref.mounted) state = InvoicePaymentState(errorMessage: error.message);
    } catch (error) {
      logSwallowedError('invoice_payment_controller', error);
      if (!ref.mounted) return;
      state = const InvoicePaymentState(
        errorMessage: 'Chưa thể bắt đầu thanh toán. Vui lòng thử lại sau.',
      );
    }
  }

  /// Mở lại trang thanh toán của giao dịch đang chờ (người dùng lỡ đóng trình duyệt).
  Future<void> reopen() async {
    final payment = state.transaction;
    if (payment == null || !state.isPending) return;
    try {
      await _open(payment);
      if (ref.mounted) _startPolling();
    } on ApiException catch (error) {
      if (ref.mounted) state = state.copyWith(errorMessage: error.message);
    }
  }

  Future<void> _open(PatientPaymentTransaction payment) async {
    final rawUrl = payment.paymentUrl;
    final uri = rawUrl == null ? null : Uri.tryParse(rawUrl);
    final opened =
        uri != null &&
        uri.scheme == 'https' &&
        await ref.read(paymentUrlLauncherProvider)(uri);
    if (!opened) {
      throw const ApiException(
        kind: ApiErrorKind.unknown,
        code: 'PAYMENT_URL_UNAVAILABLE',
        message: 'Không thể mở cổng thanh toán. Vui lòng thử lại.',
      );
    }
  }

  void _startPolling() {
    _timer?.cancel();
    if (!state.isPending) return;
    _pollStartedAt = DateTime.now();
    _timer = Timer.periodic(_pollInterval, (_) {
      final started = _pollStartedAt;
      if (started == null ||
          DateTime.now().difference(started) > _maxWait ||
          !state.isPending) {
        _timer?.cancel();
        return;
      }
      unawaited(refresh());
    });
  }

  void _apply(PatientPaymentTransaction payment) {
    state = state.copyWith(transaction: payment, clearError: true);
    if (payment.status == PatientPaymentStatus.pending) {
      if (_timer?.isActive != true) _startPolling();
      return;
    }
    _timer?.cancel();
    unawaited(_forget());
    if (payment.status == PatientPaymentStatus.success) {
      ref.invalidate(invoiceDetailProvider(invoiceId));
      unawaited(ref.read(invoicesControllerProvider.notifier).refresh());
    }
  }

  Future<void> _forget() async {
    try {
      await ref.read(pendingPaymentStoreProvider).clear(invoiceId);
    } catch (error) {
      logSwallowedError('invoice_payment_controller', error);
    }
  }
}
