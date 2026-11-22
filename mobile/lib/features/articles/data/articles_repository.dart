import 'package:dio/dio.dart';
import 'package:hospital_booking_mobile/core/network/api_contract.dart';
import 'package:hospital_booking_mobile/core/network/json_readers.dart';
import 'package:hospital_booking_mobile/features/articles/domain/article_summary.dart';

class ArticlesRepository {
  ArticlesRepository(this._dio);

  final Dio _dio;

  Future<List<ArticleSummary>> fetchLatest({int limit = 3}) async {
    final response = await _dio.get<dynamic>(
      '/articles',
      queryParameters: {'limit': limit},
    );
    final data = requireDataMap(response.data);
    return decodeJsonList(data['items'], ArticleSummary.fromJson)
        .where((item) => item.slug.isNotEmpty && item.title.isNotEmpty)
        .toList(growable: false);
  }
}
