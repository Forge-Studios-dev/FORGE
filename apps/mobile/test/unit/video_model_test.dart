import 'package:flutter_test/flutter_test.dart';
import 'package:forge_mobile/shared/models/video.dart';

void main() {
  test('VideoModel parses accessDenied and accessReason from API payload', () {
    final video = VideoModel.fromJson({
      'id': 'vid-1',
      'userId': 'user-1',
      'title': 'Gated lesson',
      'status': 'ready',
      'hlsUrl': null,
      'accessDenied': true,
      'accessReason': 'subscription_required',
      'viewCount': 0,
      'likeCount': 0,
      'commentCount': 0,
      'createdAt': '2026-06-04T12:00:00.000Z',
      'user': {
        'id': 'user-1',
        'username': 'creator',
        'displayName': 'Creator',
        'role': 'creator',
        'followerCount': 0,
        'followingCount': 0,
        'videoCount': 1,
      },
    });

    expect(video.accessDenied, isTrue);
    expect(video.accessReason, 'subscription_required');
    expect(video.hlsUrl, isNull);
  });

  test('VideoModel defaults accessDenied to false when omitted', () {
    final video = VideoModel.fromJson({
      'id': 'vid-2',
      'userId': 'user-1',
      'title': 'Public lesson',
      'status': 'ready',
      'hlsUrl': 'https://stream.mux.com/abc.m3u8',
      'viewCount': 10,
      'likeCount': 2,
      'commentCount': 1,
      'createdAt': '2026-06-04T12:00:00.000Z',
      'user': {
        'id': 'user-1',
        'username': 'creator',
        'displayName': 'Creator',
        'role': 'creator',
        'followerCount': 0,
        'followingCount': 0,
        'videoCount': 1,
      },
    });

    expect(video.accessDenied, isFalse);
    expect(video.hlsUrl, isNotEmpty);
  });

  test('VideoModel parses visibility and scheduledPublishAt', () {
    final video = VideoModel.fromJson({
      'id': 'vid-3',
      'userId': 'user-1',
      'title': 'Scheduled',
      'status': 'ready',
      'visibility': 'unlisted',
      'scheduledPublishAt': '2026-08-10T15:00:00.000Z',
      'viewCount': 0,
      'likeCount': 0,
      'commentCount': 0,
      'createdAt': '2026-06-04T12:00:00.000Z',
      'user': {
        'id': 'user-1',
        'username': 'creator',
        'displayName': 'Creator',
        'role': 'creator',
        'followerCount': 0,
        'followingCount': 0,
        'videoCount': 1,
      },
    });

    expect(video.visibility, 'unlisted');
    expect(video.scheduledPublishAt, isNotNull);
    expect(video.toJson()['visibility'], 'unlisted');
  });
}
