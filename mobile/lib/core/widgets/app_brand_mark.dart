import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/app/theme/app_theme.dart';

/// Medcare Booking's compact identity mark.
///
/// The shield communicates protected care while the cross keeps the mark
/// recognizable at launcher and notification-adjacent sizes. Its geometry is
/// mirrored in Android's adaptive icon and the generated iOS icon assets.
class AppBrandMark extends StatelessWidget {
  const AppBrandMark({super.key, this.size = 48});

  final double size;

  @override
  Widget build(BuildContext context) => Semantics(
    image: true,
    label: 'Medcare Booking',
    child: ExcludeSemantics(
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [AppTheme.primaryDark, Color(0xFF0BA398)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(size * 0.30),
        ),
        child: SizedBox.square(dimension: size, child: const AppBrandGlyph()),
      ),
    ),
  );
}

/// The foreground-only brand glyph used by the native-to-Flutter handoff.
///
/// Keeping this separate from [AppBrandMark] lets the first Flutter frame use
/// the same teal canvas and white shield as Android/iOS native launch screens.
class AppBrandGlyph extends StatelessWidget {
  const AppBrandGlyph({super.key, this.size, this.crossScale = 1});

  final double? size;
  final double crossScale;

  @override
  Widget build(BuildContext context) {
    final glyph = CustomPaint(
      painter: _MedcareMarkPainter(crossScale: crossScale),
    );
    if (size == null) return glyph;
    return SizedBox.square(dimension: size, child: glyph);
  }
}

class _MedcareMarkPainter extends CustomPainter {
  const _MedcareMarkPainter({this.crossScale = 1});

  final double crossScale;

  @override
  void paint(Canvas canvas, Size size) {
    final width = size.width;
    final height = size.height;
    final shield = Path()
      ..moveTo(width * 0.50, height * 0.18)
      ..cubicTo(
        width * 0.57,
        height * 0.23,
        width * 0.66,
        height * 0.26,
        width * 0.74,
        height * 0.28,
      )
      ..lineTo(width * 0.74, height * 0.50)
      ..cubicTo(
        width * 0.74,
        height * 0.64,
        width * 0.66,
        height * 0.75,
        width * 0.50,
        height * 0.83,
      )
      ..cubicTo(
        width * 0.34,
        height * 0.75,
        width * 0.26,
        height * 0.64,
        width * 0.26,
        height * 0.50,
      )
      ..lineTo(width * 0.26, height * 0.28)
      ..cubicTo(
        width * 0.34,
        height * 0.26,
        width * 0.43,
        height * 0.23,
        width * 0.50,
        height * 0.18,
      )
      ..close();

    canvas.drawPath(shield, Paint()..color = Colors.white);

    final crossPaint = Paint()..color = AppTheme.primary;
    final radius = Radius.circular(width * 0.025);
    canvas
      ..save()
      ..translate(width * 0.5, height * 0.505)
      ..scale(crossScale)
      ..translate(-width * 0.5, -height * 0.505)
      ..drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromLTRB(
            width * 0.455,
            height * 0.35,
            width * 0.545,
            height * 0.66,
          ),
          radius,
        ),
        crossPaint,
      )
      ..drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromLTRB(
            width * 0.345,
            height * 0.46,
            width * 0.655,
            height * 0.55,
          ),
          radius,
        ),
        crossPaint,
      )
      ..restore();
  }

  @override
  bool shouldRepaint(covariant _MedcareMarkPainter oldDelegate) =>
      oldDelegate.crossScale != crossScale;
}
