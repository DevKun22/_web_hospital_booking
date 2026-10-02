import 'package:hospital_booking_mobile/core/errors/api_exception.dart';

Map<String, dynamic> requireDataMap(dynamic body) {
  if (body is! Map || body['success'] != true || body['data'] is! Map) {
    throw const ApiException(
      kind: ApiErrorKind.unknown,
      code: 'INVALID_API_CONTRACT',
      message: 'Phản hồi máy chủ không đúng định dạng.',
    );
  }
  return Map<String, dynamic>.from(body['data'] as Map);
}

List<Map<String, dynamic>> requireDataList(dynamic body) {
  if (body is! Map || body['success'] != true || body['data'] is! List) {
    throw const ApiException(
      kind: ApiErrorKind.unknown,
      code: 'INVALID_API_CONTRACT',
      message: 'Phản hồi máy chủ không đúng định dạng.',
    );
  }
  return (body['data'] as List)
      .whereType<Map>()
      .map((item) => Map<String, dynamic>.from(item))
      .toList(growable: false);
}
