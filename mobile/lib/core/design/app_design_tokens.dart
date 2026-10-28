import 'package:flutter/material.dart';

/// Primitive brand and semantic colors.
///
/// Feature widgets should prefer [Theme.of] colors. These constants are for
/// theme construction and branded surfaces that intentionally remain stable.
abstract final class AppPalette {
  static const brand = Color(0xFF087A73);
  static const brandDark = Color(0xFF075B58);
  static const careMint = Color(0xFF2E9F82);
  static const warmSignal = Color(0xFFF2B66D);

  static const ink = Color(0xFF173033);
  static const mutedInk = Color(0xFF647B7E);
  static const canvas = Color(0xFFF7F9FC);
  static const surfaceMuted = Color(0xFFF0F5F7);
  static const border = Color(0xFFDCE8E5);
  static const divider = Color(0xFFE8F0EE);

  static const success = Color(0xFF237A57);
  static const successContainer = Color(0xFFE4F5EF);
  static const warning = Color(0xFFA4660D);
  static const warningContainer = Color(0xFFFFF3DD);
  static const danger = Color(0xFFB64048);
  static const dangerContainer = Color(0xFFFCEBED);
  static const info = Color(0xFF2B6F9E);
  static const infoContainer = Color(0xFFE9F3FA);
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
    BoxShadow(color: Color(0x12075B58), blurRadius: 18, offset: Offset(0, 6)),
  ];

  static const floating = <BoxShadow>[
    BoxShadow(color: Color(0x26075B58), blurRadius: 22, offset: Offset(0, 8)),
  ];
}
