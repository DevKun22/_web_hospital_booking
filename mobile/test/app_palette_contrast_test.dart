import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/core/design/app_design_tokens.dart';

double _contrast(Color a, Color b) {
  final la = a.computeLuminance();
  final lb = b.computeLuminance();
  return (math.max(la, lb) + 0.05) / (math.min(la, lb) + 0.05);
}

void main() {
  const white = Color(0xFFFFFFFF);

  test('text and fill pairs meet WCAG AA (4.5:1)', () {
    final pairs = <String, (Color, Color)>{
      'onPrimary on primary': (white, AppPalette.primary),
      'white on primaryDark': (white, AppPalette.primaryDark),
      'white on brandBlue': (white, AppPalette.brandBlue),
      'primary on white': (AppPalette.primary, white),
      'primaryDark on primarySoft': (
        AppPalette.primaryDark,
        AppPalette.primarySoft,
      ),
      'ink on canvas': (AppPalette.ink, AppPalette.canvas),
      'textSoft on white': (AppPalette.textSoft, white),
      'muted on white': (AppPalette.muted, white),
      'muted on canvas': (AppPalette.muted, AppPalette.canvas),
      'care on white': (AppPalette.care, white),
      'success on successContainer': (
        AppPalette.success,
        AppPalette.successContainer,
      ),
      'warning on warningContainer': (
        AppPalette.warning,
        AppPalette.warningContainer,
      ),
      'danger on dangerContainer': (
        AppPalette.danger,
        AppPalette.dangerContainer,
      ),
      'info on infoContainer': (AppPalette.info, AppPalette.infoContainer),
      'violet on violetContainer': (
        AppPalette.violet,
        AppPalette.violetContainer,
      ),
      'care on careSoft': (AppPalette.care, AppPalette.careSoft),
    };

    for (final entry in pairs.entries) {
      final ratio = _contrast(entry.value.$1, entry.value.$2);
      expect(
        ratio,
        greaterThanOrEqualTo(4.5),
        reason: '${entry.key}: ${ratio.toStringAsFixed(2)}:1',
      );
    }
  });

  test('every category tint pair is readable', () {
    for (final pair in AppPalette.tintPairs) {
      expect(
        _contrast(pair.foreground, pair.background),
        greaterThanOrEqualTo(4.5),
        reason: '${pair.foreground} on ${pair.background}',
      );
    }
  });
}
