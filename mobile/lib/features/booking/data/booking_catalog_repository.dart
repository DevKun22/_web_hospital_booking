import 'package:dio/dio.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/network/api_contract.dart';
import 'package:hospital_booking_mobile/features/booking/domain/booking_catalog.dart';
import 'package:hospital_booking_mobile/features/packages/domain/medical_package.dart';

class BookingCatalog {
  const BookingCatalog({
    required this.departments,
    required this.doctors,
    this.packages = const [],
  });

  final List<BookingDepartment> departments;
  final List<BookingDoctor> doctors;
  final List<MedicalPackage> packages;
}

class BookingCatalogRepository {
  BookingCatalogRepository(this._dio);

  final Dio _dio;

  Future<BookingCatalog> fetchCatalog() async {
    try {
      final response = await _dio.get<dynamic>(
        '/public/bootstrap',
        queryParameters: {'view': 'catalog'},
      );
      final data = requireDataMap(response.data);
      return BookingCatalog(
        departments: _list(
          data,
          'departments',
        ).map(BookingDepartment.fromJson).toList(growable: false),
        doctors: _list(
          data,
          'doctors',
        ).map(BookingDoctor.fromJson).toList(growable: false),
        packages: _list(
          data,
          'packages',
        ).map(MedicalPackage.fromJson).toList(growable: false),
      );
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  List<Map<String, dynamic>> _list(Map<String, dynamic> data, String key) {
    final value = data[key];
    if (value is! List) {
      throw const ApiException(
        kind: ApiErrorKind.unknown,
        code: 'INVALID_API_CONTRACT',
        message: 'Phản hồi máy chủ không đúng định dạng.',
      );
    }

    return value
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList(growable: false);
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
