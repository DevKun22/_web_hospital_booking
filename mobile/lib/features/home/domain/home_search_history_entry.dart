class HomeSearchHistoryEntry {
  const HomeSearchHistoryEntry({
    required this.title,
    required this.subtitle,
    required this.location,
    required this.kind,
  });

  factory HomeSearchHistoryEntry.fromJson(Map<String, dynamic> json) {
    final kind = HomeSearchHistoryKind.values.where(
      (item) => item.name == json['kind'],
    );
    return HomeSearchHistoryEntry(
      title: json['title']?.toString().trim() ?? '',
      subtitle: json['subtitle']?.toString().trim() ?? '',
      location: json['location']?.toString().trim() ?? '',
      kind: kind.firstOrNull ?? HomeSearchHistoryKind.department,
    );
  }

  final String title;
  final String subtitle;
  final String location;
  final HomeSearchHistoryKind kind;

  bool get isValid =>
      title.isNotEmpty &&
      subtitle.isNotEmpty &&
      location.startsWith('/') &&
      !location.startsWith('//');

  Map<String, dynamic> toJson() => {
    'title': title,
    'subtitle': subtitle,
    'location': location,
    'kind': kind.name,
  };
}

enum HomeSearchHistoryKind { department, doctor, medicalPackage }
