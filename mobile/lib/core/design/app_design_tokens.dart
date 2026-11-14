import 'package:flutter/material.dart';

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
