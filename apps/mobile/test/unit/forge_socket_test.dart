import 'package:flutter_secure_storage_platform_interface/flutter_secure_storage_platform_interface.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forge_mobile/core/socket/forge_socket.dart';

import 'test_support/fakes.dart';

/// ForgeSocket is a static singleton wrapping the real socket_io_client
/// transport, so these tests deliberately stay off the wire (HIGH-09): no
/// server to connect to in a unit test, and socket_io_client ships no test
/// double. What's covered instead is the two things that actually regress
/// silently — the token gate in [ForgeSocket.connect] and the null-safety of
/// every join/leave/emit helper before a socket exists (e.g. a stray `!`
/// replacing the `?.` below would crash every cold app start).
void main() {
  setUp(() {
    FlutterSecureStoragePlatform.instance = FakeSecureStoragePlatform({});
  });

  tearDown(() {
    ForgeSocket.disconnect();
  });

  group('ForgeSocket.connect', () {
    test('returns null and does not create a socket when no token is stored', () async {
      final socket = await ForgeSocket.connect();
      expect(socket, isNull);
    });
  });

  group('ForgeSocket helpers before any connection exists', () {
    test('every join/leave/emit/on/off call is a safe no-op, not a crash', () {
      expect(() {
        ForgeSocket.joinStream('s1');
        ForgeSocket.leaveStream('s1');
        ForgeSocket.joinStreamChat('s1');
        ForgeSocket.leaveStreamChat('s1');
        ForgeSocket.joinChannel('c1');
        ForgeSocket.leaveChannel('c1');
        ForgeSocket.joinCommunity('community1');
        ForgeSocket.leaveCommunity('community1');
        ForgeSocket.joinRoom('r1');
        ForgeSocket.leaveRoom('r1');
        ForgeSocket.joinLiveFeed();
        ForgeSocket.leaveLiveFeed();
        ForgeSocket.joinVideo('v1');
        ForgeSocket.leaveVideo('v1');
        ForgeSocket.joinConversation('conv1');
        ForgeSocket.leaveConversation('conv1');
        ForgeSocket.reactStream('s1', 'heart');
        ForgeSocket.on('some-event', (_) {});
        ForgeSocket.off('some-event');
        ForgeSocket.disconnect();
      }, returnsNormally);
    });
  });
}
