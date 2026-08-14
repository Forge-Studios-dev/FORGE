import 'package:flutter/material.dart';
import 'forge_tokens.dart';

/// Theme-aware palette registered on [ThemeData.extensions].
/// Prefer [ForgeTokens.of] in widgets instead of dark static consts.
@immutable
class ForgePalette extends ThemeExtension<ForgePalette> {
  const ForgePalette({
    required this.background,
    required this.onBackground,
    required this.surface,
    required this.surfaceDim,
    required this.surfaceContainerLowest,
    required this.surfaceContainerLow,
    required this.surfaceContainer,
    required this.surfaceContainerHigh,
    required this.surfaceContainerHighest,
    required this.onSurface,
    required this.onSurfaceVariant,
    required this.outline,
    required this.outlineVariant,
    required this.primary,
    required this.onPrimary,
    required this.primaryContainer,
    required this.onPrimaryContainer,
    required this.secondary,
    required this.onSecondary,
    required this.secondaryContainer,
    required this.tertiary,
    required this.error,
    required this.errorContainer,
    required this.live,
    required this.success,
    required this.onSuccess,
    required this.warning,
    required this.onWarning,
    required this.critical,
    required this.onCritical,
  });

  final Color background;
  final Color onBackground;
  final Color surface;
  final Color surfaceDim;
  final Color surfaceContainerLowest;
  final Color surfaceContainerLow;
  final Color surfaceContainer;
  final Color surfaceContainerHigh;
  final Color surfaceContainerHighest;
  final Color onSurface;
  final Color onSurfaceVariant;
  final Color outline;
  final Color outlineVariant;
  final Color primary;
  final Color onPrimary;
  final Color primaryContainer;
  final Color onPrimaryContainer;
  final Color secondary;
  final Color onSecondary;
  final Color secondaryContainer;
  final Color tertiary;
  final Color error;
  final Color errorContainer;
  final Color live;
  final Color success;
  final Color onSuccess;
  final Color warning;
  final Color onWarning;
  final Color critical;
  final Color onCritical;

  static const dark = ForgePalette(
    background: ForgeTokens.background,
    onBackground: ForgeTokens.onBackground,
    surface: ForgeTokens.surface,
    surfaceDim: ForgeTokens.surfaceDim,
    surfaceContainerLowest: ForgeTokens.surfaceContainerLowest,
    surfaceContainerLow: ForgeTokens.surfaceContainerLow,
    surfaceContainer: ForgeTokens.surfaceContainer,
    surfaceContainerHigh: ForgeTokens.surfaceContainerHigh,
    surfaceContainerHighest: ForgeTokens.surfaceContainerHighest,
    onSurface: ForgeTokens.onSurface,
    onSurfaceVariant: ForgeTokens.onSurfaceVariant,
    outline: ForgeTokens.outline,
    outlineVariant: ForgeTokens.outlineVariant,
    primary: ForgeTokens.primary,
    onPrimary: ForgeTokens.onPrimary,
    primaryContainer: ForgeTokens.primaryContainer,
    onPrimaryContainer: ForgeTokens.onPrimaryContainer,
    secondary: ForgeTokens.secondary,
    onSecondary: ForgeTokens.onSecondary,
    secondaryContainer: ForgeTokens.secondaryContainer,
    tertiary: ForgeTokens.tertiary,
    error: ForgeTokens.error,
    errorContainer: ForgeTokens.errorContainer,
    live: ForgeTokens.live,
    success: ForgeTokens.success,
    onSuccess: ForgeTokens.onSuccess,
    warning: ForgeTokens.warning,
    onWarning: ForgeTokens.onWarning,
    critical: ForgeTokens.critical,
    onCritical: ForgeTokens.onCritical,
  );

  static const light = ForgePalette(
    background: ForgeTokens.lightBackground,
    onBackground: ForgeTokens.lightOnBackground,
    surface: ForgeTokens.lightSurface,
    surfaceDim: ForgeTokens.lightSurfaceDim,
    surfaceContainerLowest: ForgeTokens.lightSurfaceContainerLowest,
    surfaceContainerLow: ForgeTokens.lightSurfaceContainerLow,
    surfaceContainer: ForgeTokens.lightSurfaceContainer,
    surfaceContainerHigh: ForgeTokens.lightSurfaceContainerHigh,
    surfaceContainerHighest: ForgeTokens.lightSurfaceContainerHighest,
    onSurface: ForgeTokens.lightOnSurface,
    onSurfaceVariant: ForgeTokens.lightOnSurfaceVariant,
    outline: ForgeTokens.lightOutline,
    outlineVariant: ForgeTokens.lightOutlineVariant,
    primary: ForgeTokens.lightPrimary,
    onPrimary: ForgeTokens.lightOnPrimary,
    primaryContainer: ForgeTokens.lightPrimaryContainer,
    onPrimaryContainer: ForgeTokens.lightOnPrimaryContainer,
    secondary: ForgeTokens.lightSecondary,
    onSecondary: ForgeTokens.lightOnSecondary,
    secondaryContainer: ForgeTokens.lightSecondaryContainer,
    tertiary: ForgeTokens.lightTertiary,
    error: ForgeTokens.lightError,
    errorContainer: ForgeTokens.lightErrorContainer,
    live: ForgeTokens.lightLive,
    success: ForgeTokens.lightSuccess,
    onSuccess: ForgeTokens.lightOnSuccess,
    warning: ForgeTokens.lightWarning,
    onWarning: ForgeTokens.lightOnWarning,
    critical: ForgeTokens.lightCritical,
    onCritical: ForgeTokens.lightOnCritical,
  );

  @override
  ForgePalette copyWith({
    Color? background,
    Color? onBackground,
    Color? surface,
    Color? surfaceDim,
    Color? surfaceContainerLowest,
    Color? surfaceContainerLow,
    Color? surfaceContainer,
    Color? surfaceContainerHigh,
    Color? surfaceContainerHighest,
    Color? onSurface,
    Color? onSurfaceVariant,
    Color? outline,
    Color? outlineVariant,
    Color? primary,
    Color? onPrimary,
    Color? primaryContainer,
    Color? onPrimaryContainer,
    Color? secondary,
    Color? onSecondary,
    Color? secondaryContainer,
    Color? tertiary,
    Color? error,
    Color? errorContainer,
    Color? live,
    Color? success,
    Color? onSuccess,
    Color? warning,
    Color? onWarning,
    Color? critical,
    Color? onCritical,
  }) {
    return ForgePalette(
      background: background ?? this.background,
      onBackground: onBackground ?? this.onBackground,
      surface: surface ?? this.surface,
      surfaceDim: surfaceDim ?? this.surfaceDim,
      surfaceContainerLowest: surfaceContainerLowest ?? this.surfaceContainerLowest,
      surfaceContainerLow: surfaceContainerLow ?? this.surfaceContainerLow,
      surfaceContainer: surfaceContainer ?? this.surfaceContainer,
      surfaceContainerHigh: surfaceContainerHigh ?? this.surfaceContainerHigh,
      surfaceContainerHighest: surfaceContainerHighest ?? this.surfaceContainerHighest,
      onSurface: onSurface ?? this.onSurface,
      onSurfaceVariant: onSurfaceVariant ?? this.onSurfaceVariant,
      outline: outline ?? this.outline,
      outlineVariant: outlineVariant ?? this.outlineVariant,
      primary: primary ?? this.primary,
      onPrimary: onPrimary ?? this.onPrimary,
      primaryContainer: primaryContainer ?? this.primaryContainer,
      onPrimaryContainer: onPrimaryContainer ?? this.onPrimaryContainer,
      secondary: secondary ?? this.secondary,
      onSecondary: onSecondary ?? this.onSecondary,
      secondaryContainer: secondaryContainer ?? this.secondaryContainer,
      tertiary: tertiary ?? this.tertiary,
      error: error ?? this.error,
      errorContainer: errorContainer ?? this.errorContainer,
      live: live ?? this.live,
      success: success ?? this.success,
      onSuccess: onSuccess ?? this.onSuccess,
      warning: warning ?? this.warning,
      onWarning: onWarning ?? this.onWarning,
      critical: critical ?? this.critical,
      onCritical: onCritical ?? this.onCritical,
    );
  }

  @override
  ForgePalette lerp(ThemeExtension<ForgePalette>? other, double t) {
    if (other is! ForgePalette) return this;
    return ForgePalette(
      background: Color.lerp(background, other.background, t)!,
      onBackground: Color.lerp(onBackground, other.onBackground, t)!,
      surface: Color.lerp(surface, other.surface, t)!,
      surfaceDim: Color.lerp(surfaceDim, other.surfaceDim, t)!,
      surfaceContainerLowest: Color.lerp(surfaceContainerLowest, other.surfaceContainerLowest, t)!,
      surfaceContainerLow: Color.lerp(surfaceContainerLow, other.surfaceContainerLow, t)!,
      surfaceContainer: Color.lerp(surfaceContainer, other.surfaceContainer, t)!,
      surfaceContainerHigh: Color.lerp(surfaceContainerHigh, other.surfaceContainerHigh, t)!,
      surfaceContainerHighest: Color.lerp(surfaceContainerHighest, other.surfaceContainerHighest, t)!,
      onSurface: Color.lerp(onSurface, other.onSurface, t)!,
      onSurfaceVariant: Color.lerp(onSurfaceVariant, other.onSurfaceVariant, t)!,
      outline: Color.lerp(outline, other.outline, t)!,
      outlineVariant: Color.lerp(outlineVariant, other.outlineVariant, t)!,
      primary: Color.lerp(primary, other.primary, t)!,
      onPrimary: Color.lerp(onPrimary, other.onPrimary, t)!,
      primaryContainer: Color.lerp(primaryContainer, other.primaryContainer, t)!,
      onPrimaryContainer: Color.lerp(onPrimaryContainer, other.onPrimaryContainer, t)!,
      secondary: Color.lerp(secondary, other.secondary, t)!,
      onSecondary: Color.lerp(onSecondary, other.onSecondary, t)!,
      secondaryContainer: Color.lerp(secondaryContainer, other.secondaryContainer, t)!,
      tertiary: Color.lerp(tertiary, other.tertiary, t)!,
      error: Color.lerp(error, other.error, t)!,
      errorContainer: Color.lerp(errorContainer, other.errorContainer, t)!,
      live: Color.lerp(live, other.live, t)!,
      success: Color.lerp(success, other.success, t)!,
      onSuccess: Color.lerp(onSuccess, other.onSuccess, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
      onWarning: Color.lerp(onWarning, other.onWarning, t)!,
      critical: Color.lerp(critical, other.critical, t)!,
      onCritical: Color.lerp(onCritical, other.onCritical, t)!,
    );
  }
}
