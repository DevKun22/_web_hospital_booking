import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/core/config/app_brand.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';

/// Biểu tượng gọn của DevKunCare: dấu cộng trắng và bong bóng trò chuyện teal trên nền xanh.
///
/// Hình học khớp biểu tượng web (`favicon.svg`) và biểu tượng ứng dụng Android/iOS do
/// `tool/generate_brand_assets.mjs` sinh ra.
class AppBrandMark extends StatelessWidget {
  const AppBrandMark({super.key, this.size = 48});

  final double size;

  @override
  Widget build(BuildContext context) => Semantics(
    image: true,
    label: AppBrand.name,
    child: ExcludeSemantics(
      child: SizedBox.square(
        dimension: size,
        child: const CustomPaint(
          painter: _BrandMarkPainter(withBackground: true),
        ),
      ),
    ),
  );
}

/// Chỉ phần biểu tượng (không có nền), dùng cho màn hình khởi động trên nền xanh thương hiệu.
class AppBrandGlyph extends StatelessWidget {
  const AppBrandGlyph({super.key, this.size, this.crossScale = 1});

  final double? size;
  final double crossScale;

  @override
  Widget build(BuildContext context) {
    final glyph = CustomPaint(
      painter: _BrandMarkPainter(withBackground: false, crossScale: crossScale),
    );
    if (size == null) return glyph;
    return SizedBox.square(dimension: size, child: glyph);
  }
}

/// Vẽ theo hệ tọa độ 64x64 của biểu tượng web.
class _BrandMarkPainter extends CustomPainter {
  const _BrandMarkPainter({required this.withBackground, this.crossScale = 1});

  final bool withBackground;
  final double crossScale;

  // Tâm khối nội dung (dấu cộng và bong bóng) trong hệ 64x64.
  static const _contentCenter = Offset(37.5, 26.75);

  @override
  void paint(Canvas canvas, Size size) {
    final unit = size.width / 64;
    canvas.save();
    if (withBackground) {
      canvas
        ..scale(unit)
        ..drawRRect(
          RRect.fromRectAndRadius(
            const Rect.fromLTWH(0, 0, 64, 64),
            const Radius.circular(14),
          ),
          Paint()..color = AppPalette.brandBlue,
        );
    } else {
      // Không nền: phóng to khối nội dung và đặt vào giữa khung.
      canvas
        ..translate(size.width / 2, size.height / 2)
        ..scale(unit * 1.25)
        ..translate(-_contentCenter.dx, -_contentCenter.dy);
    }
    _paintContent(canvas);
    canvas.restore();
  }

  void _paintContent(Canvas canvas) {
    final white = Paint()..color = Colors.white;
    const radius = Radius.circular(2.4);

    canvas
      ..save()
      ..translate(32, 32)
      ..scale(crossScale)
      ..translate(-32, -32)
      ..drawRRect(
        RRect.fromRectAndRadius(const Rect.fromLTWH(27, 17, 10, 30), radius),
        white,
      )
      ..drawRRect(
        RRect.fromRectAndRadius(const Rect.fromLTWH(17, 27, 30, 10), radius),
        white,
      )
      ..restore();

    const bubble = Offset(47, 17);
    canvas
      ..drawCircle(bubble, 11.5, Paint()..color = AppPalette.brandBlue)
      ..drawCircle(bubble, 10, Paint()..color = AppPalette.careBright);
    for (final dx in const [43.6, 47.0, 50.4]) {
      canvas.drawCircle(Offset(dx, 17), 1.6, white);
    }
  }

  @override
  bool shouldRepaint(covariant _BrandMarkPainter oldDelegate) =>
      oldDelegate.crossScale != crossScale ||
      oldDelegate.withBackground != withBackground;
}
