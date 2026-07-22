# FORGE mobile (`apps/mobile`)

Flutter app for the FORGE creator platform. See [../../docs/FORGE_PROJECT_MASTER.md §11](../../docs/FORGE_PROJECT_MASTER.md#11-mobile-app-appsmobile) for architecture (router, upload, FCM) and [../../docs/GETTING_STARTED.md#mobile](../../docs/GETTING_STARTED.md#mobile) for local setup.

## Build

```bash
flutter pub get
flutter run --dart-define=API_BASE_URL=http://YOUR_IP:3001/api/v1
flutter build apk --debug   # Android
flutter build ios --debug   # iOS (requires Xcode + a signing team)
```

`android/` and `ios/` platform projects are checked in (generated via `flutter create .`, then customized — bundle ID `com.forgestudios.app`, permissions, AGP/Kotlin pins). Notably, Android Gradle Plugin is pinned to 8.9.1 (not the Flutter-default 9.x) because several plugins in `pubspec.yaml` (`connectivity_plus`, `device_info_plus`, `flutter_webrtc`, `livekit_client`, `package_info_plus`, `share_plus`, `wakelock_plus`) don't yet support AGP 9's "Built-in Kotlin" — see `android/settings.gradle.kts` for details before bumping AGP.

## Tests

```bash
flutter test
```
