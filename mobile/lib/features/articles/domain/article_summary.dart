import 'package:hospital_booking_mobile/core/network/json_readers.dart';

/// Bài viết kiến thức sức khỏe dạng tóm tắt, chỉ đủ để hiện thẻ trên Trang chủ. Đọc bài đầy đủ mở website của cơ sở.
class ArticleSummary {
  const ArticleSummary({
    required this.id,
    required this.slug,
    required this.title,
    this.coverImage,
    this.category,
    this.reviewerName,
    this.publishedAt,
  });

  factory ArticleSummary.fromJson(Map<String, dynamic> json) => ArticleSummary(
    id: jsonString(json['id']),
    slug: jsonString(json['slug']),
    title: jsonString(json['title']),
    coverImage: jsonNullableString(json['coverImage']),
    category: jsonNullableString(json['category']),
    reviewerName: jsonNullableString(json['reviewerName']),
    publishedAt: DateTime.tryParse(jsonString(json['publishedAt']))?.toLocal(),
  );

  final String id;
  final String slug;
  final String title;
  final String? coverImage;
  final String? category;
  final String? reviewerName;
  final DateTime? publishedAt;
}
