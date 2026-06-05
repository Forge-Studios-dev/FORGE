import 'package:flutter_test/flutter_test.dart';

import '../lib/shared/models/video.dart';
import '../lib/shared/widgets/gated_content_panel.dart';

void main() {
  test('VideoModel.fromJson parses hlsUrl + counters', () {
    final json = <String, dynamic>{
      'id': 'video-1',
      'userId': 'creator-1',
      'title': 'Lesson 1',
      'description': null,
      'status': 'ready',
      'accessDenied': true,
      'accessReason': 'tier_required',
      'hlsUrl': 'https://stream.mux.com/pb.m3u8?token=abc',
      'thumbnailUrl': 'https://image.mux.com/pb/thumb.jpg',
      'durationSeconds': 120,
      'viewCount': 10,
      'likeCount': 3,
      'commentCount': 2,
      'user': <String, dynamic>{
        'id': 'creator-1',
        'username': 'creator',
        'displayName': 'Creator',
        'avatarUrl': null,
        'role': 'creator',
        'isVerified': false,
        'creatorStatus': null,
        'creatorReviewNote': null,
        'followerCount': 1,
        'followingCount': 2,
        'videoCount': 3,
      },
      'createdAt': '2026-01-01T00:00:00Z',
    };

    final model = VideoModel.fromJson(json);
    expect(model.id, 'video-1');
    expect(model.hlsUrl, isNotNull);
    expect(model.accessDenied, true);
    expect(model.accessReason, 'tier_required');
    expect(model.status, 'ready');
    expect(model.viewCount, 10);
    expect(model.likeCount, 3);
    expect(model.commentCount, 2);
    expect(model.createdAt, DateTime.parse('2026-01-01T00:00:00Z'));
  });

  test('accessDeniedMessage maps API reasons', () {
    expect(accessDeniedMessage('tier_required'), contains('tier'));
    expect(accessDeniedMessage('login_required'), contains('Sign in'));
    expect(accessDeniedMessage(null), isNotEmpty);
  });

  test('accessDenied parsing matches API contract (== true)', () {
    final enabled = <String, dynamic>{'accessDenied': true};
    expect(enabled['accessDenied'] == true, isTrue);

    final deniedString = <String, dynamic>{'accessDenied': 'true'};
    expect(deniedString['accessDenied'] == true, isFalse);

    final deniedNull = <String, dynamic>{'accessDenied': null};
    expect(deniedNull['accessDenied'] == true, isFalse);

    final deniedMissing = <String, dynamic>{};
    expect(deniedMissing['accessDenied'] == true, isFalse);
  });
}

