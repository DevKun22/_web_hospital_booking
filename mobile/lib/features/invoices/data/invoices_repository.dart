import 'package:dio/dio.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/network/api_contract.dart';
import 'package:hospital_booking_mobile/features/invoices/domain/patient_invoice.dart';

class InvoicesRepository {
  InvoicesRepository(this._dio);

  final Dio _dio;

  Future<InvoicePage> list({int page = 1, int limit = 20}) async {
    try {
      final response = await _dio.get<dynamic>(
        '/me/invoices',
        queryParameters: {'page': page, 'limit': limit},
      );
      final items = requireDataList(
        response.data,
      ).map(PatientInvoice.fromJson).toList(growable: false);
      final body = response.data;
      final meta = body is Map ? _map(body['meta']) : const <String, dynamic>{};
      return InvoicePage(
        items: items,
        page: _integer(meta['page'], fallback: page),
        total: _integer(meta['total'], fallback: items.length),
        hasNextPage: meta['hasNextPage'] == true,
      );
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<PatientInvoice> getById(String id) async {
    try {
      final response = await _dio.get<dynamic>('/me/invoices/$id');
      return PatientInvoice.fromJson(requireDataMap(response.data));
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }
}

Map<String, dynamic> _map(dynamic value) =>
    value is Map ? Map<String, dynamic>.from(value) : <String, dynamic>{};

int _integer(dynamic value, {required int fallback}) => value is num
    ? value.toInt()
    : int.tryParse(value?.toString() ?? '') ?? fallback;
