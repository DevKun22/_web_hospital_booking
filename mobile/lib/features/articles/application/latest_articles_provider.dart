import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/errors/swallowed_error.dart';
import 'package:hospital_booking_mobile/core/providers/app_providers.dart';
import 'package:hospital_booking_mobile/features/articles/data/articles_repository.dart';
import 'package:hospital_booking_mobile/features/articles/domain/article_summary.dart';

final articlesRepositoryProvider = Provider<ArticlesRepository>(
  (ref) => ArticlesRepository(ref.watch(authDioProvider)),
);

/// Bài viết mới nhất cho Trang chủ. Lỗi mạng hoặc API thì trả danh sách rỗng: khối này ẩn đi, không làm hỏng Trang chủ.
final latestArticlesProvider = FutureProvider.autoDispose<List<ArticleSummary>>(
  (ref) async {
    try {
      return await ref.watch(articlesRepositoryProvider).fetchLatest();
    } catch (error) {
      logSwallowedError('latest_articles_provider', error);
      return const [];
    }
  },
);
