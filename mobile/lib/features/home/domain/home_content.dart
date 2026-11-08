import 'package:hospital_booking_mobile/core/network/json_readers.dart';
import 'package:hospital_booking_mobile/features/catalog/domain/catalog_entities.dart';

class HomeContent {
  const HomeContent({
    required this.banners,
    required this.departments,
    required this.doctors,
    required this.packages,
    required this.faqs,
    required this.siteSettings,
    required this.fetchedAt,
  });

  factory HomeContent.fromJson(Map<String, dynamic> json) => HomeContent(
    banners: decodeJsonList(json['banners'], HomeBanner.fromJson),
    departments: decodeJsonList(
      json['departments'],
      CatalogDepartment.fromJson,
    ),
    doctors: decodeJsonList(json['doctors'], CatalogDoctor.fromJson),
    packages: decodeJsonList(json['packages'], CatalogMedicalPackage.fromJson),
    faqs: decodeJsonList(json['faqs'], HomeFaq.fromJson),
    siteSettings: HomeSiteSettings.fromJson(jsonMap(json['siteSettings'])),
    fetchedAt:
        DateTime.tryParse(json['fetchedAt']?.toString() ?? '') ??
        DateTime.fromMillisecondsSinceEpoch(0),
  );

  final List<HomeBanner> banners;
  final List<CatalogDepartment> departments;
  final List<CatalogDoctor> doctors;
  final List<CatalogMedicalPackage> packages;
  final List<HomeFaq> faqs;
  final HomeSiteSettings siteSettings;
  final DateTime fetchedAt;

  Map<String, dynamic> toJson() => {
    'banners': banners.map((item) => item.toJson()).toList(),
    'departments': departments.map((item) => item.toJson()).toList(),
    'doctors': doctors.map((item) => item.toJson()).toList(),
    'packages': packages.map((item) => item.toJson()).toList(),
    'faqs': faqs.map((item) => item.toJson()).toList(),
    'siteSettings': siteSettings.toJson(),
    'fetchedAt': fetchedAt.toIso8601String(),
  };
}

class HomeBanner {
  const HomeBanner({
    required this.id,
    required this.title,
    this.subtitle,
    this.image,
    this.mobileImage,
    this.linkUrl,
  });

  factory HomeBanner.fromJson(Map<String, dynamic> json) => HomeBanner(
    id: jsonString(json['id']),
    title: jsonString(json['title']),
    subtitle: jsonNullableString(json['subtitle']),
    image: jsonNullableString(json['image']),
    mobileImage: jsonNullableString(json['mobileImage']),
    linkUrl: jsonNullableString(json['linkUrl']),
  );

  final String id;
  final String title;
  final String? subtitle;
  final String? image;
  final String? mobileImage;
  final String? linkUrl;

  String? get preferredImage => mobileImage ?? image;

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'subtitle': subtitle,
    'image': image,
    'mobileImage': mobileImage,
    'linkUrl': linkUrl,
  };
}

class HomeFaq {
  const HomeFaq({
    required this.id,
    required this.question,
    required this.answer,
  });

  factory HomeFaq.fromJson(Map<String, dynamic> json) => HomeFaq(
    id: jsonString(json['id']),
    question: jsonString(json['question']),
    answer: jsonString(json['answer']),
  );

  final String id;
  final String question;
  final String answer;

  Map<String, dynamic> toJson() => {
    'id': id,
    'question': question,
    'answer': answer,
  };
}

class HomeSiteSettings {
  const HomeSiteSettings({
    this.hospitalName,
    this.hotline,
    this.emergencyHotline,
    this.address,
    this.workingHours,
    this.mapUrl,
  });

  factory HomeSiteSettings.fromJson(Map<String, dynamic> json) =>
      HomeSiteSettings(
        hospitalName: jsonNullableString(json['hospitalName']),
        hotline: jsonNullableString(json['hotline']),
        emergencyHotline: jsonNullableString(json['emergencyHotline']),
        address: jsonNullableString(json['address']),
        workingHours: jsonNullableString(json['workingHours']),
        mapUrl: jsonNullableString(json['mapUrl']),
      );

  final String? hospitalName;
  final String? hotline;
  final String? emergencyHotline;
  final String? address;
  final String? workingHours;
  final String? mapUrl;

  Map<String, dynamic> toJson() => {
    'hospitalName': hospitalName,
    'hotline': hotline,
    'emergencyHotline': emergencyHotline,
    'address': address,
    'workingHours': workingHours,
    'mapUrl': mapUrl,
  };
}
