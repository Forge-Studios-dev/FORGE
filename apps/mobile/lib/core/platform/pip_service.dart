import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// OS Picture-in-Picture bridge (`forge/pip` MethodChannel).
///
/// - Android: shrinks the Activity (no URL needed).
/// - iOS: starts a native `AVPlayer` + `AVPictureInPictureController` for the
///   given HLS URL (Flutter's texture player cannot drive system PiP).
class PipService {
  static const _channel = MethodChannel('forge/pip');

  static bool get _isMobileOs => !kIsWeb && (Platform.isAndroid || Platform.isIOS);

  static Future<bool> isSupported() async {
    if (!_isMobileOs) return false;
    try {
      final ok = await _channel.invokeMethod<bool>('isSupported');
      return ok == true;
    } catch (_) {
      return false;
    }
  }

  /// When true, leaving the app (Home / app switcher) auto-enters PiP.
  ///
  /// On iOS, [hlsUrl] + [positionMs] are required so a native AVPlayer can start.
  static Future<void> setAutoEnter(
    bool enabled, {
    String? hlsUrl,
    int? positionMs,
  }) async {
    if (!_isMobileOs) return;
    try {
      if (Platform.isIOS) {
        await _channel.invokeMethod<void>('setAutoEnter', {
          'enabled': enabled,
          'url': hlsUrl,
          'positionMs': positionMs ?? 0,
        });
      } else {
        await _channel.invokeMethod<void>('setAutoEnter', enabled);
      }
    } catch (_) {}
  }

  /// Enter OS PiP. On iOS, [hlsUrl] is required.
  static Future<bool> enter({String? hlsUrl, int? positionMs}) async {
    if (!_isMobileOs) return false;
    try {
      if (Platform.isIOS) {
        if (hlsUrl == null || hlsUrl.isEmpty) return false;
        final ok = await _channel.invokeMethod<bool>('enter', {
          'url': hlsUrl,
          'positionMs': positionMs ?? 0,
        });
        return ok == true;
      }
      final ok = await _channel.invokeMethod<bool>('enter');
      return ok == true;
    } catch (_) {
      return false;
    }
  }

  static Future<void> stop() async {
    if (!_isMobileOs) return;
    try {
      await _channel.invokeMethod<void>('stop');
    } catch (_) {}
  }
}
