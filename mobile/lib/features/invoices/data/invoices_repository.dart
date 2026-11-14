import 'package:dio/dio.dart';
import 'package:hospital_booking_mobile/core/network/api_contract.dart';
import 'package:hospital_booking_mobile/features/invoices/domain/patient_invoice.dart';

import 'package:hospital_booking_mobile/core/network/json_readers.dart';

import 'package:hospital_booking_mobile/core/network/api_guard.dart';

class InvoicesRepository {
  InvoicesRepository(this._dio);

  final Dio _dio;

  Future<InvoicePage> list({int page = 1, int limit = 20}) async {
    return guardApi(() async {
      final response = await _dio.get<dynamic>(
        '/me/invoices',
        queryParameters: {'page': page, 'limit': limit},
      );
      final items = requireDataList(
        response.data,
      ).map(PatientInvoice.fromJson).toList(growable: false);
      final body = response.data;
      final meta = body is Map
          ? jsonMap(body['meta'])
          : const <String, dynamic>{};
      return InvoicePage(
        items: items,
        page: jsonInt(meta['page'], fallback: page),
        total: jsonInt(meta['total'], fallback: items.length),
        hasNextPage: meta['hasNextPage'] == true,
      );
    });
  }

  Future<PatientInvoice> getById(String id) async {
    return guardApi(() async {
      final response = await _dio.get<dynamic>('/me/invoices/$id');
      return PatientInvoice.fromJson(requireDataMap(response.data));
    });
  }
}
