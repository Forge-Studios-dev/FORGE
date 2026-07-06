import 'package:flutter/material.dart';

/// Forge Narrative design tokens (synced with packages/design-system/tokens/forge-narrative.json)
abstract final class ForgeTokens {
  static const background = Color(0xFF15121B);
  static const onBackground = Color(0xFFE7E0ED);
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
  static const secondary = Color(0xFF4CD7F6);
  static const tertiary = Color(0xFFFFB869);
  static const error = Color(0xFFFFB4AB);
  static const live = Color(0xFFFF453A);

  // Semantic status colors — separate from brand accent colors, mirroring
  // packages/design-system/tokens/forge-narrative.json (added on the
  // design-system-phase1 branch alongside the shared Card/DataTable/Toast
  // components) so mobile stays visually consistent with web/admin once
  // that work lands here too.
  static const success = Color(0xFF3EE6A4);
  static const onSuccess = Color(0xFF003921);
  static const warning = Color(0xFFF2B33D);
  static const onWarning = Color(0xFF402D00);
  static const critical = Color(0xFFFF453A);
  static const onCritical = Color(0xFF3C0002);
}
