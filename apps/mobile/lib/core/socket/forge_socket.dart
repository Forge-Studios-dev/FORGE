import 'dart:async';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../constants/app_constants.dart';

const _storage = FlutterSecureStorage();

class ForgeSocket {
  ForgeSocket._();
  static io.Socket? _socket;
  static bool _connectHooked = false;

  /// Active rooms — re-emitted after Socket.IO auto-reconnect.
  static final Set<String> _streamIds = {};
  static final Set<String> _streamChatIds = {};
  static final Set<String> _channelIds = {};
  static final Set<String> _communityIds = {};
  static final Set<String> _roomIds = {};
  static final Set<String> _conversationIds = {};
  static final Set<String> _videoIds = {};
  static bool _liveFeed = false;

  static void _hookReconnect() {
    if (_connectHooked || _socket == null) return;
    _connectHooked = true;
    _socket!.on('connect', (_) => _rejoinAll());
  }

  static void _rejoinAll() {
    for (final id in _streamIds) {
      _socket?.emit('join-stream', {'streamId': id});
    }
    for (final id in _streamChatIds) {
      _socket?.emit('join-stream-chat', {'streamId': id});
    }
    for (final id in _channelIds) {
      _socket?.emit('join-channel', {'channelId': id});
    }
    for (final id in _communityIds) {
      _socket?.emit('join-community', {'communityId': id});
    }
    for (final id in _roomIds) {
      _socket?.emit('join-room', {'roomId': id});
    }
    for (final id in _conversationIds) {
      _socket?.emit('join-conversation', {'conversationId': id});
    }
    for (final id in _videoIds) {
      _socket?.emit('join-video', {'videoId': id});
    }
    if (_liveFeed) {
      _socket?.emit('join-live-feed');
    }
  }

  static Future<io.Socket?> connect() async {
    final token = await _storage.read(key: AppConstants.accessTokenKey);
    if (token == null || token.isEmpty) return null;

    if (_socket != null && _socket!.connected) return _socket;

    final base = AppConstants.apiBaseUrl.replaceAll(RegExp(r'/api/v1/?$'), '');
    // Recreate if we had a disconnected socket so auth/transports stay fresh.
    if (_socket != null && !_socket!.connected) {
      _socket!.disconnect();
      _socket = null;
      _connectHooked = false;
    }
    _socket = io.io(
      '$base/events',
      io.OptionBuilder()
          .setTransports(['websocket'])
          .enableAutoConnect()
          .setAuth({'token': token})
          .build(),
    );
    _hookReconnect();
    return _socket;
  }

  static void joinStream(String streamId) {
    _streamIds.add(streamId);
    _socket?.emit('join-stream', {'streamId': streamId});
  }

  static void leaveStream(String streamId) {
    _streamIds.remove(streamId);
    _socket?.emit('leave-stream', {'streamId': streamId});
  }

  static void joinStreamChat(String streamId) {
    _streamChatIds.add(streamId);
    _socket?.emit('join-stream-chat', {'streamId': streamId});
  }

  static void leaveStreamChat(String streamId) {
    _streamChatIds.remove(streamId);
    _socket?.emit('leave-stream-chat', {'streamId': streamId});
  }

  static void joinChannel(String channelId) {
    _channelIds.add(channelId);
    _socket?.emit('join-channel', {'channelId': channelId});
  }

  static void leaveChannel(String channelId) {
    _channelIds.remove(channelId);
    _socket?.emit('leave-channel', {'channelId': channelId});
  }

  static void joinCommunity(String communityId) {
    _communityIds.add(communityId);
    _socket?.emit('join-community', {'communityId': communityId});
  }

  static void leaveCommunity(String communityId) {
    _communityIds.remove(communityId);
    _socket?.emit('leave-community', {'communityId': communityId});
  }

  static void joinRoom(String roomId) {
    _roomIds.add(roomId);
    _socket?.emit('join-room', {'roomId': roomId});
  }

  static void leaveRoom(String roomId) {
    _roomIds.remove(roomId);
    _socket?.emit('leave-room', {'roomId': roomId});
  }

  static void joinLiveFeed() {
    _liveFeed = true;
    _socket?.emit('join-live-feed');
  }

  static void leaveLiveFeed() {
    _liveFeed = false;
    _socket?.emit('leave-live-feed');
  }

  static void joinConversation(String conversationId) {
    _conversationIds.add(conversationId);
    _socket?.emit('join-conversation', {'conversationId': conversationId});
  }

  static void leaveConversation(String conversationId) {
    _conversationIds.remove(conversationId);
    _socket?.emit('leave-conversation', {'conversationId': conversationId});
  }

  static void joinVideo(String videoId) {
    _videoIds.add(videoId);
    _socket?.emit('join-video', {'videoId': videoId});
  }

  static void leaveVideo(String videoId) {
    _videoIds.remove(videoId);
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
    _connectHooked = false;
    _streamIds.clear();
    _streamChatIds.clear();
    _channelIds.clear();
    _communityIds.clear();
    _roomIds.clear();
    _conversationIds.clear();
    _videoIds.clear();
    _liveFeed = false;
  }
}
