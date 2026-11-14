import 'package:hospital_booking_mobile/core/network/json_readers.dart';

class MedicalPackageItem {
  const MedicalPackageItem({
    required this.id,
    required this.name,
    required this.price,
    required this.included,
    required this.order,
    this.description,
  });

  factory MedicalPackageItem.fromJson(Map<String, dynamic> json) =>
      MedicalPackageItem(
        id: json['id']?.toString() ?? '',
        name: json['name']?.toString() ?? '',
        description: jsonNullableString(json['description']),
        price: jsonNumber(json['price']),
        included: json['included'] == true,
        order: jsonInt(json['order']),
      );

  final String id;
  final String name;
  final String? description;
  final double price;
  final bool included;
  final int order;
}

class MedicalPackage {
  const MedicalPackage({
    required this.id,
    required this.name,
    required this.basePrice,
    required this.serviceFee,
    required this.includedItemsTotal,
    required this.finalPrice,
    required this.isPopular,
    required this.isBhytSupport,
    this.slug,
    this.description,
    this.summary,
    this.note,
    this.departmentId,
    this.departmentName,
    this.departmentSlug,
    this.items = const [],
  });

  factory MedicalPackage.fromJson(Map<String, dynamic> json) {
    final department = jsonMap(json['department']);
    final items = json['items'] is List
        ? (json['items'] as List)
              .whereType<Map>()
              .map(
                (item) => MedicalPackageItem.fromJson(
                  Map<String, dynamic>.from(item),
                ),
              )
              .toList(growable: false)
        : const <MedicalPackageItem>[];
    return MedicalPackage(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      slug: jsonNullableString(json['slug']),
      description: jsonNullableString(json['description']),
      summary: jsonNullableString(json['summary']),
      note: jsonNullableString(json['note']),
      departmentId: jsonNullableString(department['id']),
      departmentName: jsonNullableString(department['name']),
      departmentSlug: jsonNullableString(department['slug']),
      basePrice: jsonNumber(json['basePrice']),
      serviceFee: jsonNumber(json['serviceFee']),
      includedItemsTotal: jsonNumber(json['includedItemsTotal']),
      finalPrice: jsonNumber(json['finalPrice']),
      isPopular: json['isPopular'] == true,
      isBhytSupport: json['isBHYTSupport'] == true,
      items: items,
    );
  }

  final String id;
  final String name;
  final String? slug;
  final String? description;
  final String? summary;
  final String? note;
  final String? departmentId;
  final String? departmentName;
  final String? departmentSlug;
  final double basePrice;
  final double serviceFee;
  final double includedItemsTotal;
  final double finalPrice;
  final bool isPopular;
  final bool isBhytSupport;
  final List<MedicalPackageItem> items;
}
