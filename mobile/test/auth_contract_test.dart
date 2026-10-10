import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/features/auth/domain/auth_session.dart';

void main() {
  test('AuthSession parses the Phase 1 token contract', () {
    final session = AuthSession.fromJson({
      'accessToken': 'access-token',
      'refreshToken': 'refresh-token',
      'user': {
        'id': 'patient-id',
        'fullName': 'Nguyễn Văn A',
        'phone': '0912345678',
        'isPhoneVerified': true,
      },
    });

    expect(session.isValid, isTrue);
    expect(session.user.id, 'patient-id');
    expect(session.user.isPhoneVerified, isTrue);
  });

  test('API errors retain backend code, requestId and field errors', () {
    final options = RequestOptions(path: '/auth/patient/request-otp');
    final exception = ApiException.fromDio(
      DioException(
        requestOptions: options,
        response: Response<dynamic>(
          requestOptions: options,
          statusCode: 400,
          data: {
            'success': false,
            'code': 'VALIDATION_ERROR',
            'message': 'Dữ liệu không hợp lệ',
            'requestId': 'request-123',
            'errors': [
              {'field': 'phone', 'message': 'Số điện thoại không hợp lệ'},
            ],
          },
        ),
      ),
    );

    expect(exception.kind, ApiErrorKind.validation);
    expect(exception.code, 'VALIDATION_ERROR');
    expect(exception.requestId, 'request-123');
    expect(exception.errors.single.field, 'phone');
  });

  test('HTTP 429 is mapped to the rate-limit error kind', () {
    final options = RequestOptions(path: '/auth/patient/request-otp');
    final exception = ApiException.fromDio(
      DioException(
        requestOptions: options,
        response: Response<dynamic>(
          requestOptions: options,
          statusCode: 429,
          data: const {
            'success': false,
            'code': 'RATE_LIMITED',
            'message': 'Vui lòng thử lại sau',
          },
        ),
      ),
    );

    expect(exception.kind, ApiErrorKind.rateLimited);
    expect(exception.code, 'RATE_LIMITED');
  });
}
