import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:hospital_booking_mobile/core/design/app_design_tokens.dart';

abstract final class AppTheme {
  static const primary = AppPalette.brand;
  static const primaryDark = AppPalette.brandDark;
  static const careMint = AppPalette.careMint;
  static const warmSignal = AppPalette.warmSignal;
  static const clinicalInk = AppPalette.ink;
  static const quietCanvas = AppPalette.canvas;
  static const softBorder = AppPalette.border;

  static ThemeData get light {
    final seededScheme = ColorScheme.fromSeed(
      seedColor: primary,
      brightness: Brightness.light,
      surface: Colors.white,
    );
    final colorScheme = seededScheme.copyWith(
      primary: primary,
      onPrimary: Colors.white,
      primaryContainer: const Color(0xFFDDF3EE),
      onPrimaryContainer: primaryDark,
      secondary: const Color(0xFF2B6F9E),
      secondaryContainer: const Color(0xFFE5F1FA),
      surface: Colors.white,
      onSurface: clinicalInk,
      onSurfaceVariant: AppPalette.mutedInk,
      outline: softBorder,
      outlineVariant: AppPalette.divider,
      error: AppPalette.danger,
    );

    const textTheme = TextTheme(
      displaySmall: TextStyle(
        fontSize: 36,
        height: 1.1,
        fontWeight: FontWeight.w800,
        letterSpacing: -0.8,
      ),
      headlineMedium: TextStyle(
        fontSize: 28,
        height: 1.15,
        fontWeight: FontWeight.w800,
        letterSpacing: -0.5,
      ),
      headlineSmall: TextStyle(
        fontSize: 24,
        height: 1.2,
        fontWeight: FontWeight.w800,
        letterSpacing: -0.35,
      ),
      titleLarge: TextStyle(
        fontSize: 20,
        height: 1.25,
        fontWeight: FontWeight.w800,
      ),
      titleMedium: TextStyle(
        fontSize: 17,
        height: 1.3,
        fontWeight: FontWeight.w700,
      ),
      titleSmall: TextStyle(
        fontSize: 15,
        height: 1.3,
        fontWeight: FontWeight.w700,
      ),
      bodyLarge: TextStyle(fontSize: 16, height: 1.45),
      bodyMedium: TextStyle(fontSize: 14, height: 1.45),
      bodySmall: TextStyle(fontSize: 12, height: 1.4),
      labelLarge: TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
      labelMedium: TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
      labelSmall: TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: quietCanvas,
      visualDensity: VisualDensity.standard,
      materialTapTargetSize: MaterialTapTargetSize.padded,
      textTheme: textTheme.apply(
        bodyColor: clinicalInk,
        displayColor: clinicalInk,
      ),
      appBarTheme: const AppBarTheme(
        centerTitle: false,
        backgroundColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
        foregroundColor: clinicalInk,
        elevation: 0,
        scrolledUnderElevation: 0,
        titleSpacing: AppSpacing.md,
        toolbarHeight: 64,
        titleTextStyle: TextStyle(
          color: clinicalInk,
          fontSize: 20,
          height: 1.2,
          fontWeight: FontWeight.w800,
        ),
        systemOverlayStyle: SystemUiOverlayStyle(
          statusBarColor: Colors.transparent,
          statusBarIconBrightness: Brightness.dark,
          statusBarBrightness: Brightness.light,
          systemNavigationBarColor: quietCanvas,
          systemNavigationBarIconBrightness: Brightness.dark,
          systemNavigationBarDividerColor: Colors.transparent,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppPalette.surfaceMuted,
        hintStyle: const TextStyle(color: AppPalette.mutedInk),
        prefixIconColor: AppPalette.mutedInk,
        suffixIconColor: primary,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.md,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.field),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.field),
          borderSide: const BorderSide(color: AppPalette.divider),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.field),
          borderSide: const BorderSide(color: primary, width: 1.6),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.field),
          borderSide: const BorderSide(color: AppPalette.danger),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.field),
          borderSide: const BorderSide(color: AppPalette.danger, width: 1.6),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size(
            AppSize.minimumTouchTarget,
            AppSize.controlHeight,
          ),
          backgroundColor: primary,
          foregroundColor: Colors.white,
          disabledBackgroundColor: AppPalette.divider,
          disabledForegroundColor: AppPalette.mutedInk,
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.md),
          ),
          textStyle: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(
            AppSize.minimumTouchTarget,
            AppSize.controlHeight,
          ),
          foregroundColor: primary,
          side: const BorderSide(color: softBorder),
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.md),
          ),
          textStyle: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          minimumSize: const Size(
            AppSize.minimumTouchTarget,
            AppSize.minimumTouchTarget,
          ),
          foregroundColor: primary,
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
          textStyle: const TextStyle(fontWeight: FontWeight.w700),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.sm),
          ),
        ),
      ),
      iconButtonTheme: IconButtonThemeData(
        style: IconButton.styleFrom(
          minimumSize: const Size.square(AppSize.minimumTouchTarget),
          tapTargetSize: MaterialTapTargetSize.padded,
        ),
      ),
      cardTheme: CardThemeData(
        margin: EdgeInsets.zero,
        elevation: 0,
        color: Colors.white,
        surfaceTintColor: Colors.transparent,
        shadowColor: const Color(0x12075B58),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.card),
          side: const BorderSide(color: AppPalette.divider),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: Colors.white,
        selectedColor: const Color(0xFFDDF3EE),
        side: const BorderSide(color: softBorder),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.pill),
        ),
        labelStyle: const TextStyle(
          color: clinicalInk,
          fontWeight: FontWeight.w600,
        ),
        secondaryLabelStyle: const TextStyle(
          color: primaryDark,
          fontWeight: FontWeight.w800,
        ),
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 7),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        indicatorColor: const Color(0xFFDDF3EE),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return TextStyle(
            color: selected ? primary : AppPalette.mutedInk,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
          );
        }),
      ),
      snackBarTheme: const SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: clinicalInk,
        contentTextStyle: TextStyle(color: Colors.white),
        insetPadding: EdgeInsets.all(AppSpacing.md),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(AppRadius.md)),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.xl),
        ),
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: Colors.white,
        modalBackgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        showDragHandle: true,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(
            top: Radius.circular(AppRadius.xl),
          ),
        ),
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(color: primary),
      listTileTheme: const ListTileThemeData(
        iconColor: primary,
        textColor: clinicalInk,
        contentPadding: EdgeInsets.symmetric(horizontal: AppSpacing.md),
        minTileHeight: AppSize.minimumTouchTarget,
      ),
      dividerColor: AppPalette.divider,
    );
  }
}
