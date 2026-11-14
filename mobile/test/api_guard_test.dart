import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/network/api_guard.dart';

void main() {
  test('guardApi returns the value of a successful request', () async {
    expect(await guardApi(() async => 42), 42);
  });

  test('guardApi converts DioException into ApiException', () async {
    final options = RequestOptions(path: '/me/invoices');
    final failure = guardApi<void>(
      () async => throw DioException(
        requestOptions: options,
        response: Response<dynamic>(
          requestOptions: options,
          statusCode: 404,
          data: {
            'success': false,
            'message': 'Không tìm thấy hóa đơn',
            'code': 'NOT_FOUND',
          },
        ),
        type: DioExceptionType.badResponse,
      ),
    );

    await expectLater(failure, throwsA(isA<ApiException>()));
  });

  test('guardApi lets other errors through untouched', () async {
    await expectLater(
      guardApi<void>(() async => throw StateError('lỗi lập trình')),
      throwsA(isA<StateError>()),
    );
  });
}
