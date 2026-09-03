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

  test('video_ready Short opens shorts deep link', () {
    expect(
      notificationHref('video_ready', {'videoId': 's1', 'videoType': 'short'}),
      '/shorts?v=s1',
    );
  });

  test('content_scan_held opens admin held queue', () {
    expect(
      notificationHref('content_scan_held', {'videoId': 'v-held'}),
      'https://admin.forgestudios.net/content?moderationStatus=held&videoId=v-held',
    );
  });

  test('content_scan_held uploader opens Studio video', () {
    expect(
      notificationHref('content_scan_held', {
        'videoId': 'v-held',
        'audience': 'uploader',
      }),
      '/studio/videos/v-held',
    );
  });

  test('content_scan_held respects adminBaseUrl', () {
    expect(
      notificationHref(
        'content_scan_held',
        {'videoId': 'v1'},
        adminBaseUrl: 'https://admin.example.com/',
      ),
      'https://admin.example.com/content?moderationStatus=held&videoId=v1',
    );
  });
}
