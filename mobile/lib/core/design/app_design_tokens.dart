import 'package:flutter/material.dart';

/// Bảng màu DevKunCare, khớp token của web (`.public-site`). Mọi cặp chữ/nền dùng trong ứng dụng
/// đạt tối thiểu 4,5:1; màu `careBright` chỉ để trang trí, không dùng cho chữ.
///
/// Widget nghiệp vụ nên ưu tiên `Theme.of(context).colorScheme`; hằng số ở đây dành cho dựng theme
/// và các bề mặt thương hiệu cố định.
abstract final class AppPalette {
  // Nhận diện: xanh biểu tượng, xanh thao tác chính, teal chăm sóc.
  static const brandBlue = Color(0xFF07549C);
  static const primary = Color(0xFF0A6BC0);
  static const primaryDark = Color(0xFF084E8F);
  static const primarySoft = Color(0xFFE4F2FF);
  static const care = Color(0xFF07766A);
  static const careSoft = Color(0xFFE0F4F1);
  static const careBright = Color(0xFF0BAF9B);

  // Chữ, nền, đường viền.
  static const ink = Color(0xFF0B1F3A);
  static const textSoft = Color(0xFF33495E);
  static const muted = Color(0xFF52697A);
  static const canvas = Color(0xFFF4F8FA);
  static const surfaceMuted = Color(0xFFEAF1F5);
  static const border = Color(0xFFD3DFE7);
  static const divider = Color(0xFFE3EBF0);

  // Trạng thái.
  static const success = Color(0xFF1E7B34);
  static const successContainer = Color(0xFFE3F3E7);
  static const warning = Color(0xFF8A4B00);
  static const warningContainer = Color(0xFFFFF3DD);
  static const danger = Color(0xFFA32D2D);
  static const dangerContainer = Color(0xFFFBE9E9);
  static const info = Color(0xFF07549C);
  static const infoContainer = Color(0xFFE3EEF9);
  static const violet = Color(0xFF5B4A9E);
  static const violetContainer = Color(0xFFF0ECFA);
  static const star = Color(0xFFE09B2D);

  /// Bóng đổ rất nhẹ của thẻ, lấy từ màu chữ chính.
  static const shadowTint = Color(0x120B1F3A);

  // Chữ trắng trên nền xanh đậm theo mức nhấn.
  static const onPrimary = Color(0xFFFFFFFF);
  static const onPrimaryMuted = Color(0xDFFFFFFF);
  static const onPrimarySubtle = Color(0xBFFFFFFF);
  static const onPrimaryFaint = Color(0x1FFFFFFF);

  /// Cặp nền/chữ cho các ô phân loại (chuyên khoa, lối vào dịch vụ).
  static const tintPairs = <({Color background, Color foreground})>[
    (background: dangerContainer, foreground: danger),
    (background: primarySoft, foreground: primaryDark),
    (background: successContainer, foreground: success),
    (background: warningContainer, foreground: warning),
    (background: careSoft, foreground: care),
    (background: violetContainer, foreground: violet),
  ];
}

abstract final class AppSpacing {
  static const double xxs = 4;
  static const double xs = 8;
  static const double sm = 12;
  static const double md = 16;
  static const double lg = 20;
  static const double xl = 24;
  static const double xxl = 32;
  static const double xxxl = 48;
  static const double display = 64;

  // Compatibility aliases used while existing screens migrate gradually.
  static const double page = md;
  static const double section = xl;
  static const double card = md;
  static const double compact = xs;
}

abstract final class AppRadius {
  static const double sm = 10;
  static const double md = 14;
  static const double lg = 18;
  static const double xl = 24;
  static const double pill = 999;

  static const double field = md;
  static const double card = lg;
  static const double hero = xl;
}

abstract final class AppSize {
  static const double minimumTouchTarget = 48;
  static const double controlHeight = 52;
  static const double primaryControlHeight = 56;
  static const double bottomNavigationHeight = 80;
}

abstract final class AppIconSize {
  static const double sm = 16;
  static const double md = 20;
  static const double lg = 24;
  static const double xl = 32;
}

abstract final class AppMotion {
  static const Duration fast = Duration(milliseconds: 160);
  static const Duration standard = Duration(milliseconds: 220);
  static const Duration deliberate = Duration(milliseconds: 350);
  static const Curve emphasized = Curves.easeOutCubic;

  static Duration responsive(BuildContext context, Duration duration) =>
      MediaQuery.disableAnimationsOf(context) ? Duration.zero : duration;
}

abstract final class AppShadow {
  static const soft = <BoxShadow>[
    BoxShadow(color: Color(0x0A0B1F3A), blurRadius: 3, offset: Offset(0, 1)),
    BoxShadow(color: Color(0x120B1F3A), blurRadius: 28, offset: Offset(0, 10)),
  ];

  static const floating = <BoxShadow>[
    BoxShadow(color: Color(0x260B1F3A), blurRadius: 30, offset: Offset(0, 12)),
  ];
}
