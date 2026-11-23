import 'package:flutter/material.dart';

/// Độ đậm chữ duy nhất của app (phông Be Vietnam Pro đóng gói đúng ba độ đậm này). Màn hình chỉ dùng tên, không gõ số.
abstract final class AppFontWeight {
  static const regular = FontWeight.w400;
  static const medium = FontWeight.w500;
  static const strong = FontWeight.w600;
}

abstract final class AppSpacing {
  static const double hair = 2;
  static const double xxs = 4;
  static const double xs = 8;
  static const double sm = 12;
  static const double md = 16;
  static const double lg = 20;
  static const double xl = 24;
  static const double xxl = 32;
  static const double xxxl = 48;
  static const double display = 64;

  /// Lề ngang của trang.
  static const double page = md;
}

abstract final class AppRadius {
  static const double xs = 6;
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
  static const double controlHeight = 48;

  /// Nút hành động chính (Lưu, Tiếp tục) và thanh lưu dính đáy.
  static const double primaryControlHeight = 52;

  /// Ô nhập, ô chọn và ô ngày dùng cùng một chiều cao tối thiểu trong cả app.
  static const double fieldHeight = 56;

  /// Dòng tùy chọn mở rộng và dòng công tắc trong form.
  static const double optionRowHeight = 52;

  /// Nhóm nút chọn liền nhau (giới tính, bộ lọc).
  static const double segmentHeight = 48;

  /// Chip chọn một trong vài giá trị (mối quan hệ).
  static const double chipHeight = 40;
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

  /// Công tắc các hiệu ứng nền lặp vô hạn (sóng, ô chờ nhấp nháy). Kiểm thử tắt nó để màn hình có thể 'yên' và pumpAndSettle kết thúc.
  static bool ambientEnabled = true;

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

/// Kích thước ô biểu tượng: cạnh ô và cỡ biểu tượng bên trong.
enum AppTileSize {
  sm(38, 20),
  md(44, 24),
  lg(52, 26),
  xl(64, 30);

  const AppTileSize(this.box, this.icon);

  final double box;
  final double icon;
}
