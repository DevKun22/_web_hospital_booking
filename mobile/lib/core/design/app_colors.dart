import 'package:flutter/material.dart';

/// Màu thương hiệu cố định, giống nhau ở chế độ sáng và tối: logo, nền "hero"
/// xanh đậm có chữ trắng và vài màu trang trí. Màu đổi theo chế độ sáng/tối nằm
/// ở [AppColors].
abstract final class AppPalette {
  static const brandBlue = Color(0xFF07549C);
  static const careBright = Color(0xFF0BAF9B);
  static const star = Color(0xFFE09B2D);

  /// Nền hero (gradient xanh đậm). Chữ trên nền này luôn là [onHero].
  static const heroDeep = Color(0xFF0C4A6E);
  static const heroMid = Color(0xFF075985);
  static const heroCare = Color(0xFF0369A1);
  static const onHero = Color(0xFFFFFFFF);
  static const onHeroMuted = Color(0xDFFFFFFF);
  static const onHeroSubtle = Color(0xBFFFFFFF);
  static const onHeroFaint = Color(0x1FFFFFFF);
}

/// Bảng màu theo chế độ sáng/tối, đăng ký vào `ThemeData.extensions`. Dùng qua
/// `context.colors`. Mọi cặp chữ/nền đạt tối thiểu 4,5:1 ở cả hai chế độ.
@immutable
class AppColors extends ThemeExtension<AppColors> {
  const AppColors({
    required this.primary,
    required this.onPrimary,
    required this.primaryDark,
    required this.primarySoft,
    required this.care,
    required this.careSoft,
    required this.ink,
    required this.textSoft,
    required this.muted,
    required this.canvas,
    required this.surface,
    required this.surfaceMuted,
    required this.border,
    required this.divider,
    required this.success,
    required this.successContainer,
    required this.warning,
    required this.warningContainer,
    required this.danger,
    required this.dangerContainer,
    required this.info,
    required this.infoContainer,
    required this.violet,
    required this.violetContainer,
    required this.shadowTint,
  });

  /// Màu nhấn chính: nền nút và màu chữ/biểu tượng nhấn. Chữ trên nó là [onPrimary].
  final Color primary;
  final Color onPrimary;
  final Color primaryDark;
  final Color primarySoft;
  final Color care;
  final Color careSoft;
  final Color ink;
  final Color textSoft;
  final Color muted;
  final Color canvas;

  /// Nền thẻ, hộp thoại, thanh điều hướng.
  final Color surface;
  final Color surfaceMuted;
  final Color border;
  final Color divider;
  final Color success;
  final Color successContainer;
  final Color warning;
  final Color warningContainer;
  final Color danger;
  final Color dangerContainer;
  final Color info;
  final Color infoContainer;
  final Color violet;
  final Color violetContainer;
  final Color shadowTint;

  static const light = AppColors(
    primary: Color(0xFF0369A1),
    onPrimary: Color(0xFFFFFFFF),
    primaryDark: Color(0xFF0C4A6E),
    primarySoft: Color(0xFFE0F2FE),
    care: Color(0xFF0F766E),
    careSoft: Color(0xFFE0F5F2),
    ink: Color(0xFF0F172A),
    textSoft: Color(0xFF334155),
    muted: Color(0xFF5B6B7F),
    canvas: Color(0xFFF8FAFC),
    surface: Color(0xFFFFFFFF),
    surfaceMuted: Color(0xFFF1F5F9),
    border: Color(0xFFE2E8F0),
    divider: Color(0xFFEEF2F6),
    success: Color(0xFF15803D),
    successContainer: Color(0xFFDCFCE7),
    warning: Color(0xFFB45309),
    warningContainer: Color(0xFFFEF3C7),
    danger: Color(0xFFB91C1C),
    dangerContainer: Color(0xFFFEE2E2),
    info: Color(0xFF07549C),
    infoContainer: Color(0xFFE3EEF9),
    violet: Color(0xFF5B4A9E),
    violetContainer: Color(0xFFF0ECFA),
    shadowTint: Color(0x120B1F3A),
  );

  static const dark = AppColors(
    primary: Color(0xFF38BDF8),
    onPrimary: Color(0xFF082F49),
    primaryDark: Color(0xFF7DD3FC),
    primarySoft: Color(0xFF0C2A40),
    care: Color(0xFF2DD4BF),
    careSoft: Color(0xFF0F3A36),
    ink: Color(0xFFF1F5F9),
    textSoft: Color(0xFFCBD5E1),
    muted: Color(0xFF94A3B8),
    canvas: Color(0xFF0B1120),
    surface: Color(0xFF1E293B),
    surfaceMuted: Color(0xFF273449),
    border: Color(0xFF334155),
    divider: Color(0xFF2A3749),
    success: Color(0xFF72D08A),
    successContainer: Color(0xFF16341F),
    warning: Color(0xFFF2B863),
    warningContainer: Color(0xFF3A2A10),
    danger: Color(0xFFFF9090),
    dangerContainer: Color(0xFF3D1B1B),
    info: Color(0xFF86BDF2),
    infoContainer: Color(0xFF16304A),
    violet: Color(0xFFBBAEF2),
    violetContainer: Color(0xFF2A2447),
    shadowTint: Color(0x66000000),
  );

  /// Cặp nền/chữ cho các ô phân loại (chuyên khoa, lối vào dịch vụ).
  List<({Color background, Color foreground})> get tintPairs => [
    (background: dangerContainer, foreground: danger),
    (background: primarySoft, foreground: primaryDark),
    (background: successContainer, foreground: success),
    (background: warningContainer, foreground: warning),
    (background: careSoft, foreground: care),
    (background: violetContainer, foreground: violet),
  ];

  @override
  AppColors copyWith() => this;

  @override
  AppColors lerp(ThemeExtension<AppColors>? other, double t) {
    if (other is! AppColors) return this;
    Color mix(Color a, Color b) => Color.lerp(a, b, t)!;
    return AppColors(
      primary: mix(primary, other.primary),
      onPrimary: mix(onPrimary, other.onPrimary),
      primaryDark: mix(primaryDark, other.primaryDark),
      primarySoft: mix(primarySoft, other.primarySoft),
      care: mix(care, other.care),
      careSoft: mix(careSoft, other.careSoft),
      ink: mix(ink, other.ink),
      textSoft: mix(textSoft, other.textSoft),
      muted: mix(muted, other.muted),
      canvas: mix(canvas, other.canvas),
      surface: mix(surface, other.surface),
      surfaceMuted: mix(surfaceMuted, other.surfaceMuted),
      border: mix(border, other.border),
      divider: mix(divider, other.divider),
      success: mix(success, other.success),
      successContainer: mix(successContainer, other.successContainer),
      warning: mix(warning, other.warning),
      warningContainer: mix(warningContainer, other.warningContainer),
      danger: mix(danger, other.danger),
      dangerContainer: mix(dangerContainer, other.dangerContainer),
      info: mix(info, other.info),
      infoContainer: mix(infoContainer, other.infoContainer),
      violet: mix(violet, other.violet),
      violetContainer: mix(violetContainer, other.violetContainer),
      shadowTint: mix(shadowTint, other.shadowTint),
    );
  }
}

extension AppColorsContext on BuildContext {
  AppColors get colors =>
      Theme.of(this).extension<AppColors>() ?? AppColors.light;
}
