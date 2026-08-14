import 'package:flutter_test/flutter_test.dart';
import 'package:forge_mobile/features/studio/presentation/studio_live_debrief_screen.dart';

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

  testWidgets('shows an error state when the stream fails to load', (tester) async {
    final client = fakeApiClient({
      'GET /streams/s1': failWith('/streams/s1'),
    });

    useTallViewport(tester);
    addTearDown(tester.view.resetPhysicalSize);
    await pumpForgeScreen(tester, const StudioLiveDebriefScreen(streamId: 's1'), client: client);

    expect(find.text('Could not load debrief.'), findsOneWidget);
  });

  testWidgets('renders title, metrics, and a replay link', (tester) async {
    final client = fakeApiClient({
      'GET /streams/s1': (_) => jsonResponse({
            'data': {'title': 'Friday stream'},
          }),
      'GET /creators/me/streams/s1/analytics': (_) => jsonResponse({
            'data': {'peakViewers': 120, 'avgViewers': 80, 'uniqueViewers': 300, 'totalChatMessages': 45},
          }),
      'GET /streams/s1/replay': (_) => jsonResponse({
            'data': {'id': 'v1'},
          }),
    });

    useTallViewport(tester);
    addTearDown(tester.view.resetPhysicalSize);
    await pumpForgeScreen(tester, const StudioLiveDebriefScreen(streamId: 's1'), client: client);

    expect(find.text('Friday stream'), findsOneWidget);
    expect(find.text('120'), findsOneWidget);
    expect(find.text('Open replay VOD'), findsOneWidget);
  });

  testWidgets('generates and shows an AI summary', (tester) async {
    final client = fakeApiClient({
      'GET /streams/s1': (_) => jsonResponse({
            'data': {'title': 'Friday stream'},
          }),
      'GET /streams/s1/ai-summary': (_) => jsonResponse({
            'data': {'summary': 'Great energy throughout the stream.'},
          }),
    });

    useTallViewport(tester);
    addTearDown(tester.view.resetPhysicalSize);
    await pumpForgeScreen(tester, const StudioLiveDebriefScreen(streamId: 's1'), client: client);

    await tapAndSettle(tester, find.text('Generate AI summary'));

    expect(find.text('Great energy throughout the stream.'), findsOneWidget);
  });
}
