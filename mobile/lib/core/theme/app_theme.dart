import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:hospital_booking_mobile/core/config/app_brand.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/design/app_design_tokens.dart';

abstract final class AppTheme {
  static final ThemeData light = _build(AppColors.light, Brightness.light);
  static final ThemeData dark = _build(AppColors.dark, Brightness.dark);

  static ThemeData _build(AppColors c, Brightness brightness) {
    final seededScheme = ColorScheme.fromSeed(
      seedColor: AppPalette.heroMid,
      brightness: brightness,
      surface: c.surface,
    );
    final colorScheme = seededScheme.copyWith(
      primary: c.primary,
      onPrimary: c.onPrimary,
      primaryContainer: c.primarySoft,
      onPrimaryContainer: c.primaryDark,
      secondary: c.care,
      // Nền phụ của Material (nút chọn, thanh tiến độ, ô nhắc) dùng cùng xanh da trời với màu chính;
      // xanh ngọc chỉ dùng qua AppZone.care. Màu tertiary dành cho trạng thái cần chú ý (chưa thanh toán, nhãn phụ).
      secondaryContainer: c.primarySoft,
      onSecondaryContainer: c.primaryDark,
      tertiary: c.warning,
      tertiaryContainer: c.warningContainer,
      onTertiaryContainer: c.warning,
      surface: c.surface,
      onSurface: c.ink,
      onSurfaceVariant: c.muted,
      outline: c.border,
      outlineVariant: c.divider,
      error: c.danger,
      errorContainer: c.dangerContainer,
    );
    final isDark = brightness == Brightness.dark;

    // Chữ gọn và nhẹ cho phông Be Vietnam Pro (nét rộng hơn Roboto): thân 12 đến 15, tiêu đề 14 đến 20, chỉ dùng độ đậm 400, 500, 600.
    const textTheme = TextTheme(
      displaySmall: TextStyle(
        fontSize: 30,
        height: 1.15,
        fontWeight: AppFontWeight.strong,
        letterSpacing: -0.5,
      ),
      headlineMedium: TextStyle(
        fontSize: 24,
        height: 1.2,
        fontWeight: AppFontWeight.strong,
        letterSpacing: -0.3,
      ),
      headlineSmall: TextStyle(
        fontSize: 20,
        height: 1.25,
        fontWeight: AppFontWeight.strong,
        letterSpacing: -0.2,
      ),
      titleLarge: TextStyle(
        fontSize: 18,
        height: 1.3,
        fontWeight: AppFontWeight.strong,
      ),
      titleMedium: TextStyle(
        fontSize: 15,
        height: 1.3,
        fontWeight: AppFontWeight.strong,
      ),
      titleSmall: TextStyle(
        fontSize: 14,
        height: 1.3,
        fontWeight: AppFontWeight.strong,
      ),
      bodyLarge: TextStyle(fontSize: 15, height: 1.45),
      bodyMedium: TextStyle(fontSize: 13, height: 1.45),
      bodySmall: TextStyle(fontSize: 12, height: 1.4),
      labelLarge: TextStyle(fontSize: 13, fontWeight: AppFontWeight.medium),
      labelMedium: TextStyle(fontSize: 12, fontWeight: AppFontWeight.medium),
      labelSmall: TextStyle(fontSize: 11, fontWeight: AppFontWeight.medium),
    );

    return ThemeData(
      useMaterial3: true,
      fontFamily: AppBrand.fontFamily,
      pageTransitionsTheme: const PageTransitionsTheme(
        builders: {
          TargetPlatform.android: FadeForwardsPageTransitionsBuilder(),
        },
      ),
      colorScheme: colorScheme,
      extensions: [c],
      scaffoldBackgroundColor: c.canvas,
      visualDensity: VisualDensity.standard,
      materialTapTargetSize: MaterialTapTargetSize.padded,
      textTheme: textTheme.apply(bodyColor: c.ink, displayColor: c.ink),
      appBarTheme: AppBarTheme(
        centerTitle: false,
        backgroundColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
        foregroundColor: c.ink,
        elevation: 0,
        scrolledUnderElevation: 0,
        titleSpacing: AppSpacing.md,
        toolbarHeight: 64,
        titleTextStyle: TextStyle(
          color: c.ink,
          fontSize: 17,
          height: 1.2,
          fontWeight: AppFontWeight.strong,
        ),
        systemOverlayStyle: SystemUiOverlayStyle(
          statusBarColor: Colors.transparent,
          statusBarIconBrightness: isDark ? Brightness.light : Brightness.dark,
          statusBarBrightness: isDark ? Brightness.dark : Brightness.light,
          systemNavigationBarColor: c.canvas,
          systemNavigationBarIconBrightness: isDark
              ? Brightness.light
              : Brightness.dark,
          systemNavigationBarDividerColor: Colors.transparent,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: c.surfaceMuted,
        hintStyle: TextStyle(color: c.muted),
        prefixIconColor: c.muted,
        suffixIconColor: c.primary,
        constraints: const BoxConstraints(minHeight: AppSize.fieldHeight),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm,
        ),
        // Kiểu filled của Material 3: nhãn nổi nằm trong ô, không đè lên viền như kiểu outline.
        border: UnderlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.field),
          borderSide: BorderSide.none,
        ),
        enabledBorder: UnderlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.field),
          borderSide: BorderSide.none,
        ),
        disabledBorder: UnderlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.field),
          borderSide: BorderSide.none,
        ),
        focusedBorder: UnderlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.field),
          borderSide: BorderSide(color: c.primary, width: 2),
        ),
        errorBorder: UnderlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.field),
          borderSide: BorderSide(color: c.danger, width: 1.5),
        ),
        focusedErrorBorder: UnderlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.field),
          borderSide: BorderSide(color: c.danger, width: 2),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size(
            AppSize.minimumTouchTarget,
            AppSize.controlHeight,
          ),
          backgroundColor: c.primary,
          foregroundColor: c.onPrimary,
          disabledBackgroundColor: c.divider,
          disabledForegroundColor: c.muted,
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.md),
          ),
          textStyle: const TextStyle(
            fontSize: 13,
            fontWeight: AppFontWeight.strong,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(
            AppSize.minimumTouchTarget,
            AppSize.controlHeight,
          ),
          foregroundColor: c.primary,
          side: BorderSide(color: c.border),
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.md),
          ),
          textStyle: const TextStyle(
            fontSize: 13,
            fontWeight: AppFontWeight.strong,
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          minimumSize: const Size(
            AppSize.minimumTouchTarget,
            AppSize.minimumTouchTarget,
          ),
          foregroundColor: c.primary,
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
          textStyle: const TextStyle(
            fontSize: 13,
            fontWeight: AppFontWeight.strong,
          ),
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
        color: c.surface,
        surfaceTintColor: Colors.transparent,
        shadowColor: c.shadowTint,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.card),
          side: BorderSide(color: c.divider),
        ),
      ),
      segmentedButtonTheme: SegmentedButtonThemeData(
        style: ButtonStyle(
          backgroundColor: WidgetStateProperty.resolveWith(
            (states) => states.contains(WidgetState.selected)
                ? c.primarySoft
                : c.surface,
          ),
          foregroundColor: WidgetStateProperty.resolveWith(
            (states) =>
                states.contains(WidgetState.selected) ? c.primaryDark : c.muted,
          ),
          side: WidgetStatePropertyAll(BorderSide(color: c.border)),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: c.surface,
        selectedColor: c.primarySoft,
        side: BorderSide(color: c.border),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.pill),
        ),
        labelStyle: TextStyle(color: c.ink, fontWeight: AppFontWeight.medium),
        secondaryLabelStyle: TextStyle(
          color: c.primaryDark,
          fontWeight: AppFontWeight.strong,
        ),
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: c.surface,
        surfaceTintColor: Colors.transparent,
        indicatorColor: c.primarySoft,
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return TextStyle(
            color: selected ? c.primary : c.muted,
            fontWeight: selected ? AppFontWeight.strong : AppFontWeight.medium,
          );
        }),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: isDark ? c.surfaceMuted : c.ink,
        contentTextStyle: TextStyle(color: isDark ? c.ink : c.surface),
        insetPadding: const EdgeInsets.all(AppSpacing.md),
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(AppRadius.md)),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: c.surface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.xl),
        ),
      ),
      datePickerTheme: DatePickerThemeData(
        backgroundColor: c.surface,
        surfaceTintColor: Colors.transparent,
        headerBackgroundColor: c.primary,
        headerForegroundColor: c.onPrimary,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.xl),
        ),
        todayBorder: BorderSide(color: c.primary),
        todayForegroundColor: WidgetStatePropertyAll(c.primary),
        dayForegroundColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected)
              ? c.onPrimary
              : (states.contains(WidgetState.disabled) ? c.muted : c.ink),
        ),
        dayBackgroundColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected) ? c.primary : null,
        ),
        yearForegroundColor: WidgetStateProperty.resolveWith(
          (states) =>
              states.contains(WidgetState.selected) ? c.onPrimary : c.ink,
        ),
        yearBackgroundColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected) ? c.primary : null,
        ),
        cancelButtonStyle: TextButton.styleFrom(foregroundColor: c.primary),
        confirmButtonStyle: TextButton.styleFrom(foregroundColor: c.primary),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: c.surface,
        modalBackgroundColor: c.surface,
        surfaceTintColor: Colors.transparent,
        showDragHandle: true,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(
            top: Radius.circular(AppRadius.xl),
          ),
        ),
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(color: c.primary),
      listTileTheme: ListTileThemeData(
        iconColor: c.primary,
        textColor: c.ink,
        contentPadding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
        minTileHeight: AppSize.minimumTouchTarget,
      ),
      dividerColor: c.divider,
    );
  }
}
