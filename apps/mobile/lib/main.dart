import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/cache/local_cache.dart';
import 'core/connectivity/connectivity_gate.dart';
import 'core/constants/app_constants.dart';
import 'core/observability/sentry_setup.dart';
import 'core/push/forge_push.dart';
import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';
import 'firebase_options.dart';

Future<void> main() async {
  AppConstants.assertValidForRelease();
  WidgetsFlutterBinding.ensureInitialized();
  await LocalCache.init();
  if (DefaultFirebaseOptions.android.projectId != 'REPLACE_ME') {
    try {
      await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
      // Must be registered before runApp (MED-18) — top-level entry point,
      // required for background/terminated-state push messages.
      FirebaseMessaging.onBackgroundMessage(forgePushBackgroundHandler);
    } catch (_) {
      /* Firebase optional until flutterfire configure */
    }
  }
  await initForgeObservability(() async {
    runApp(const ProviderScope(child: ForgeApp()));
  });
}

class ForgeApp extends ConsumerWidget {
  const ForgeApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);
    return ConnectivityGate(
      child: MaterialApp.router(
        title: 'FORGE',
        theme: AppTheme.dark,
        darkTheme: AppTheme.dark,
        themeMode: ThemeMode.dark,
        // M-M1: localization scaffolding — arb stubs under lib/l10n; expand strings later.
        localizationsDelegates: const [
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: const [Locale('en')],
        routerConfig: router,
        debugShowCheckedModeBanner: false,
      ),
    );
  }
}
