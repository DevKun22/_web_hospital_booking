import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/core/config/app_brand.dart';

/// Giữ cho "đổi màu, phông, cỡ ở một nơi" luôn đúng: màn hình không được gõ thẳng màu, độ đậm, cỡ chữ,
/// khoảng cách, bo góc hay kiểu biểu tượng. Mọi giá trị đó nằm ở lib/core/design và lib/core/theme.
const _exemptDirs = ['lib/core/design/', 'lib/core/theme/'];

/// Ngoại lệ có lý do: hình vẽ thương hiệu (tọa độ hình học) và hai biểu tượng vốn chỉ có dạng nét.
const _exemptFiles = ['lib/core/widgets/app_brand_mark.dart'];
const _allowedIcons = {'info_outline', 'lock_outline', 'outgoing_mail'};

List<File> _sources() => Directory('lib')
    .listSync(recursive: true)
    .whereType<File>()
    .where((f) => f.path.endsWith('.dart'))
    .where((f) {
      final path = f.path.replaceAll(r'\', '/');
      return !_exemptDirs.any(path.startsWith) && !_exemptFiles.contains(path);
    })
    .toList();

void _expectNone(RegExp pattern, String rule, {bool Function(String)? ignore}) {
  final found = <String>[];
  for (final file in _sources()) {
    final lines = file.readAsLinesSync();
    for (var i = 0; i < lines.length; i += 1) {
      final line = lines[i];
      if (line.trimLeft().startsWith('//')) continue;
      for (final m in pattern.allMatches(line)) {
        if (ignore != null && ignore(m.group(0)!)) continue;
        found.add('${file.path}:${i + 1}: ${line.trim()}');
      }
    }
  }
  expect(found, isEmpty, reason: '$rule\n${found.take(12).join('\n')}');
}

void main() {
  test('không gõ thẳng màu', () {
    _expectNone(
      RegExp(r'Color\(0x|Colors\.(?!transparent)\w+'),
      'Dùng context.colors hoặc AppPalette thay cho màu gõ thẳng.',
    );
  });

  test('không gõ thẳng độ đậm hay cỡ chữ', () {
    _expectNone(
      RegExp(r'(?<!App)FontWeight\.|fontSize:|fontFamily:'),
      'Dùng AppFontWeight và TextTheme; phông khai báo ở AppBrand.',
    );
  });

  test('khoảng cách và bo góc dùng token', () {
    _expectNone(
      RegExp(r'BorderRadius\.circular\(\d'),
      'Dùng AppRadius.* thay cho số bo góc.',
    );
    _expectNone(
      RegExp(r'SizedBox\((?:width|height): (?:[1-9]|[1-3]\d|40)(?:\.\d+)?\)'),
      'Dùng AppSpacing.* thay cho số khoảng cách.',
    );
    _expectNone(
      RegExp(
        r'EdgeInsets\.\w+\([^()]*(?:horizontal|vertical|left|right|top|bottom): (?:[1-9]|[1-3]\d|40)\b',
      ),
      'Dùng AppSpacing.* trong EdgeInsets.',
    );
  });

  test('chỉ dùng một kiểu biểu tượng (viền)', () {
    _expectNone(
      RegExp(r'Icons\.([a-z0-9_]+)'),
      'Dùng biểu tượng kiểu *_outlined.',
      ignore: (match) {
        final name = match.substring('Icons.'.length);
        return name.endsWith('_outlined') || _allowedIcons.contains(name);
      },
    );
  });

  test('phông thương hiệu được đóng gói đủ ba độ đậm', () {
    final pubspec = File('pubspec.yaml').readAsStringSync();
    expect(pubspec, contains('family: ${AppBrand.fontFamily}'));
    for (final weight in ['Regular', 'Medium', 'SemiBold']) {
      final path = 'assets/fonts/${AppBrand.fontFamily}-$weight.ttf';
      expect(pubspec, contains(path));
      expect(File(path).existsSync(), isTrue, reason: path);
    }
  });
}
