import 'package:hospital_booking_mobile/core/formatters/professional_name_formatter.dart';
import 'package:hospital_booking_mobile/core/network/json_readers.dart';

class CatalogDepartment {
  const CatalogDepartment({
    required this.id,
    required this.name,
    this.slug,
    this.description,
    this.image,
    this.doctorCount = 0,
    this.packageCount = 0,
    this.availableSlotCount = 0,
  });

  factory CatalogDepartment.fromJson(Map<String, dynamic> json) =>
      CatalogDepartment(
        id: jsonString(json['id']),
        name: jsonString(json['name']),
        slug: jsonNullableString(json['slug']),
        description: jsonNullableString(json['description']),
        image: jsonNullableString(json['image']),
        doctorCount: jsonInt(json['doctorCount']),
        packageCount: jsonInt(json['packageCount']),
        availableSlotCount: jsonInt(json['availableSlotCount']),
      );

  final String id;
  final String name;
  final String? slug;
  final String? description;
  final String? image;

  /// Ba số dưới đây chỉ có ở danh mục `/departments/catalog`; nơi khác để 0.
  final int doctorCount;
  final int packageCount;
  final int availableSlotCount;

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'slug': slug,
    'description': description,
    'image': image,
  };
}

class CatalogDoctor {
  const CatalogDoctor({
    required this.id,
    required this.fullName,
    required this.departmentName,
    required this.consultationFee,
    this.departmentId = '',
    this.title,
    this.bio,
    this.specialization,
    this.avatar,
    this.experience,
    this.averageRating = 0,
    this.reviewCount = 0,
    this.todayAvailableSlots = const [],
  });

  factory CatalogDoctor.fromJson(Map<String, dynamic> json) {
    final user = jsonMap(json['user']);
    final department = jsonMap(json['department']);
    final reviewSummary = jsonMap(json['reviewSummary']);
    return CatalogDoctor(
      id: jsonString(json['id']),
      fullName: jsonString(user['fullName']),
      departmentId: jsonString(department['id']),
      departmentName: jsonString(department['name']),
      consultationFee: jsonNumber(json['consultationFee']),
      title: jsonNullableString(json['title']),
      bio: jsonNullableString(json['bio']),
      specialization: jsonNullableString(json['specialization']),
      avatar: jsonNullableString(user['avatar']),
      experience: jsonNullableInt(json['experience']),
      averageRating: jsonNumber(reviewSummary['averageRating']),
      reviewCount: jsonNullableInt(reviewSummary['count']) ?? 0,
      todayAvailableSlots: decodeJsonList(
        json['todayAvailableSlots'],
        CatalogDoctorSlot.fromJson,
      ),
    );
  }

  final String id;
  final String fullName;
  final String departmentId;
  final String departmentName;
  final double consultationFee;
  final String? title;
  final String? bio;
  final String? specialization;
  final String? avatar;
  final int? experience;
  final double averageRating;
  final int reviewCount;
  final List<CatalogDoctorSlot> todayAvailableSlots;

  String get displayName =>
      formatProfessionalName(title: title, fullName: fullName);

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'bio': bio,
    'specialization': specialization,
    'experience': experience,
    'consultationFee': consultationFee,
    'reviewSummary': {'averageRating': averageRating, 'count': reviewCount},
    'todayAvailableSlots': todayAvailableSlots
        .map((slot) => slot.toJson())
        .toList(growable: false),
    'user': {'fullName': fullName, 'avatar': avatar},
    'department': {'id': departmentId, 'name': departmentName},
  };
}

class CatalogDoctorSlot {
  const CatalogDoctorSlot({required this.startTime, required this.endTime});

  factory CatalogDoctorSlot.fromJson(Map<String, dynamic> json) =>
      CatalogDoctorSlot(
        startTime: jsonString(json['startTime']),
        endTime: jsonString(json['endTime']),
      );

  final String startTime;
  final String endTime;

  Map<String, dynamic> toJson() => {'startTime': startTime, 'endTime': endTime};
}

class CatalogMedicalPackage {
  const CatalogMedicalPackage({
    required this.id,
    required this.name,
    required this.finalPrice,
    required this.isPopular,
    required this.isBhytSupport,
    this.slug,
    this.summary,
    this.image,
  });

  factory CatalogMedicalPackage.fromJson(Map<String, dynamic> json) =>
      CatalogMedicalPackage(
        id: jsonString(json['id']),
        name: jsonString(json['name']),
        finalPrice: jsonNumber(json['finalPrice']),
        isPopular: json['isPopular'] == true,
        isBhytSupport: json['isBHYTSupport'] == true,
        slug: jsonNullableString(json['slug']),
        summary:
            jsonNullableString(json['summary']) ??
            jsonNullableString(json['description']),
        image: jsonNullableString(json['image']),
      );

  final String id;
  final String name;
  final String? slug;
  final String? summary;
  final String? image;
  final double finalPrice;
  final bool isPopular;
  final bool isBhytSupport;

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'slug': slug,
    'summary': summary,
    'image': image,
    'finalPrice': finalPrice,
    'isPopular': isPopular,
    'isBHYTSupport': isBhytSupport,
  };
}
