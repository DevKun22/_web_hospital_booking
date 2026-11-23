import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/features/invoices/application/invoice_payment_controller.dart';
import 'package:hospital_booking_mobile/features/invoices/application/patient_payment_controller.dart';
import 'package:hospital_booking_mobile/features/invoices/data/patient_payment_repository.dart';
import 'package:hospital_booking_mobile/features/invoices/domain/patient_payment.dart';

class _FakeRepository implements PatientPaymentRepository {
  _FakeRepository(this.status);

  PatientPaymentStatus status;
  int created = 0;

  PatientPaymentTransaction _tx() => PatientPaymentTransaction(
    id: 'pay-1',
    provider: 'VNPAY',
    status: status,
    amount: 250000,
    transactionCode: 'TX1',
    paymentUrl: 'https://sandbox.example/pay',
  );

  @override
  Future<PatientPaymentTransaction> create({
    required String invoiceId,
    required String provider,
    required String idempotencyKey,
  }) async {
    created += 1;
    return _tx();
  }

  @override
  Future<PatientPaymentTransaction> getById(String paymentId) async => _tx();

  @override
  Future<PatientPaymentCapabilities> getCapabilities() async =>
      const PatientPaymentCapabilities(providers: []);
}

class _MemoryStore implements PendingPaymentStore {
  final values = <String, String>{};

  @override
  Future<void> clear(String invoiceId) async => values.remove(invoiceId);

  @override
  Future<String?> read(String invoiceId) async => values[invoiceId];

  @override
  Future<void> write(String invoiceId, String paymentId) async =>
      values[invoiceId] = paymentId;
}

ProviderContainer _container(_FakeRepository repo, _MemoryStore store) {
  final container = ProviderContainer(
    overrides: [
      patientPaymentRepositoryProvider.overrideWithValue(repo),
      pendingPaymentStoreProvider.overrideWithValue(store),
      paymentUrlLauncherProvider.overrideWithValue((_) async => true),
    ],
  );
  addTearDown(container.dispose);
  return container;
}

void main() {
  test('tạo giao dịch, mở cổng và nhớ mã giao dịch đang chờ', () async {
    final repo = _FakeRepository(PatientPaymentStatus.pending);
    final store = _MemoryStore();
    final container = _container(repo, store);
    final sub = container.listen(invoicePaymentProvider('inv-1'), (_, _) {});
    addTearDown(sub.close);

    await container
        .read(invoicePaymentProvider('inv-1').notifier)
        .start('VNPAY');

    final state = container.read(invoicePaymentProvider('inv-1'));
    expect(state.isPending, isTrue);
    expect(state.transaction?.transactionCode, 'TX1');
    expect(store.values['inv-1'], 'pay-1');
    expect(repo.created, 1);
  });

  test('mở lại màn thấy giao dịch đang chờ đã lưu', () async {
    final repo = _FakeRepository(PatientPaymentStatus.pending);
    final store = _MemoryStore()..values['inv-2'] = 'pay-1';
    final container = _container(repo, store);
    final sub = container.listen(invoicePaymentProvider('inv-2'), (_, _) {});
    addTearDown(sub.close);

    await Future<void>.delayed(const Duration(milliseconds: 50));

    final state = container.read(invoicePaymentProvider('inv-2'));
    expect(state.isPending, isTrue);
    expect(store.values['inv-2'], 'pay-1');
  });

  test('giao dịch thất bại được quên để người dùng thanh toán lại', () async {
    final repo = _FakeRepository(PatientPaymentStatus.failed);
    final store = _MemoryStore()..values['inv-3'] = 'pay-1';
    final container = _container(repo, store);
    final sub = container.listen(invoicePaymentProvider('inv-3'), (_, _) {});
    addTearDown(sub.close);

    await Future<void>.delayed(const Duration(milliseconds: 50));

    final state = container.read(invoicePaymentProvider('inv-3'));
    expect(state.transaction?.status, PatientPaymentStatus.failed);
    expect(state.isPending, isFalse);
    expect(store.values.containsKey('inv-3'), isFalse);
  });
}
