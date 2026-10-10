import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/features/invoices/data/invoices_repository.dart';
import 'package:hospital_booking_mobile/features/invoices/domain/patient_invoice.dart';

Map<String, dynamic> _invoiceJson({String id = 'invoice-1'}) => {
  'id': id,
  'invoiceCode': 'INV-1001',
  'totalAmount': 500000,
  'bhytDiscount': 240000,
  'finalAmount': 260000,
  'insuranceEligibleAmount': 300000,
  'insuranceCoverageRate': 80,
  'insuranceDiscountAmount': 240000,
  'insuranceRouteType': 'RIGHT_ROUTE',
  'status': 'PAID',
  'paymentMethod': 'BANK_TRANSFER',
  'paidAt': '2030-01-02T10:00:00.000Z',
  'refundedAt': null,
  'createdAt': '2030-01-02T09:30:00.000Z',
  'appointment': {
    'id': 'appointment-1',
    'bookingCode': 'HB-1001',
    'appointmentDate': '2030-01-02T00:00:00.000Z',
    'startTime': '09:00:00',
    'endTime': '09:30:00',
    'doctor': {
      'id': 'doctor-1',
      'title': 'BS. CKI',
      'user': {'fullName': 'Trần Minh'},
    },
    'department': {
      'id': 'department-1',
      'name': 'Nội khoa',
      'slug': 'noi-khoa',
    },
    'package': null,
  },
};

void main() {
  test('uses patient invoice and structured insurance API contract', () async {
    final requests = <RequestOptions>[];
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test/api/v1'));
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          requests.add(options);
          final data = switch ((options.method, options.path)) {
            ('GET', '/me/invoices') => {
              'success': true,
              'data': [_invoiceJson()],
              'meta': {
                'page': 1,
                'limit': 20,
                'total': 1,
                'totalPages': 1,
                'hasNextPage': false,
              },
            },
            ('GET', '/me/invoices/invoice-1') => {
              'success': true,
              'data': _invoiceJson(),
            },
            _ => throw StateError(
              'Unexpected request ${options.method} ${options.path}',
            ),
          };
          handler.resolve(
            Response<dynamic>(
              requestOptions: options,
              statusCode: 200,
              data: data,
            ),
          );
        },
      ),
    );
    final repository = InvoicesRepository(dio);

    final page = await repository.list();
    final detail = await repository.getById('invoice-1');

    expect(page.total, 1);
    expect(page.hasNextPage, isFalse);
    expect(detail.status, PatientInvoiceStatus.paid);
    expect(detail.paymentMethod, PatientPaymentMethod.bankTransfer);
    expect(detail.insuranceRouteType, PatientInsuranceRoute.rightRoute);
    expect(detail.appliedInsuranceDiscount, 240000);
    expect(detail.finalAmount, 260000);
    expect(detail.hasInsuranceBenefit, isTrue);
    expect(detail.doctorName, 'BS. CKI Trần Minh');
    expect(detail.departmentName, 'Nội khoa');
    expect(requests.first.queryParameters, {'page': 1, 'limit': 20});

    dio.close(force: true);
  });
}
