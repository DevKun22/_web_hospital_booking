import 'package:dio/dio.dart';
import 'package:hospital_booking_mobile/core/network/api_contract.dart';
import 'package:hospital_booking_mobile/features/prescriptions/domain/patient_prescription.dart';

import 'package:hospital_booking_mobile/core/network/json_readers.dart';

import 'package:hospital_booking_mobile/core/network/api_guard.dart';

class PrescriptionsRepository {
  PrescriptionsRepository(this._dio);

  final Dio _dio;

  Future<PrescriptionPage> list({int page = 1, int limit = 20}) async {
    return guardApi(() async {
      final response = await _dio.get<dynamic>(
        '/me/prescriptions',
        queryParameters: {'page': page, 'limit': limit},
      );
      final items = requireDataList(
        response.data,
      ).map(PatientPrescription.fromJson).toList(growable: false);
      final body = response.data;
      final meta = body is Map
          ? jsonMap(body['meta'])
          : const <String, dynamic>{};
      return PrescriptionPage(
        items: items,
        page: jsonInt(meta['page'], fallback: page),
        total: jsonInt(meta['total'], fallback: items.length),
        hasNextPage: meta['hasNextPage'] == true,
      );
    });
  }

  Future<PatientPrescription> getById(String id) async {
    return guardApi(() async {
      final response = await _dio.get<dynamic>('/me/prescriptions/$id');
      return PatientPrescription.fromJson(requireDataMap(response.data));
    });
  }
}
