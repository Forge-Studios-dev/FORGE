import 'package:flutter_riverpod/flutter_riverpod.dart';

class MiniPlayerSession {
  final String videoId;
  final String title;
  final String hlsUrl;
  final String? thumbnailUrl;
  final int seconds;
  final String? videoType;

  const MiniPlayerSession({
    required this.videoId,
    required this.title,
    required this.hlsUrl,
    this.thumbnailUrl,
    required this.seconds,
    this.videoType,
  });

  MiniPlayerSession copyWith({int? seconds}) {
    return MiniPlayerSession(
      videoId: videoId,
      title: title,
      hlsUrl: hlsUrl,
      thumbnailUrl: thumbnailUrl,
      seconds: seconds ?? this.seconds,
      videoType: videoType,
    );
  }
}

class MiniPlayerNotifier extends Notifier<MiniPlayerSession?> {
  @override
  MiniPlayerSession? build() => null;

  void open(MiniPlayerSession session) {
    state = MiniPlayerSession(
      videoId: session.videoId,
      title: session.title,
      hlsUrl: session.hlsUrl,
      thumbnailUrl: session.thumbnailUrl,
      seconds: session.seconds < 0 ? 0 : session.seconds,
      videoType: session.videoType,
    );
  }

  void updateSeconds(int seconds) {
    final current = state;
    if (current == null) return;
    state = current.copyWith(seconds: seconds < 0 ? 0 : seconds);
  }

  void close() => state = null;

  void closeIfVideo(String videoId) {
    if (state?.videoId == videoId) state = null;
  }
}

final miniPlayerProvider =
    NotifierProvider<MiniPlayerNotifier, MiniPlayerSession?>(MiniPlayerNotifier.new);
