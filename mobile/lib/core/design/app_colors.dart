import 'package:flutter/material.dart';

/// Màu thương hiệu cố định, giống nhau ở chế độ sáng và tối: logo, nền "hero"
/// xanh đậm có chữ trắng và vài màu trang trí. Màu đổi theo chế độ sáng/tối nằm
/// ở [AppColors].
abstract final class AppPalette {
  static const brandBlue = Color(0xFF07549C);
  static const careBright = Color(0xFF0BAF9B);
  static const star = Color(0xFFE09B2D);

  /// Nền hero (gradient xanh đậm). Chữ trên nền này luôn là [onHero].
  static const heroDeep = Color(0xFF084E8F);
  static const heroMid = Color(0xFF0A6BC0);
  static const heroCare = Color(0xFF07766A);
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
    primary: Color(0xFF0A6BC0),
    onPrimary: Color(0xFFFFFFFF),
    primaryDark: Color(0xFF084E8F),
    primarySoft: Color(0xFFE4F2FF),
    care: Color(0xFF07766A),
    careSoft: Color(0xFFE0F4F1),
    ink: Color(0xFF0B1F3A),
    textSoft: Color(0xFF33495E),
    muted: Color(0xFF52697A),
    canvas: Color(0xFFF4F8FA),
    surface: Color(0xFFFFFFFF),
    surfaceMuted: Color(0xFFEAF1F5),
    border: Color(0xFFD3DFE7),
    divider: Color(0xFFE3EBF0),
    success: Color(0xFF1E7B34),
    successContainer: Color(0xFFE3F3E7),
    warning: Color(0xFF8A4B00),
    warningContainer: Color(0xFFFFF3DD),
    danger: Color(0xFFA32D2D),
    dangerContainer: Color(0xFFFBE9E9),
    info: Color(0xFF07549C),
    infoContainer: Color(0xFFE3EEF9),
    violet: Color(0xFF5B4A9E),
    violetContainer: Color(0xFFF0ECFA),
    shadowTint: Color(0x120B1F3A),
  );

  static const dark = AppColors(
    primary: Color(0xFF6DB6F5),
    onPrimary: Color(0xFF06263F),
    primaryDark: Color(0xFFA4D0F8),
    primarySoft: Color(0xFF173149),
    care: Color(0xFF53D3BE),
    careSoft: Color(0xFF123A38),
    ink: Color(0xFFE8F0F7),
    textSoft: Color(0xFFC8D6E2),
    muted: Color(0xFF9DB3C5),
    canvas: Color(0xFF0B1620),
    surface: Color(0xFF132230),
    surfaceMuted: Color(0xFF1A2D3E),
    border: Color(0xFF34495D),
    divider: Color(0xFF243A4D),
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
