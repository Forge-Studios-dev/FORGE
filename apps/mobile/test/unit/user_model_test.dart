import 'package:flutter_test/flutter_test.dart';
import 'package:forge_mobile/shared/models/video.dart';

void main() {
  group('UserModel.fromJson', () {
    test('parses all required fields', () {
      final user = UserModel.fromJson({
        'id': 'u1',
        'username': 'creator1',
        'displayName': 'Creator One',
        'role': 'creator',
        'followerCount': 150,
        'followingCount': 10,
        'videoCount': 25,
      });

      expect(user.id, 'u1');
      expect(user.username, 'creator1');
      expect(user.displayName, 'Creator One');
      expect(user.role, 'creator');
      expect(user.followerCount, 150);
      expect(user.followingCount, 10);
      expect(user.videoCount, 25);
    });

    test('defaults isVerified to false when omitted', () {
      final user = UserModel.fromJson({
        'id': 'u2',
        'username': 'viewer',
        'displayName': 'Viewer',
        'role': 'user',
        'followerCount': 0,
        'followingCount': 0,
        'videoCount': 0,
      });

      expect(user.isVerified, isFalse);
    });

    test('parses isVerified true', () {
      final user = UserModel.fromJson({
        'id': 'u3',
        'username': 'verified',
        'displayName': 'Verified Creator',
        'role': 'creator',
        'isVerified': true,
        'creatorStatus': 'approved',
        'followerCount': 500,
        'followingCount': 20,
        'videoCount': 50,
      });

      expect(user.isVerified, isTrue);
      expect(user.creatorStatus, 'approved');
    });

    test('defaults role to user when omitted', () {
      final user = UserModel.fromJson({
        'id': 'u4',
        'username': 'anon',
        'displayName': 'Anonymous',
        'followerCount': 0,
        'followingCount': 0,
        'videoCount': 0,
      });

      expect(user.role, 'user');
    });

    test('parses optional avatarUrl', () {
      final user = UserModel.fromJson({
        'id': 'u5',
        'username': 'withavatar',
        'displayName': 'With Avatar',
        'role': 'user',
        'avatarUrl': 'https://cdn.example.com/avatar.jpg',
        'followerCount': 0,
        'followingCount': 0,
        'videoCount': 0,
      });

      expect(user.avatarUrl, 'https://cdn.example.com/avatar.jpg');
    });

    test('defaults viewerFollowing to false', () {
      final user = UserModel.fromJson({
        'id': 'u6',
        'username': 'test',
        'displayName': 'Test',
        'role': 'user',
        'followerCount': 0,
        'followingCount': 0,
        'videoCount': 0,
      });

      expect(user.viewerFollowing, isFalse);
    });

    test('parses viewerFollowing true', () {
      final user = UserModel.fromJson({
        'id': 'u7',
        'username': 'followed',
        'displayName': 'Followed Creator',
        'role': 'creator',
        'viewerFollowing': true,
        'followerCount': 100,
        'followingCount': 5,
        'videoCount': 10,
      });

      expect(user.viewerFollowing, isTrue);
    });

    test('parses numeric counts from num type', () {
      final user = UserModel.fromJson({
        'id': 'u8',
        'username': 'big',
        'displayName': 'Big Creator',
        'role': 'creator',
        'followerCount': 1000000,
        'followingCount': 500,
        'videoCount': 2000,
      });

      expect(user.followerCount, 1000000);
      expect(user.videoCount, 2000);
    });
  });
}
