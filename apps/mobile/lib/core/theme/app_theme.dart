import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'forge_tokens.dart';

class AppTheme {
  static ThemeData get dark {
    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: ForgeTokens.background,
      colorScheme: const ColorScheme.dark(
        primary: ForgeTokens.primary,
        onPrimary: ForgeTokens.onPrimary,
        primaryContainer: ForgeTokens.primaryContainer,
        onPrimaryContainer: ForgeTokens.onPrimaryContainer,
        secondary: ForgeTokens.secondary,
        onSecondary: ForgeTokens.onSecondary,
        secondaryContainer: ForgeTokens.secondaryContainer,
        tertiary: ForgeTokens.tertiary,
        surface: ForgeTokens.surfaceContainerLow,
        surfaceContainerLowest: ForgeTokens.surfaceContainerLowest,
        surfaceContainerLow: ForgeTokens.surfaceContainerLow,
        surfaceContainer: ForgeTokens.surfaceContainer,
        surfaceContainerHigh: ForgeTokens.surfaceContainerHigh,
        surfaceContainerHighest: ForgeTokens.surfaceContainerHighest,
        onSurface: ForgeTokens.onSurface,
        onSurfaceVariant: ForgeTokens.onSurfaceVariant,
        outline: ForgeTokens.outline,
        outlineVariant: ForgeTokens.outlineVariant,
        error: ForgeTokens.error,
        errorContainer: ForgeTokens.errorContainer,
      ),
    );

    return _withTypography(base, ForgeTokens.onSurface, ForgeTokens.background);
  }

  static ThemeData get light {
    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      scaffoldBackgroundColor: ForgeTokens.lightBackground,
      colorScheme: const ColorScheme.light(
        primary: ForgeTokens.lightPrimary,
        onPrimary: ForgeTokens.lightOnPrimary,
        primaryContainer: ForgeTokens.lightPrimaryContainer,
        onPrimaryContainer: ForgeTokens.lightOnPrimaryContainer,
        secondary: ForgeTokens.lightSecondary,
        onSecondary: ForgeTokens.lightOnSecondary,
        secondaryContainer: ForgeTokens.lightSecondaryContainer,
        tertiary: ForgeTokens.lightTertiary,
        surface: ForgeTokens.lightSurfaceContainerLow,
        surfaceContainerLowest: ForgeTokens.lightSurfaceContainerLowest,
        surfaceContainerLow: ForgeTokens.lightSurfaceContainerLow,
        surfaceContainer: ForgeTokens.lightSurfaceContainer,
        surfaceContainerHigh: ForgeTokens.lightSurfaceContainerHigh,
        surfaceContainerHighest: ForgeTokens.lightSurfaceContainerHighest,
        onSurface: ForgeTokens.lightOnSurface,
        onSurfaceVariant: ForgeTokens.lightOnSurfaceVariant,
        outline: ForgeTokens.lightOutline,
        outlineVariant: ForgeTokens.lightOutlineVariant,
        error: ForgeTokens.lightError,
        errorContainer: ForgeTokens.lightErrorContainer,
      ),
    );

    return _withTypography(
      base,
      ForgeTokens.lightOnSurface,
      ForgeTokens.lightBackground,
    );
  }

  static ThemeData _withTypography(ThemeData base, Color onSurface, Color scaffoldBg) {
    return base.copyWith(
      textTheme: GoogleFonts.interTextTheme(base.textTheme).apply(
        bodyColor: onSurface,
        displayColor: onSurface,
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: scaffoldBg,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: true,
        titleTextStyle: GoogleFonts.spaceGrotesk(
          color: onSurface,
          fontSize: 18,
          fontWeight: FontWeight.w600,
        ),
      ),
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: base.colorScheme.surfaceContainerLow,
        selectedItemColor: base.colorScheme.primary,
        unselectedItemColor: base.colorScheme.outline,
        type: BottomNavigationBarType.fixed,
      ),
      cardTheme: CardThemeData(
        color: base.colorScheme.surfaceContainer,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: base.colorScheme.outlineVariant),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: base.colorScheme.surfaceContainerLow,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: base.colorScheme.outlineVariant),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: base.colorScheme.outlineVariant),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: base.colorScheme.primary, width: 2),
        ),
        labelStyle: TextStyle(color: base.colorScheme.onSurfaceVariant),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: base.colorScheme.primaryContainer,
          foregroundColor: base.colorScheme.onPrimary,
          shape: const StadiumBorder(),
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 24),
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
        ),
      ),
    );
  }
}
