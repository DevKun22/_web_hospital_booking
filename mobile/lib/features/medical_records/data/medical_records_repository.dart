import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/network/api_contract.dart';
import 'package:hospital_booking_mobile/features/medical_records/domain/patient_medical_record.dart';

import 'package:hospital_booking_mobile/core/network/json_readers.dart';

import 'package:hospital_booking_mobile/core/network/api_guard.dart';

class MedicalRecordsRepository {
  MedicalRecordsRepository(this._dio);

  final Dio _dio;

  Future<MedicalRecordPage> list({int page = 1, int limit = 20}) async {
    return guardApi(() async {
      final response = await _dio.get<dynamic>(
        '/me/medical-records',
        queryParameters: {'page': page, 'limit': limit},
      );
      final items = requireDataList(
        response.data,
      ).map(PatientMedicalRecord.fromJson).toList(growable: false);
      final body = response.data;
      final meta = body is Map
          ? jsonMap(body['meta'])
          : const <String, dynamic>{};
      return MedicalRecordPage(
        items: items,
        page: jsonInt(meta['page'], fallback: page),
        total: jsonInt(meta['total'], fallback: items.length),
        hasNextPage: meta['hasNextPage'] == true,
      );
    });
  }

  Future<PatientMedicalRecord> getById(String id) async {
    return guardApi(() async {
      final response = await _dio.get<dynamic>('/me/medical-records/$id');
      return PatientMedicalRecord.fromJson(requireDataMap(response.data));
    });
  }

  Future<MedicalDocument> getDocument(MedicalDocumentRequest request) async {
    final path = request.labResultId == null
        ? '/me/medical-records/${request.recordId}/file'
        : '/me/medical-records/${request.recordId}/lab-results/${request.labResultId}/file';
    return guardApi(() async {
      final response = await _dio.get<List<int>>(
        path,
        options: Options(responseType: ResponseType.bytes),
      );
      final bytes = Uint8List.fromList(response.data ?? const []);
      if (bytes.isEmpty) {
        throw const ApiException(
          kind: ApiErrorKind.unknown,
          code: 'EMPTY_MEDICAL_FILE',
          message: 'Tệp kết quả không có dữ liệu.',
        );
      }
      return MedicalDocument(
        bytes: bytes,
        contentType:
            response.headers.value(Headers.contentTypeHeader) ??
            'application/octet-stream',
        fileName: _fileName(response.headers.value('content-disposition')),
      );
    });
  }
}

String _fileName(String? contentDisposition) {
  final match = RegExp(
    'filename="?([^";]+)',
    caseSensitive: false,
  ).firstMatch(contentDisposition ?? '');
  return match?.group(1)?.trim() ?? 'ket-qua-kham';
}
