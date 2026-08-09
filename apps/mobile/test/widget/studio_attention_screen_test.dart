import 'package:flutter_test/flutter_test.dart';
import 'package:forge_mobile/features/studio/presentation/studio_attention_screen.dart';

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

  testWidgets('shows an error state when the queue fails to load', (tester) async {
    final client = fakeApiClient({
      'GET /creators/me/attention': failWith('/creators/me/attention'),
    });

    await pumpForgeScreen(tester, const StudioAttentionScreen(), client: client);

    expect(find.text('Could not load attention queue'), findsOneWidget);
  });

  testWidgets('shows a clear-queue empty state', (tester) async {
    final client = fakeApiClient({
      'GET /creators/me/attention': (_) => jsonResponse({
            'data': {'counts': {}, 'items': []},
          }),
    });

    useTallViewport(tester);
    addTearDown(tester.view.resetPhysicalSize);
    await pumpForgeScreen(tester, const StudioAttentionScreen(), client: client);

    expect(find.text('Nothing urgent right now'), findsOneWidget);
  });

  testWidgets('renders counts and queue items', (tester) async {
    final client = fakeApiClient({
      'GET /creators/me/attention': (_) => jsonResponse({
            'data': {
              'counts': {'commentsNeedingReply': 4, 'pendingModeration': 2},
              'items': [
                {
                  'href': '/studio/comments/c1',
                  'tone': 'critical',
                  'kind': 'comment_reply',
                  'label': 'Reply to Bob',
                  'detail': 'Left a question 2 hours ago',
                },
              ],
            },
          }),
    });

    useTallViewport(tester);
    addTearDown(tester.view.resetPhysicalSize);
    await pumpForgeScreen(tester, const StudioAttentionScreen(), client: client);

    expect(find.text('4'), findsOneWidget);
    expect(find.text('2'), findsOneWidget);
    expect(find.text('Reply to Bob'), findsOneWidget);
    expect(find.text('Left a question 2 hours ago'), findsOneWidget);
    expect(find.text('comment reply'), findsOneWidget);
  });
}
