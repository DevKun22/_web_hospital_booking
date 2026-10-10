import 'package:hospital_booking_mobile/core/formatters/professional_name_formatter.dart';

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
    banners: _decodeList(json['banners'], HomeBanner.fromJson),
    departments: _decodeList(json['departments'], HomeDepartment.fromJson),
    doctors: _decodeList(json['doctors'], HomeDoctor.fromJson),
    packages: _decodeList(json['packages'], HomeMedicalPackage.fromJson),
    faqs: _decodeList(json['faqs'], HomeFaq.fromJson),
    siteSettings: HomeSiteSettings.fromJson(_map(json['siteSettings'])),
    fetchedAt:
        DateTime.tryParse(json['fetchedAt']?.toString() ?? '') ??
        DateTime.fromMillisecondsSinceEpoch(0),
  );

  final List<HomeBanner> banners;
  final List<HomeDepartment> departments;
  final List<HomeDoctor> doctors;
  final List<HomeMedicalPackage> packages;
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
    id: _string(json['id']),
    title: _string(json['title']),
    subtitle: _nullableString(json['subtitle']),
    image: _nullableString(json['image']),
    mobileImage: _nullableString(json['mobileImage']),
    linkUrl: _nullableString(json['linkUrl']),
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

class HomeDepartment {
  const HomeDepartment({
    required this.id,
    required this.name,
    this.slug,
    this.image,
  });

  factory HomeDepartment.fromJson(Map<String, dynamic> json) => HomeDepartment(
    id: _string(json['id']),
    name: _string(json['name']),
    slug: _nullableString(json['slug']),
    image: _nullableString(json['image']),
  );

  final String id;
  final String name;
  final String? slug;
  final String? image;

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'slug': slug,
    'image': image,
  };
}

class HomeDoctor {
  const HomeDoctor({
    required this.id,
    required this.fullName,
    required this.departmentName,
    required this.consultationFee,
    this.title,
    this.specialization,
    this.avatar,
    this.experience,
  });

  factory HomeDoctor.fromJson(Map<String, dynamic> json) {
    final user = _map(json['user']);
    final department = _map(json['department']);
    return HomeDoctor(
      id: _string(json['id']),
      fullName: _string(user['fullName']),
      departmentName: _string(department['name']),
      consultationFee: _number(json['consultationFee']),
      title: _nullableString(json['title']),
      specialization: _nullableString(json['specialization']),
      avatar: _nullableString(user['avatar']),
      experience: _nullableInt(json['experience']),
    );
  }

  final String id;
  final String fullName;
  final String departmentName;
  final double consultationFee;
  final String? title;
  final String? specialization;
  final String? avatar;
  final int? experience;

  String get displayName =>
      formatProfessionalName(title: title, fullName: fullName);

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'specialization': specialization,
    'experience': experience,
    'consultationFee': consultationFee,
    'user': {'fullName': fullName, 'avatar': avatar},
    'department': {'name': departmentName},
  };
}

class HomeMedicalPackage {
  const HomeMedicalPackage({
    required this.id,
    required this.name,
    required this.finalPrice,
    required this.isPopular,
    required this.isBhytSupport,
    this.slug,
    this.summary,
  });

  factory HomeMedicalPackage.fromJson(Map<String, dynamic> json) =>
      HomeMedicalPackage(
        id: _string(json['id']),
        name: _string(json['name']),
        finalPrice: _number(json['finalPrice']),
        isPopular: json['isPopular'] == true,
        isBhytSupport: json['isBHYTSupport'] == true,
        slug: _nullableString(json['slug']),
        summary:
            _nullableString(json['summary']) ??
            _nullableString(json['description']),
      );

  final String id;
  final String name;
  final String? slug;
  final String? summary;
  final double finalPrice;
  final bool isPopular;
  final bool isBhytSupport;

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'slug': slug,
    'summary': summary,
    'finalPrice': finalPrice,
    'isPopular': isPopular,
    'isBHYTSupport': isBhytSupport,
  };
}

class HomeFaq {
  const HomeFaq({
    required this.id,
    required this.question,
    required this.answer,
  });

  factory HomeFaq.fromJson(Map<String, dynamic> json) => HomeFaq(
    id: _string(json['id']),
    question: _string(json['question']),
    answer: _string(json['answer']),
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
  });

  factory HomeSiteSettings.fromJson(Map<String, dynamic> json) =>
      HomeSiteSettings(
        hospitalName: _nullableString(json['hospitalName']),
        hotline: _nullableString(json['hotline']),
        emergencyHotline: _nullableString(json['emergencyHotline']),
      );

  final String? hospitalName;
  final String? hotline;
  final String? emergencyHotline;

  Map<String, dynamic> toJson() => {
    'hospitalName': hospitalName,
    'hotline': hotline,
    'emergencyHotline': emergencyHotline,
  };
}

List<T> _decodeList<T>(
  dynamic value,
  T Function(Map<String, dynamic>) decode,
) => value is List
    ? value.whereType<Map>().map((item) => decode(_map(item))).toList()
    : const [];

Map<String, dynamic> _map(dynamic value) =>
    value is Map ? Map<String, dynamic>.from(value) : <String, dynamic>{};

String _string(dynamic value) => value?.toString() ?? '';

String? _nullableString(dynamic value) {
  final result = value?.toString().trim();
  return result == null || result.isEmpty ? null : result;
}

double _number(dynamic value) => value is num
    ? value.toDouble()
    : double.tryParse(value?.toString() ?? '') ?? 0;

int? _nullableInt(dynamic value) =>
    value is num ? value.toInt() : int.tryParse(value?.toString() ?? '');
