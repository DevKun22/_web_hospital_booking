import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// Giữ ranh giới phụ thuộc: core là hạ tầng dùng chung nên không được biết `features/`
/// hay `app/`; domain là Dart thuần nên không import Flutter, tầng data hay presentation.
void main() {
  List<MapEntry<String, String>> importsUnder(String dir) {
    final result = <MapEntry<String, String>>[];
    for (final entity in Directory(dir).listSync(recursive: true)) {
      if (entity is! File || !entity.path.endsWith('.dart')) continue;
      for (final line in entity.readAsLinesSync()) {
        if (line.startsWith('import ') || line.startsWith('export ')) {
          result.add(MapEntry(entity.path.replaceAll(r'\', '/'), line));
        }
      }
    }
    return result;
  }

  test('core does not depend on features or app', () {
    final violations = importsUnder('lib/core').where(
      (e) =>
          e.value.contains('hospital_booking_mobile/features/') ||
          e.value.contains('hospital_booking_mobile/app/'),
    );
    expect(violations.map((e) => '${e.key}: ${e.value}'), isEmpty);
  });

  test('feature domain layers stay plain Dart', () {
    final violations = importsUnder('lib/features')
        .where((e) => e.key.contains('/domain/'))
        .where(
          (e) =>
              e.value.contains('package:flutter/') ||
              e.value.contains('/presentation/') ||
              e.value.contains('/data/') ||
              e.value.contains('core/widgets/') ||
              e.value.contains('core/theme/'),
        );
    expect(violations.map((e) => '${e.key}: ${e.value}'), isEmpty);
  });
}
