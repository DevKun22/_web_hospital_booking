import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/features/invoices/data/patient_payment_repository.dart';
import 'package:hospital_booking_mobile/features/invoices/domain/patient_payment.dart';

Map<String, dynamic> _paymentJson({String status = 'PENDING'}) => {
  'id': 'payment-1',
  'provider': 'MOMO',
  'status': status,
  'amount': 260000,
  'transactionCode': 'PAY-1001',
  'paymentUrl': 'https://test-payment.momo.vn/pay/PAY-1001',
  'expiredAt': '2030-01-02T10:15:00.000Z',
};

void main() {
  test('uses patient payment API contract and sends idempotency key', () async {
    final requests = <RequestOptions>[];
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test/api/v1'));
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          requests.add(options);
          final data = switch ((options.method, options.path)) {
            ('GET', '/me/payment-capabilities') => {
              'success': true,
              'data': {
                'providers': [
                  {
                    'provider': 'MOCK',
                    'label': 'Thanh toán mô phỏng',
                    'isMock': true,
                  },
                  {'provider': 'MOMO', 'label': 'Ví MoMo', 'isMock': false},
                ],
              },
            },
            ('POST', '/me/invoices/invoice-1/payments') => {
              'success': true,
              'data': _paymentJson(),
            },
            ('GET', '/me/payments/payment-1') => {
              'success': true,
              'data': _paymentJson(status: 'SUCCESS'),
            },
            _ => throw StateError(
              'Unexpected request ${options.method} ${options.path}',
            ),
          };
          handler.resolve(
            Response<dynamic>(
              requestOptions: options,
              statusCode: options.method == 'POST' ? 201 : 200,
              data: data,
            ),
          );
        },
      ),
    );
    final repository = PatientPaymentRepository(dio);

    final capabilities = await repository.getCapabilities();
    final created = await repository.create(
      invoiceId: 'invoice-1',
      provider: 'MOMO',
      idempotencyKey: 'mobile:invoice-1:request-1',
    );
    final refreshed = await repository.getById(created.id);

    expect(capabilities.providers, hasLength(1));
    expect(capabilities.providers.single.code, 'MOMO');
    expect(created.status, PatientPaymentStatus.pending);
    expect(refreshed.status, PatientPaymentStatus.success);
    expect(
      requests[1].headers['Idempotency-Key'],
      'mobile:invoice-1:request-1',
    );
    expect(Map<String, dynamic>.from(requests[1].data as Map), {
      'provider': 'MOMO',
    });

    dio.close(force: true);
  });
}
