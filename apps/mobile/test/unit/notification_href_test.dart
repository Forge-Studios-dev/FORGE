import 'package:flutter_test/flutter_test.dart';
import 'package:forge_mobile/core/notifications/notification_href.dart';

void main() {
  test('comment reply includes lc deep link', () {
    expect(
      notificationHref('comment_reply', {'videoId': 'v1', 'commentId': 'c1'}),
      '/watch/v1?lc=c1',
    );
  });

  test('new follower prefers followerUsername', () {
    expect(
      notificationHref('new_follower', {
        'followerUsername': 'alice',
        'username': 'bob',
      }),
      '/profile/alice',
    );
  });

  test('unknown type without video falls back to null', () {
    expect(notificationHref('unknown_type', {}), isNull);
  });

  test('stream reminder opens live', () {
    expect(
      notificationHref('stream_reminder', {'streamId': 's1'}),
      '/live/s1',
    );
  });
}
