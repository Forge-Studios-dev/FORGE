class VideoModel {
  final String id;
  final String userId;
  final String title;
  final String? description;
  final String status;
  final String? visibility;
  final String? hlsUrl;
  final bool accessDenied;
  final String? accessReason;
  final String? thumbnailUrl;
  final String? captionUrl;
  final List<CaptionTrack> captionTracks;
  final double? durationSeconds;
  final String? videoType;
  final int? viewerProgressSeconds;
  final int viewCount;
  final int likeCount;
  final int commentCount;
  final bool viewerLiked;
  final bool viewerDisliked;
  final bool viewerSubscribed;
  final UserModel user;
  final DateTime createdAt;
  final DateTime? scheduledPublishAt;
  final String? categoryId;
  final List<SkillTagRef> skillTags;
  final String? moderationStatus;

  const VideoModel({
    required this.id,
    required this.userId,
    required this.title,
    this.description,
    required this.status,
    this.visibility,
    this.hlsUrl,
    this.accessDenied = false,
    this.accessReason,
    this.thumbnailUrl,
    this.captionUrl,
    this.captionTracks = const [],
    this.durationSeconds,
    this.videoType,
    this.viewerProgressSeconds,
    required this.viewCount,
    required this.likeCount,
    required this.commentCount,
    this.viewerLiked = false,
    this.viewerDisliked = false,
    this.viewerSubscribed = false,
    required this.user,
    required this.createdAt,
    this.scheduledPublishAt,
    this.categoryId,
    this.skillTags = const [],
    this.moderationStatus,
  });

  factory VideoModel.fromJson(Map<String, dynamic> json) => VideoModel(
        id: json['id'] as String,
        userId: json['userId'] as String? ?? '',
        title: json['title'] as String? ?? '',
        description: json['description'] as String?,
        status: json['status'] as String? ?? 'ready',
        visibility: json['visibility'] as String?,
        hlsUrl: json['hlsUrl'] as String?,
        accessDenied: json['accessDenied'] == true,
        accessReason: json['accessReason'] as String?,
        thumbnailUrl: json['thumbnailUrl'] as String?,
        captionUrl: json['captionUrl'] as String?,
        captionTracks: (json['captionTracks'] as List<dynamic>? ?? [])
            .whereType<Map>()
            .map((e) => CaptionTrack.fromJson(Map<String, dynamic>.from(e)))
            .where((t) => t.url.isNotEmpty)
            .toList(),
        durationSeconds: (json['durationSeconds'] as num?)?.toDouble(),
        videoType: json['videoType'] as String?,
        viewerProgressSeconds: (json['viewerProgressSeconds'] as num?)?.toInt(),
        viewCount: (json['viewCount'] as num?)?.toInt() ?? 0,
        likeCount: (json['likeCount'] as num?)?.toInt() ?? 0,
        commentCount: (json['commentCount'] as num?)?.toInt() ?? 0,
        viewerLiked: json['viewerLiked'] as bool? ?? false,
        viewerDisliked: json['viewerDisliked'] as bool? ?? false,
        viewerSubscribed: json['viewerSubscribed'] as bool? ??
            json['viewerFollowingCreator'] as bool? ??
            false,
        user: json['user'] is Map<String, dynamic>
            ? UserModel.fromJson(json['user'] as Map<String, dynamic>)
            : const UserModel(
                id: '',
                username: 'creator',
                displayName: 'Creator',
                role: 'user',
                followerCount: 0,
                followingCount: 0,
                videoCount: 0,
              ),
        createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ??
            DateTime.fromMillisecondsSinceEpoch(0),
        scheduledPublishAt: DateTime.tryParse(json['scheduledPublishAt'] as String? ?? ''),
        categoryId: json['categoryId'] as String?,
        skillTags: (json['skillTags'] as List<dynamic>? ?? [])
            .whereType<Map>()
            .map((e) => SkillTagRef.fromJson(Map<String, dynamic>.from(e)))
            .where((t) => t.id.isNotEmpty)
            .toList(),
        moderationStatus: json['moderationStatus'] as String?,
      );

  /// Round-trips through [fromJson] — used for the offline cache (HIGH-07),
  /// not sent back to the API.
  Map<String, dynamic> toJson() => {
        'id': id,
        'userId': userId,
        'title': title,
        'description': description,
        'status': status,
        'visibility': visibility,
        'hlsUrl': hlsUrl,
        'accessDenied': accessDenied,
        'accessReason': accessReason,
        'thumbnailUrl': thumbnailUrl,
        'captionUrl': captionUrl,
        'captionTracks': captionTracks.map((e) => e.toJson()).toList(),
        'durationSeconds': durationSeconds,
        'videoType': videoType,
        'viewerProgressSeconds': viewerProgressSeconds,
        'viewCount': viewCount,
        'likeCount': likeCount,
        'commentCount': commentCount,
        'viewerLiked': viewerLiked,
        'viewerDisliked': viewerDisliked,
        'viewerSubscribed': viewerSubscribed,
        'user': user.toJson(),
        'createdAt': createdAt.toIso8601String(),
        'scheduledPublishAt': scheduledPublishAt?.toIso8601String(),
        'categoryId': categoryId,
        'skillTags': skillTags.map((e) => e.toJson()).toList(),
        'moderationStatus': moderationStatus,
      };
}

class CaptionTrack {
  final String language;
  final String label;
  final String url;

  const CaptionTrack({
    required this.language,
    required this.label,
    required this.url,
  });

  factory CaptionTrack.fromJson(Map<String, dynamic> json) => CaptionTrack(
        language: json['language'] as String? ?? 'en',
        label: json['label'] as String? ?? '',
        url: json['url'] as String? ?? '',
      );

  Map<String, dynamic> toJson() => {
        'language': language,
        'label': label,
        'url': url,
      };
}

class SkillTagRef {
  final String id;
  final String name;

  const SkillTagRef({required this.id, required this.name});

  factory SkillTagRef.fromJson(Map<String, dynamic> json) => SkillTagRef(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? '',
      );

  Map<String, dynamic> toJson() => {'id': id, 'name': name};
}

class UserModel {
  final String id;
  final String username;
  final String displayName;
  final String? avatarUrl;
  final String? bannerUrl;
  final String? bio;
  final String? websiteUrl;
  final List<ChannelLink> channelLinks;
  final String role;
  final bool isVerified;
  final String? creatorStatus;
  final String? creatorReviewNote;
  final int followerCount;
  final int followingCount;
  final int videoCount;
  final bool viewerFollowing;
  final bool viewerBlocked;
  final DateTime? createdAt;

  const UserModel({
    required this.id,
    required this.username,
    required this.displayName,
    this.avatarUrl,
    this.bannerUrl,
    this.bio,
    this.websiteUrl,
    this.channelLinks = const [],
    required this.role,
    this.isVerified = false,
    this.creatorStatus,
    this.creatorReviewNote,
    required this.followerCount,
    required this.followingCount,
    required this.videoCount,
    this.viewerFollowing = false,
    this.viewerBlocked = false,
    this.createdAt,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) => UserModel(
        id: json['id'] as String,
        username: json['username'] as String,
        displayName: json['displayName'] as String,
        avatarUrl: json['avatarUrl'] as String?,
        bannerUrl: json['bannerUrl'] as String?,
        bio: json['bio'] as String?,
        websiteUrl: json['websiteUrl'] as String?,
        channelLinks: (json['channelLinks'] as List<dynamic>? ?? [])
            .whereType<Map>()
            .map((e) => ChannelLink.fromJson(Map<String, dynamic>.from(e)))
            .where((l) => l.url.isNotEmpty)
            .toList(),
        role: json['role'] as String? ?? 'user',
        isVerified: json['isVerified'] as bool? ?? false,
        creatorStatus: json['creatorStatus'] as String?,
        creatorReviewNote: json['creatorReviewNote'] as String?,
        followerCount: (json['followerCount'] as num?)?.toInt() ?? 0,
        followingCount: (json['followingCount'] as num?)?.toInt() ?? 0,
        videoCount: (json['videoCount'] as num?)?.toInt() ?? 0,
        viewerFollowing: json['viewerFollowing'] as bool? ?? false,
        viewerBlocked: json['viewerBlocked'] as bool? ?? false,
        createdAt: DateTime.tryParse(json['createdAt'] as String? ?? ''),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'username': username,
        'displayName': displayName,
        'avatarUrl': avatarUrl,
        'bannerUrl': bannerUrl,
        'bio': bio,
        'websiteUrl': websiteUrl,
        'channelLinks': channelLinks.map((e) => e.toJson()).toList(),
        'role': role,
        'isVerified': isVerified,
        'creatorStatus': creatorStatus,
        'creatorReviewNote': creatorReviewNote,
        'followerCount': followerCount,
        'followingCount': followingCount,
        'videoCount': videoCount,
        'viewerFollowing': viewerFollowing,
        'viewerBlocked': viewerBlocked,
        'createdAt': createdAt?.toIso8601String(),
      };
}

class ChannelLink {
  final String title;
  final String url;

  const ChannelLink({required this.title, required this.url});

  factory ChannelLink.fromJson(Map<String, dynamic> json) => ChannelLink(
        title: json['title'] as String? ?? '',
        url: json['url'] as String? ?? '',
      );

  Map<String, dynamic> toJson() => {'title': title, 'url': url};
}
