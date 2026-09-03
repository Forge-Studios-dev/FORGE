import 'package:flutter_test/flutter_test.dart';
import 'package:forge_mobile/features/studio/presentation/studio_upload_reliability_screen.dart';

import 'test_support/widget_harness.dart';

void main() {
  late TestCache cache;

  setUp(() async {
    installFakeSecureStorage();
    cache = await TestCache.open();
  });

  tearDown(() async {
    await cache.dispose();
  });

  testWidgets('explains upload phases and clear-stuck action', (tester) async {
    final client = fakeApiClient({});

    useTallViewport(tester);
    addTearDown(tester.view.resetPhysicalSize);
    await pumpForgeScreen(tester, const StudioUploadReliabilityScreen(), client: client);

    expect(find.text('Upload reliability'), findsWidgets);
    expect(find.text('Checksum / prepare'), findsOneWidget);
    expect(find.text('Clear stuck uploads'), findsOneWidget);
  });
}
