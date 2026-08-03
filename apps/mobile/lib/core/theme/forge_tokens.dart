import 'package:flutter/material.dart';

/// Forge Narrative design tokens (synced with packages/design-system/tokens/forge-narrative.json)
/// Dark values match `theme-modes.css` `:root`/`.dark`; light values match `.light`.
abstract final class ForgeTokens {
  // --- Dark (default / parity with check-token-parity.js) ---
  static const background = Color(0xFF15121B);
  static const onBackground = Color(0xFFE7E0ED);
  static const surface = Color(0xFF15121B);
  static const surfaceDim = Color(0xFF15121B);
  static const surfaceContainerLowest = Color(0xFF0F0D15);
  static const surfaceContainerLow = Color(0xFF1D1A23);
  static const surfaceContainer = Color(0xFF211E27);
  static const surfaceContainerHigh = Color(0xFF2C2832);
  static const surfaceContainerHighest = Color(0xFF37333D);
  static const onSurface = Color(0xFFE7E0ED);
  static const onSurfaceVariant = Color(0xFFCBC3D7);
  static const outline = Color(0xFF958EA0);
  static const outlineVariant = Color(0xFF494454);
  static const primary = Color(0xFFD0BCFF);
  static const onPrimary = Color(0xFF3C0091);
  static const primaryContainer = Color(0xFFA078FF);
  static const onPrimaryContainer = Color(0xFF340080);
  static const secondary = Color(0xFF4CD7F6);
  static const onSecondary = Color(0xFF003640);
  static const secondaryContainer = Color(0xFF03B5D3);
  static const tertiary = Color(0xFFFFB869);
  static const error = Color(0xFFFFB4AB);
  static const errorContainer = Color(0xFF93000A);
  static const live = Color(0xFFFF453A);

  static const success = Color(0xFF3EE6A4);
  static const onSuccess = Color(0xFF003921);
  static const warning = Color(0xFFF2B33D);
  static const onWarning = Color(0xFF402D00);
  static const critical = Color(0xFFFF453A);
  static const onCritical = Color(0xFF3C0002);

  // --- Light (theme-modes.css `.light`) ---
  static const lightBackground = Color(0xFFFAF8FC);
  static const lightOnBackground = Color(0xFF1C1B1F);
  static const lightSurface = Color(0xFFFAF8FC);
  static const lightSurfaceDim = Color(0xFFF0EDF4);
  static const lightSurfaceContainerLowest = Color(0xFFFFFFFF);
  static const lightSurfaceContainerLow = Color(0xFFF4F1F7);
  static const lightSurfaceContainer = Color(0xFFEEEBF1);
  static const lightSurfaceContainerHigh = Color(0xFFE8E5EB);
  static const lightSurfaceContainerHighest = Color(0xFFE2DFE5);
  static const lightOnSurface = Color(0xFF1C1B1F);
  static const lightOnSurfaceVariant = Color(0xFF49454E);
  static const lightOutline = Color(0xFF7A757F);
  static const lightOutlineVariant = Color(0xFFCAC4CF);
  static const lightPrimary = Color(0xFF6750A4);
  static const lightOnPrimary = Color(0xFFFFFFFF);
  static const lightPrimaryContainer = Color(0xFFE9DDFF);
  static const lightOnPrimaryContainer = Color(0xFF22005D);
  static const lightSecondary = Color(0xFF00687A);
  static const lightOnSecondary = Color(0xFFFFFFFF);
  static const lightSecondaryContainer = Color(0xFFACECFF);
  static const lightTertiary = Color(0xFF8B5000);
  static const lightError = Color(0xFFBA1A1A);
  static const lightErrorContainer = Color(0xFFFFDAD6);
  static const lightLive = Color(0xFFC5221F);
  static const lightSuccess = Color(0xFF006D3F);
  static const lightOnSuccess = Color(0xFFFFFFFF);
  static const lightWarning = Color(0xFF7A5900);
  static const lightOnWarning = Color(0xFFFFFFFF);
  static const lightCritical = Color(0xFFC5221F);
  static const lightOnCritical = Color(0xFFFFFFFF);
}
