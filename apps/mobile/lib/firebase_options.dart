// Generated from Firebase CLI (forge-studios-prod-61de0). Re-run: flutterfire configure --project=forge-studios-prod-61de0
import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      throw UnsupportedError('Firebase web is not configured for mobile.');
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      default:
        throw UnsupportedError('Firebase is not supported on this platform.');
    }
  }

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyDxjjBC3cpypFhaOe5h0gMrZyVYHa3Ux48',
    appId: '1:616295087859:android:2a7f20d73c781a15e00186',
    messagingSenderId: '616295087859',
    projectId: 'forge-studios-prod-61de0',
    storageBucket: 'forge-studios-prod-61de0.firebasestorage.app',
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'AIzaSyBXN7ui1pK5NX05cElEuR6XB39pBfAxd5E',
    appId: '1:616295087859:ios:a470ea174f31f23ae00186',
    messagingSenderId: '616295087859',
    projectId: 'forge-studios-prod-61de0',
    storageBucket: 'forge-studios-prod-61de0.firebasestorage.app',
    iosBundleId: 'com.forgestudios.app',
  );
}
