import 'package:dio/dio.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/network/api_contract.dart';
import 'package:hospital_booking_mobile/features/invoices/domain/patient_payment.dart';

class PatientPaymentRepository {
  PatientPaymentRepository(this._dio);

  final Dio _dio;

  Future<PatientPaymentCapabilities> getCapabilities() async {
    try {
      final response = await _dio.get<dynamic>('/me/payment-capabilities');
      return PatientPaymentCapabilities.fromJson(requireDataMap(response.data));
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<PatientPaymentTransaction> create({
    required String invoiceId,
    required String provider,
    required String idempotencyKey,
  }) async {
    try {
      final response = await _dio.post<dynamic>(
        '/me/invoices/$invoiceId/payments',
        data: {'provider': provider},
        options: Options(headers: {'Idempotency-Key': idempotencyKey}),
      );
      return PatientPaymentTransaction.fromJson(
        requireDataMap(response.data),
      );
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<PatientPaymentTransaction> getById(String paymentId) async {
    try {
      final response = await _dio.get<dynamic>('/me/payments/$paymentId');
      return PatientPaymentTransaction.fromJson(
        requireDataMap(response.data),
      );
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }
}
