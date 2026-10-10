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
        description: _nullableString(json['description']),
        price: _number(json['price']),
        included: json['included'] == true,
        order: _integer(json['order']),
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
    final department = _map(json['department']);
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
      slug: _nullableString(json['slug']),
      description: _nullableString(json['description']),
      summary: _nullableString(json['summary']),
      note: _nullableString(json['note']),
      departmentId: _nullableString(department['id']),
      departmentName: _nullableString(department['name']),
      departmentSlug: _nullableString(department['slug']),
      basePrice: _number(json['basePrice']),
      serviceFee: _number(json['serviceFee']),
      includedItemsTotal: _number(json['includedItemsTotal']),
      finalPrice: _number(json['finalPrice']),
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

Map<String, dynamic> _map(dynamic value) =>
    value is Map ? Map<String, dynamic>.from(value) : <String, dynamic>{};

String? _nullableString(dynamic value) {
  final result = value?.toString().trim();
  return result == null || result.isEmpty ? null : result;
}

double _number(dynamic value) => value is num
    ? value.toDouble()
    : double.tryParse(value?.toString() ?? '') ?? 0;

int _integer(dynamic value) =>
    value is num ? value.toInt() : int.tryParse(value?.toString() ?? '') ?? 0;
