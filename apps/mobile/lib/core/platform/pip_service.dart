import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// Android OS Picture-in-Picture bridge (`forge/pip` MethodChannel).
/// iOS remains floating-miniplayer-only until AVPlayer PiP is wired.
class PipService {
  static const _channel = MethodChannel('forge/pip');

  static Future<bool> isSupported() async {
    if (kIsWeb || !Platform.isAndroid) return false;
    try {
      final ok = await _channel.invokeMethod<bool>('isSupported');
      return ok == true;
    } catch (_) {
      return false;
    }
  }

  /// When true, Home / Recents (`onUserLeaveHint`) auto-enters PiP.
  static Future<void> setAutoEnter(bool enabled) async {
    if (kIsWeb || !Platform.isAndroid) return;
    try {
      await _channel.invokeMethod<void>('setAutoEnter', enabled);
    } catch (_) {}
  }

  static Future<bool> enter() async {
    if (kIsWeb || !Platform.isAndroid) return false;
    try {
      final ok = await _channel.invokeMethod<bool>('enter');
      return ok == true;
    } catch (_) {
      return false;
    }
  }
}
