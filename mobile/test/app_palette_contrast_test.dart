import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';

double _contrast(Color a, Color b) {
  final la = a.computeLuminance();
  final lb = b.computeLuminance();
  return (math.max(la, lb) + 0.05) / (math.min(la, lb) + 0.05);
}

Map<String, (Color, Color)> _pairs(AppColors c) => {
  'onPrimary on primary': (c.onPrimary, c.primary),
  'primary on surface': (c.primary, c.surface),
  'primary on canvas': (c.primary, c.canvas),
  'primaryDark on primarySoft': (c.primaryDark, c.primarySoft),
  'ink on canvas': (c.ink, c.canvas),
  'ink on surface': (c.ink, c.surface),
  'ink on surfaceMuted': (c.ink, c.surfaceMuted),
  'textSoft on surface': (c.textSoft, c.surface),
  'muted on surface': (c.muted, c.surface),
  'muted on canvas': (c.muted, c.canvas),
  'muted on surfaceMuted': (c.muted, c.surfaceMuted),
  'care on surface': (c.care, c.surface),
  'care on careSoft': (c.care, c.careSoft),
  'success on successContainer': (c.success, c.successContainer),
  'warning on warningContainer': (c.warning, c.warningContainer),
  'danger on dangerContainer': (c.danger, c.dangerContainer),
  'danger on surface': (c.danger, c.surface),
  'info on infoContainer': (c.info, c.infoContainer),
  'violet on violetContainer': (c.violet, c.violetContainer),
};

void main() {
  for (final entry in {
    'sáng': AppColors.light,
    'tối': AppColors.dark,
  }.entries) {
    test('chế độ ${entry.key}: cặp chữ/nền đạt WCAG AA (4.5:1)', () {
      for (final pair in _pairs(entry.value).entries) {
        final ratio = _contrast(pair.value.$1, pair.value.$2);
        expect(
          ratio,
          greaterThanOrEqualTo(4.5),
          reason: '${pair.key}: ${ratio.toStringAsFixed(2)}:1',
        );
      }
    });

    test('chế độ ${entry.key}: mọi cặp ô phân loại đọc được', () {
      for (final pair in entry.value.tintPairs) {
        expect(
          _contrast(pair.foreground, pair.background),
          greaterThanOrEqualTo(4.5),
          reason: '${pair.foreground} on ${pair.background}',
        );
      }
    });
  }

  test('chữ trắng trên nền hero cố định đạt 4.5:1', () {
    const white = AppPalette.onHero;
    for (final fill in [
      AppPalette.heroDeep,
      AppPalette.heroMid,
      AppPalette.heroCare,
      AppPalette.brandBlue,
    ]) {
      expect(
        _contrast(white, fill),
        greaterThanOrEqualTo(4.5),
        reason: '$fill',
      );
    }
  });
}
