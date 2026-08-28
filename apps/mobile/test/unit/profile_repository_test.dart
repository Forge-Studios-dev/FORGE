import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage_platform_interface/flutter_secure_storage_platform_interface.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forge_mobile/core/network/api_client.dart';
import 'package:forge_mobile/features/profile/data/profile_repository.dart';

import 'test_support/fakes.dart';

void main() {
  setUp(() {
    FlutterSecureStoragePlatform.instance = FakeSecureStoragePlatform({});
  });

  ProfileRepository buildRepository(QueuedAdapter adapter) {
    final dio = Dio()..httpClientAdapter = adapter;
    return ProfileRepository(ApiClient(dio: dio));
  }

  group('ProfileRepository', () {
    test('getMe and getByUsername return user maps', () async {
      final adapter = QueuedAdapter([
        (opts) {
          expect(opts.method, 'GET');
          expect(opts.path, '/users/me');
          return jsonResponseBody({
            'data': {'id': 'u1', 'username': 'me', 'displayName': 'Me'},
          }, 200);
        },
        (opts) {
          expect(opts.method, 'GET');
          expect(opts.path, '/users/by-username/alice');
          return jsonResponseBody({
            'data': {'id': 'u2', 'username': 'alice', 'displayName': 'Alice'},
          }, 200);
        },
      ]);

      final repo = buildRepository(adapter);
      expect((await repo.getMe())['id'], 'u1');
      expect((await repo.getByUsername('alice'))['username'], 'alice');
    });

    test('listChannelFollowGraph parses cursor page for subscribers', () async {
      final adapter = QueuedAdapter([
        (opts) {
          expect(opts.method, 'GET');
          expect(opts.path, '/channels/c1/subscribers');
          expect(opts.queryParameters['limit'], 30);
          expect(opts.queryParameters['cursor'], 'cur1');
          return jsonResponseBody({
            'data': {
              'data': [
                {'id': 's1', 'username': 'bob', 'displayName': 'Bob'},
              ],
              'meta': {'cursor': 'cur2', 'hasMore': true},
            },
          }, 200);
        },
      ]);

      final page = await buildRepository(adapter).listChannelFollowGraph(
        'c1',
        following: false,
        cursor: 'cur1',
      );

      expect(page.items, hasLength(1));
      expect((page.items.first as Map)['id'], 's1');
      expect(page.nextCursor, 'cur2');
      expect(page.hasMore, isTrue);
    });

    test('listChannelFollowGraph uses subscriptions path when following', () async {
      final adapter = QueuedAdapter([
        (opts) {
          expect(opts.path, '/channels/c1/subscriptions');
          return jsonResponseBody({
            'data': {
              'data': <dynamic>[],
              'meta': {'hasMore': false},
            },
          }, 200);
        },
      ]);

      final page = await buildRepository(adapter).listChannelFollowGraph('c1', following: true);
      expect(page.items, isEmpty);
      expect(page.hasMore, isFalse);
    });

    test('privacy get/update hit expected paths', () async {
      final adapter = QueuedAdapter([
        (opts) {
          expect(opts.method, 'GET');
          expect(opts.path, '/users/me/privacy');
          return jsonResponseBody({
            'data': {'watchHistoryPaused': true},
          }, 200);
        },
        (opts) {
          expect(opts.method, 'PUT');
          expect(opts.path, '/users/me/privacy');
          expect(opts.data['watchHistoryPaused'], false);
          return jsonResponseBody({'data': null}, 200);
        },
      ]);

      final repo = buildRepository(adapter);
      expect((await repo.getPrivacy())?['watchHistoryPaused'], isTrue);
      await repo.updatePrivacy(watchHistoryPaused: false);
      expect(adapter.requests, hasLength(2));
    });

    test('subscribe unsubscribe and notify level hit channel paths', () async {
      final adapter = QueuedAdapter([
        (opts) {
          expect(opts.method, 'POST');
          expect(opts.path, '/channels/c1/subscribe');
          return jsonResponseBody({'data': null}, 200);
        },
        (opts) {
          expect(opts.method, 'DELETE');
          expect(opts.path, '/channels/c1/subscribe');
          return jsonResponseBody({'data': null}, 200);
        },
        (opts) {
          expect(opts.method, 'PATCH');
          expect(opts.path, '/channels/c1/subscription/notify');
          expect(opts.data['notifyLevel'], 'none');
          return jsonResponseBody({'data': null}, 200);
        },
        (opts) {
          expect(opts.method, 'GET');
          expect(opts.path, '/channels/c1/subscription');
          return jsonResponseBody({
            'data': {'notifyLevel': 'personalized'},
          }, 200);
        },
      ]);

      final repo = buildRepository(adapter);
      await repo.subscribe('c1');
      await repo.unsubscribe('c1');
      await repo.setSubscriptionNotifyLevel('c1', 'none');
      expect(await repo.getSubscriptionNotifyLevel('c1'), 'personalized');
    });

    test('memberships list cancel and change tier', () async {
      final adapter = QueuedAdapter([
        (opts) {
          expect(opts.method, 'GET');
          expect(opts.path, '/subscriptions/me');
          return jsonResponseBody({
            'data': [
              {'creatorId': 'cr1', 'status': 'active'},
            ],
          }, 200);
        },
        (opts) {
          expect(opts.method, 'DELETE');
          expect(opts.path, '/subscriptions/me/cr1');
          expect(opts.queryParameters['cancelAtPeriodEnd'], true);
          return jsonResponseBody({'data': null}, 200);
        },
        (opts) {
          expect(opts.method, 'POST');
          expect(opts.path, '/billing/subscriptions/change-tier');
          expect(opts.data['creatorId'], 'cr1');
          expect(opts.data['tierId'], 't2');
          return jsonResponseBody({'data': null}, 200);
        },
      ]);

      final repo = buildRepository(adapter);
      final subs = await repo.listMySubscriptions();
      expect(subs, hasLength(1));
      await repo.cancelSubscription('cr1', cancelAtPeriodEnd: true);
      await repo.changeSubscriptionTier(creatorId: 'cr1', tierId: 't2');
      expect(adapter.requests, hasLength(3));
    });

    test('listChannelPosts and createChannelPost', () async {
      final adapter = QueuedAdapter([
        (opts) {
          expect(opts.method, 'GET');
          expect(opts.path, '/creators/cr1/channel-posts');
          expect(opts.queryParameters['limit'], 20);
          return jsonResponseBody({
            'data': {
              'data': [
                {'id': 'p1', 'body': 'Hello'},
              ],
            },
          }, 200);
        },
        (opts) {
          expect(opts.method, 'POST');
          expect(opts.path, '/creators/me/channel-posts');
          expect(opts.data['body'], 'Hi');
          expect(opts.data['mediaUrls'], ['https://cdn/x.jpg']);
          return jsonResponseBody({'data': null}, 200);
        },
      ]);

      final repo = buildRepository(adapter);
      final posts = await repo.listChannelPosts('cr1');
      expect(posts, hasLength(1));
      expect(posts.first['id'], 'p1');
      await repo.createChannelPost(body: 'Hi', mediaUrls: ['https://cdn/x.jpg']);
    });

    test('uploadChannelImage completes presign put complete flow', () async {
      final adapter = QueuedAdapter([
        (opts) {
          expect(opts.method, 'POST');
          expect(opts.path, '/users/u1/avatar-upload-url');
          return jsonResponseBody({
            'data': {
              'uploadUrl': 'https://s3.example/upload',
              'publicUrl': 'https://cdn.example/a.jpg',
              'key': 'avatars/u1',
            },
          }, 200);
        },
        (opts) {
          expect(opts.method, 'PUT');
          expect(opts.path, 'https://s3.example/upload');
          return jsonResponseBody({}, 200);
        },
        (opts) {
          expect(opts.method, 'POST');
          expect(opts.path, '/users/u1/avatar-upload-complete');
          expect(opts.data['key'], 'avatars/u1');
          return jsonResponseBody({'data': null}, 200);
        },
      ]);

      final url = await buildRepository(adapter).uploadChannelImage(
        userId: 'u1',
        banner: false,
        contentType: 'image/jpeg',
        bytes: Uint8List.fromList([1, 2, 3]),
      );
      expect(url, 'https://cdn.example/a.jpg');
      expect(adapter.requests, hasLength(3));
    });

    test('getUserVideos and getUserPlaylists parse envelopes', () async {
      final adapter = QueuedAdapter([
        (opts) {
          expect(opts.path, '/users/u1/videos');
          expect(opts.queryParameters['type'], 'short');
          expect(opts.queryParameters['sort'], 'popular');
          return jsonResponseBody({
            'data': {
              'data': [
                {
                  'id': 'v1',
                  'userId': 'u1',
                  'title': 'Clip',
                  'status': 'ready',
                  'viewCount': 1,
                  'likeCount': 0,
                  'commentCount': 0,
                  'createdAt': '2024-01-01T00:00:00.000Z',
                  'user': {
                    'id': 'u1',
                    'username': 'u',
                    'displayName': 'U',
                    'role': 'user',
                    'followerCount': 0,
                    'followingCount': 0,
                    'videoCount': 0,
                  },
                },
              ],
            },
          }, 200);
        },
        (opts) {
          expect(opts.path, '/users/u1/playlists');
          return jsonResponseBody({
            'data': [
              {'id': 'pl1', 'title': 'Favs', 'videoCount': 3},
            ],
          }, 200);
        },
      ]);

      final repo = buildRepository(adapter);
      final videos = await repo.getUserVideos('u1', type: 'short', sort: 'popular');
      expect(videos, hasLength(1));
      expect(videos.first.id, 'v1');
      final playlists = await repo.getUserPlaylists('u1');
      expect(playlists.first['id'], 'pl1');
    });
  });
}
