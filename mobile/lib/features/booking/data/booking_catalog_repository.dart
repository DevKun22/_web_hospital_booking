import 'package:dio/dio.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/network/api_contract.dart';
import 'package:hospital_booking_mobile/features/booking/domain/booking_catalog.dart';

class BookingCatalog {
  const BookingCatalog({required this.departments, required this.doctors});

  final List<BookingDepartment> departments;
  final List<BookingDoctor> doctors;
}

class BookingCatalogRepository {
  BookingCatalogRepository(this._dio);

  final Dio _dio;

  Future<BookingCatalog> fetchCatalog() async {
    try {
      final responses = await Future.wait<Response<dynamic>>([
        _dio.get<dynamic>('/departments'),
        _dio.get<dynamic>('/doctors'),
      ]);
      return BookingCatalog(
        departments: requireDataList(
          responses[0].data,
        ).map(BookingDepartment.fromJson).toList(growable: false),
        doctors: requireDataList(
          responses[1].data,
        ).map(BookingDoctor.fromJson).toList(growable: false),
      );
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<BookingDoctor> fetchDoctor(String doctorId) async {
    try {
      final response = await _dio.get<dynamic>('/doctors/$doctorId');
      return BookingDoctor.fromJson(requireDataMap(response.data));
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<List<BookingSlot>> fetchAvailableSlots({
    required String doctorId,
    required String date,
  }) async {
    try {
      final response = await _dio.get<dynamic>(
        '/doctors/$doctorId/available-slots',
        queryParameters: {'date': date},
      );
      return requireDataList(
        response.data,
      ).map(BookingSlot.fromJson).toList(growable: false);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }
}
