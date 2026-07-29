import 'dart:async';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../constants/app_constants.dart';

const _storage = FlutterSecureStorage();

class ForgeSocket {
  ForgeSocket._();
  static io.Socket? _socket;

  static Future<io.Socket?> connect() async {
    final token = await _storage.read(key: AppConstants.accessTokenKey);
    if (token == null || token.isEmpty) return null;

    if (_socket != null && _socket!.connected) return _socket;

    final base = AppConstants.apiBaseUrl.replaceAll(RegExp(r'/api/v1/?$'), '');
    _socket = io.io(
      '$base/events',
      io.OptionBuilder()
          .setTransports(['websocket'])
          .enableAutoConnect()
          .setAuth({'token': token})
          .build(),
    );
    return _socket;
  }

  static void joinStream(String streamId) {
    _socket?.emit('join-stream', {'streamId': streamId});
  }

  static void leaveStream(String streamId) {
    _socket?.emit('leave-stream', {'streamId': streamId});
  }

  static void joinStreamChat(String streamId) {
    _socket?.emit('join-stream-chat', {'streamId': streamId});
  }

  static void leaveStreamChat(String streamId) {
    _socket?.emit('leave-stream-chat', {'streamId': streamId});
  }

  static void joinChannel(String channelId) {
    _socket?.emit('join-channel', {'channelId': channelId});
  }

  static void leaveChannel(String channelId) {
    _socket?.emit('leave-channel', {'channelId': channelId});
  }

  static void joinCommunity(String communityId) {
    _socket?.emit('join-community', {'communityId': communityId});
  }

  static void leaveCommunity(String communityId) {
    _socket?.emit('leave-community', {'communityId': communityId});
  }

  static void joinRoom(String roomId) {
    _socket?.emit('join-room', {'roomId': roomId});
  }

  static void leaveRoom(String roomId) {
    _socket?.emit('leave-room', {'roomId': roomId});
  }

  static void joinLiveFeed() {
    _socket?.emit('join-live-feed');
  }

  static void leaveLiveFeed() {
    _socket?.emit('leave-live-feed');
  }

  static void joinVideo(String videoId) {
    _socket?.emit('join-video', {'videoId': videoId});
  }

  static void leaveVideo(String videoId) {
    _socket?.emit('leave-video', {'videoId': videoId});
  }

  static void reactStream(String streamId, String reaction) {
    _socket?.emit('stream:react', {'streamId': streamId, 'reaction': reaction});
  }

  static void on(String event, void Function(dynamic) handler) {
    _socket?.on(event, handler);
  }

  static void off(String event, [void Function(dynamic)? handler]) {
    if (handler != null) {
      _socket?.off(event, handler);
    } else {
      _socket?.off(event);
    }
  }

  static bool get isConnected => _socket?.connected == true;

  static void disconnect() {
    _socket?.disconnect();
    _socket = null;
  }
}
