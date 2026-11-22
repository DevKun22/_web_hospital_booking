const _withMarks =
    'àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ';
const _plain =
    'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd';

/// Chữ thường, bỏ dấu tiếng Việt để tìm "nhi" ra "Nhi" và "nhí".
String foldVietnamese(String value) {
  final lower = value.toLowerCase();
  final buffer = StringBuffer();
  for (final rune in lower.runes) {
    final char = String.fromCharCode(rune);
    final index = _withMarks.indexOf(char);
    buffer.write(index >= 0 ? _plain[index] : char);
  }
  return buffer.toString();
}

/// Mọi từ trong [query] (đã bỏ dấu) đều xuất hiện trong [haystack].
bool matchesSearch(String haystack, String query) {
  final terms = foldVietnamese(
    query,
  ).split(RegExp(r'\s+')).where((term) => term.isNotEmpty);
  if (terms.isEmpty) return true;
  final text = foldVietnamese(haystack);
  return terms.every(text.contains);
}
