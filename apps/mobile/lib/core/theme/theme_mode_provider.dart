import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../cache/local_cache.dart';

const _themeModeCacheKey = 'forge-theme';

ThemeMode _parseThemeMode(String? raw) {
  if (raw == 'light') return ThemeMode.light;
  if (raw == 'dark') return ThemeMode.dark;
  return ThemeMode.system;
}

String _serializeThemeMode(ThemeMode mode) {
  switch (mode) {
    case ThemeMode.light:
      return 'light';
    case ThemeMode.dark:
      return 'dark';
    case ThemeMode.system:
      return 'system';
  }
}

class ThemeModeNotifier extends Notifier<ThemeMode> {
  @override
  ThemeMode build() {
    return _parseThemeMode(LocalCache.read(_themeModeCacheKey));
  }

  Future<void> setMode(ThemeMode mode) async {
    state = mode;
    await LocalCache.write(_themeModeCacheKey, _serializeThemeMode(mode));
  }

  Future<void> toggleLightDark(Brightness platformBrightness) async {
    final effective = state == ThemeMode.system
        ? platformBrightness
        : (state == ThemeMode.light ? Brightness.light : Brightness.dark);
    await setMode(effective == Brightness.dark ? ThemeMode.light : ThemeMode.dark);
  }
}

final themeModeProvider = NotifierProvider<ThemeModeNotifier, ThemeMode>(ThemeModeNotifier.new);
