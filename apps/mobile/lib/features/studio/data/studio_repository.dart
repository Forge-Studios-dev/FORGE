import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import 'dart:io';
import '../../../core/network/api_client.dart';
import '../../../core/network/s3_upload_client.dart';
import '../../../shared/models/video.dart';

final studioRepositoryProvider = Provider<StudioRepository>((ref) {
  return StudioRepository(ref.read(apiClientProvider));
});

/// Default provider for analytics / summary callers (first page, no filters).
final myVideosProvider = FutureProvider.autoDispose<List<VideoModel>>((ref) async {
  final page = await ref.read(studioRepositoryProvider).getMyVideos();
  return page.items;
});

class StudioLibraryPage {
  final List<VideoModel> items;
  final int page;
  final int total;
  final bool hasMore;

  const StudioLibraryPage({
    required this.items,
    required this.page,
    required this.total,
    required this.hasMore,
  });
}

class StudioRepository {
  final ApiClient _api;
  StudioRepository(this._api);

  /// Creator Studio library — paginated, optional search/sort/status/visibility/type/category.
  Future<StudioLibraryPage> getMyVideos({
    String? search,
    String sort = 'recent',
    String? status,
    String? visibility,
    String? videoType,
    String? categoryId,
    bool scheduled = false,
    int page = 1,
    int limit = 24,
  }) async {
    final params = <String, dynamic>{
      'limit': limit,
      'page': page,
      'sort': sort,
    };
    final q = search?.trim();
    if (q != null && q.isNotEmpty) params['search'] = q;
    if (status != null && status.isNotEmpty) params['status'] = status;
    if (visibility != null && visibility.isNotEmpty) params['visibility'] = visibility;
    if (videoType != null && videoType.isNotEmpty) params['videoType'] = videoType;
    if (categoryId != null && categoryId.isNotEmpty) params['categoryId'] = categoryId;
    if (scheduled) params['scheduled'] = 'true';

    final videosRes = await _api.dio.get('/videos/studio', queryParameters: params);
    final data = videosRes.data['data'] as Map<String, dynamic>;
    final list = data['data'] as List? ?? [];
    final pagination = data['pagination'] as Map<String, dynamic>? ?? {};
    return StudioLibraryPage(
      items: list.map((v) => VideoModel.fromJson(v as Map<String, dynamic>)).toList(),
      page: (pagination['page'] as num?)?.toInt() ?? page,
      total: (pagination['total'] as num?)?.toInt() ?? list.length,
      hasMore: pagination['hasMore'] == true,
    );
  }

  Future<VideoModel> getStudioVideo(String videoId) async {
    final res = await _api.dio.get('/videos/$videoId');
    return VideoModel.fromJson(res.data['data'] as Map<String, dynamic>);
  }

  Future<VideoModel> updateVideo(
    String videoId, {
    required String title,
    String? description,
    required String visibility,
    String? videoType,
    String? categoryId,
    String? scheduledPublishAt,
    List<String>? skillTagIds,
  }) async {
    final res = await _api.dio.patch('/videos/$videoId', data: {
      'title': title.trim(),
      'description': (description ?? '').trim().isEmpty ? null : description!.trim(),
      'visibility': visibility,
      if (videoType != null) 'videoType': videoType,
      if (categoryId != null) 'categoryId': categoryId,
      'scheduledPublishAt': scheduledPublishAt,
      if (skillTagIds != null) 'skillTagIds': skillTagIds,
    });
    return VideoModel.fromJson(res.data['data'] as Map<String, dynamic>);
  }

  /// Visibility-only patch (Studio content list quick change).
  Future<void> setVisibility(String videoId, String visibility) async {
    await _api.dio.patch('/videos/$videoId', data: {'visibility': visibility});
  }

  Future<List<Map<String, dynamic>>> getUploadCategoryOptions() async {
    final res = await _api.dio.get('/categories/upload-options');
    final list = res.data['data'] as List? ?? [];
    return list.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
  }

  Future<void> cancelUpload(String videoId) async {
    await _api.dio.post('/videos/$videoId/cancel-upload');
  }

  Future<void> retryTranscode(String videoId) async {
    await _api.dio.post('/videos/$videoId/retry-transcode');
  }

  Future<void> deleteVideo(String videoId) async {
    await _api.dio.delete('/videos/$videoId');
  }

  /// Presign → S3 PUT → attach WebVTT caption track for [language].
  Future<void> uploadCaption({
    required String videoId,
    required String filePath,
    required String language,
  }) async {
    final presignRes = await _api.dio.post(
      '/videos/$videoId/caption/presigned-url',
      data: {'contentType': 'text/vtt', 'language': language},
    );
    final data = presignRes.data['data'] as Map<String, dynamic>;
    final uploadUrl = data['uploadUrl'] as String;
    final publicUrl = data['publicUrl'] as String;

    final put = await createS3UploadDio().put(
      uploadUrl,
      data: await File(filePath).readAsBytes(),
      options: Options(
        headers: {'Content-Type': 'text/vtt'},
        sendTimeout: const Duration(minutes: 5),
        receiveTimeout: const Duration(minutes: 5),
      ),
    );
    if (put.statusCode == null || put.statusCode! < 200 || put.statusCode! >= 300) {
      throw StateError('Caption upload failed (${put.statusCode})');
    }

    await _api.dio.put('/videos/$videoId/caption', data: {
      'captionUrl': publicUrl,
      'language': language,
    });
  }

  Future<void> clearCaption(String videoId, {required String language}) async {
    await _api.dio.put('/videos/$videoId/caption', data: {
      'captionUrl': null,
      'language': language,
    });
  }

  /// Presign → S3 PUT → attach custom thumbnail (works for ready videos too).
  Future<void> uploadThumbnail({
    required String videoId,
    required String filePath,
    required String contentType,
  }) async {
    final allowed = {'image/jpeg', 'image/png', 'image/webp'};
    if (!allowed.contains(contentType)) {
      throw ArgumentError('Thumbnail must be JPEG, PNG, or WebP');
    }
    final presignRes = await _api.dio.post(
      '/videos/$videoId/thumbnail/presigned-url',
      data: {'contentType': contentType},
    );
    final data = presignRes.data['data'] as Map<String, dynamic>;
    final uploadUrl = data['uploadUrl'] as String;
    final publicUrl = data['publicUrl'] as String;

    final put = await createS3UploadDio().put(
      uploadUrl,
      data: await File(filePath).readAsBytes(),
      options: Options(
        headers: {'Content-Type': contentType},
        sendTimeout: const Duration(minutes: 2),
        receiveTimeout: const Duration(minutes: 2),
      ),
    );
    if (put.statusCode == null || put.statusCode! < 200 || put.statusCode! >= 300) {
      throw StateError('Thumbnail upload failed (${put.statusCode})');
    }

    await _api.dio.put('/videos/$videoId/thumbnail', data: {
      'thumbnailUrl': publicUrl,
    });
  }

  Future<void> clearThumbnail(String videoId) async {
    await _api.dio.put('/videos/$videoId/thumbnail', data: {
      'thumbnailUrl': null,
    });
  }

  Future<Map<String, dynamic>> getMe() async {
    final res = await _api.dio.get('/users/me');
    return res.data['data'] as Map<String, dynamic>;
  }

  /// Studio comments inbox — cursor-paginated across all owned videos.
  Future<StudioCommentsPage> getStudioComments({
    String filter = 'all',
    String? q,
    int limit = 40,
    String? cursor,
  }) async {
    final params = <String, dynamic>{'limit': limit};
    if (filter != 'all') params['filter'] = filter;
    final term = q?.trim();
    if (term != null && term.length >= 2) params['q'] = term;
    if (cursor != null && cursor.isNotEmpty) params['cursor'] = cursor;

    final res = await _api.dio.get('/creators/me/comments', queryParameters: params);
    final payload = res.data['data'] as Map<String, dynamic>? ?? {};
    final list = payload['data'] as List? ?? [];
    final meta = payload['meta'] as Map<String, dynamic>? ?? {};
    return StudioCommentsPage(
      items: list.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList(),
      nextCursor: meta['cursor'] as String?,
      hasMore: meta['hasMore'] == true,
    );
  }

  /// @deprecated Prefer [getStudioComments].
  Future<List<Map<String, dynamic>>> getRecentComments() async {
    final page = await getStudioComments(limit: 50);
    return page.items;
  }

  /// Unified community-report inbox across owned + moderated communities.
  Future<StudioModerationInboxPage> getModerationInbox({
    String status = 'open',
    int limit = 30,
    String? cursor,
  }) async {
    final params = <String, dynamic>{'limit': limit};
    if (status != 'open') params['status'] = status;
    if (cursor != null && cursor.isNotEmpty) params['cursor'] = cursor;

    final res = await _api.dio.get(
      '/creators/me/moderation/inbox',
      queryParameters: params,
    );
    final payload = res.data['data'] as Map<String, dynamic>? ?? {};
    final list = payload['data'] as List? ?? [];
    final meta = payload['meta'] as Map<String, dynamic>? ?? {};
    return StudioModerationInboxPage(
      items: list.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList(),
      nextCursor: meta['cursor'] as String?,
      hasMore: meta['hasMore'] == true,
      total: (meta['total'] as num?)?.toInt() ?? list.length,
    );
  }
}

class StudioCommentsPage {
  final List<Map<String, dynamic>> items;
  final String? nextCursor;
  final bool hasMore;

  const StudioCommentsPage({
    required this.items,
    required this.nextCursor,
    required this.hasMore,
  });
}

class StudioModerationInboxPage {
  final List<Map<String, dynamic>> items;
  final String? nextCursor;
  final bool hasMore;
  final int total;

  const StudioModerationInboxPage({
    required this.items,
    required this.nextCursor,
    required this.hasMore,
    required this.total,
  });
}
