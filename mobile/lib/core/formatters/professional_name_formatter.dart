String formatProfessionalName({String? title, required String fullName}) {
  final normalizedTitle = title?.trim() ?? '';
  final normalizedName = fullName.trim();
  if (normalizedTitle.isEmpty) return normalizedName;
  if (normalizedName.isEmpty) return normalizedTitle;

  final alreadyPrefixed =
      normalizedName.toLowerCase() == normalizedTitle.toLowerCase() ||
      normalizedName.toLowerCase().startsWith(
        '${normalizedTitle.toLowerCase()} ',
      );
  return alreadyPrefixed ? normalizedName : '$normalizedTitle $normalizedName';
}
