String formatProfessionalName({String? title, required String fullName}) {
  final normalizedTitle = title?.trim() ?? '';
  final normalizedName = fullName.trim();
  if (normalizedTitle.isEmpty) return normalizeProfessionalName(normalizedName);
  if (normalizedName.isEmpty) return normalizedTitle;

  final nameWithoutTitle = _removeProfessionalPrefixes(normalizedName);
  return nameWithoutTitle.isEmpty
      ? normalizedTitle
      : '$normalizedTitle $nameWithoutTitle';
}

/// Keeps one professional title when an API field already contains one or
/// more title prefixes (for example `ThS.BS ThS.BS Nguyen Van A`).
String normalizeProfessionalName(String value) {
  final normalized = value.trim();
  if (normalized.isEmpty) return normalized;

  final firstPrefix = _professionalPrefix.firstMatch(normalized);
  if (firstPrefix == null) return normalized;
  final title = firstPrefix.group(0)!.trim();
  final nameWithoutTitle = _removeProfessionalPrefixes(
    normalized.substring(firstPrefix.end),
  );
  return nameWithoutTitle.isEmpty ? title : '$title $nameWithoutTitle';
}

String _removeProfessionalPrefixes(String value) {
  var result = value.trim();
  while (result.isNotEmpty) {
    final match = _professionalPrefix.firstMatch(result);
    if (match == null) break;
    result = result.substring(match.end).trimLeft();
  }
  return result;
}

final RegExp _professionalPrefix = RegExp(
  r'^(?:PGS\.?\s*TS\.?|GS\.?\s*TS\.?|ThS\.?\s*BS\.?|TS\.?\s*BS\.?|BS\.?\s*CK\s*(?:I{1,3}|[123])\.?|BSCK\s*(?:I{1,3}|[123])\.?|ThS\.?|TS\.?|BS\.?|Bac si|Bác sĩ)\s*',
  caseSensitive: false,
  unicode: true,
);
