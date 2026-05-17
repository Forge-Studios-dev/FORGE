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
        secondary: ForgeTokens.secondary,
        surface: ForgeTokens.surfaceContainerLow,
        onSurface: ForgeTokens.onSurface,
        error: ForgeTokens.error,
      ),
    );

    return base.copyWith(
      textTheme: GoogleFonts.interTextTheme(base.textTheme).apply(
        bodyColor: ForgeTokens.onSurface,
        displayColor: ForgeTokens.onSurface,
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: ForgeTokens.background,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: true,
        titleTextStyle: GoogleFonts.spaceGrotesk(
          color: ForgeTokens.onSurface,
          fontSize: 18,
          fontWeight: FontWeight.w600,
        ),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: ForgeTokens.surfaceContainerLow,
        selectedItemColor: ForgeTokens.primary,
        unselectedItemColor: ForgeTokens.outline,
        type: BottomNavigationBarType.fixed,
      ),
      cardTheme: CardThemeData(
        color: ForgeTokens.surfaceContainer,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: ForgeTokens.outlineVariant),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: ForgeTokens.surfaceContainerLow,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: ForgeTokens.outlineVariant),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: ForgeTokens.outlineVariant),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: ForgeTokens.primary, width: 2),
        ),
        labelStyle: const TextStyle(color: ForgeTokens.onSurfaceVariant),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: ForgeTokens.primaryContainer,
          foregroundColor: ForgeTokens.onPrimary,
          shape: const StadiumBorder(),
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 24),
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
        ),
      ),
    );
  }
}
