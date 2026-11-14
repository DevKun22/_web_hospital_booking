import 'package:dio/dio.dart';
import 'package:hospital_booking_mobile/core/network/api_contract.dart';
import 'package:hospital_booking_mobile/features/appointments/domain/patient_appointment.dart';

import 'package:hospital_booking_mobile/core/network/json_readers.dart';

import 'package:hospital_booking_mobile/core/network/api_guard.dart';

class AppointmentsRepository {
  AppointmentsRepository(this._dio);

  final Dio _dio;

  Future<AppointmentPage> list({int page = 1, int limit = 20}) async {
    return guardApi(() async {
      final response = await _dio.get<dynamic>(
        '/me/appointments',
        queryParameters: {'page': page, 'limit': limit},
      );
      final items = requireDataList(
        response.data,
      ).map(PatientAppointment.fromJson).toList(growable: false);
      final body = response.data;
      final meta = body is Map
          ? jsonMap(body['meta'])
          : const <String, dynamic>{};
      return AppointmentPage(
        items: items,
        page: jsonInt(meta['page'], fallback: page),
        total: jsonInt(meta['total'], fallback: items.length),
        hasNextPage: meta['hasNextPage'] == true,
      );
    });
  }

  Future<PatientAppointment> getById(String id) async {
    return guardApi(() async {
      final response = await _dio.get<dynamic>('/me/appointments/$id');
      return PatientAppointment.fromJson(requireDataMap(response.data));
    });
  }

  Future<PatientAppointment> cancel({
    required String id,
    required String reason,
  }) async {
    return guardApi(() async {
      final response = await _dio.post<dynamic>(
        '/me/appointments/$id/cancel',
        data: {'reason': reason.trim()},
      );
      return PatientAppointment.fromJson(requireDataMap(response.data));
    });
  }
}
