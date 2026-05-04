class VideoModel {
  final String id;
  final String userId;
  final String title;
  final String? description;
  final String status;
  final String? hlsUrl;
  final String? thumbnailUrl;
  final double? durationSeconds;
  final int viewCount;
  final int likeCount;
  final int commentCount;
  final UserModel user;
  final DateTime createdAt;

  const VideoModel({
    required this.id,
    required this.userId,
    required this.title,
    this.description,
    required this.status,
    this.hlsUrl,
    this.thumbnailUrl,
    this.durationSeconds,
    required this.viewCount,
    required this.likeCount,
    required this.commentCount,
    required this.user,
    required this.createdAt,
  });

  factory VideoModel.fromJson(Map<String, dynamic> json) => VideoModel(
        id: json['id'] as String,
        userId: json['userId'] as String,
        title: json['title'] as String,
        description: json['description'] as String?,
        status: json['status'] as String,
        hlsUrl: json['hlsUrl'] as String?,
        thumbnailUrl: json['thumbnailUrl'] as String?,
        durationSeconds: (json['durationSeconds'] as num?)?.toDouble(),
        viewCount: (json['viewCount'] as num?)?.toInt() ?? 0,
        likeCount: (json['likeCount'] as num?)?.toInt() ?? 0,
        commentCount: (json['commentCount'] as num?)?.toInt() ?? 0,
        user: UserModel.fromJson(json['user'] as Map<String, dynamic>),
        createdAt: DateTime.parse(json['createdAt'] as String),
      );
}

class UserModel {
  final String id;
  final String username;
  final String displayName;
  final String? avatarUrl;
  final String role;
  final int followerCount;
  final int followingCount;
  final int videoCount;

  const UserModel({
    required this.id,
    required this.username,
    required this.displayName,
    this.avatarUrl,
    required this.role,
    required this.followerCount,
    required this.followingCount,
    required this.videoCount,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) => UserModel(
        id: json['id'] as String,
        username: json['username'] as String,
        displayName: json['displayName'] as String,
        avatarUrl: json['avatarUrl'] as String?,
        role: json['role'] as String? ?? 'user',
        followerCount: (json['followerCount'] as num?)?.toInt() ?? 0,
        followingCount: (json['followingCount'] as num?)?.toInt() ?? 0,
        videoCount: (json['videoCount'] as num?)?.toInt() ?? 0,
      );
}
