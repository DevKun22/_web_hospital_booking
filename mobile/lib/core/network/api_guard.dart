import 'package:dio/dio.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';

/// Chạy một lệnh gọi API và đổi mọi [DioException] thành [ApiException] có mã lỗi và
/// thông điệp thống nhất. Dùng thay cho khối `try/catch` lặp lại ở từng repository.
Future<T> guardApi<T>(Future<T> Function() request) async {
  try {
    return await request();
  } on DioException catch (error) {
    throw ApiException.fromDio(error);
  }
}
