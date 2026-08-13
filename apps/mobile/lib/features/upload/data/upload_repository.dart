import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/s3_upload_client.dart';
import 'multipart_upload.dart';

final uploadRepositoryProvider = Provider<UploadRepository>((ref) {
  return UploadRepository(ref.read(apiClientProvider));
});

/// Persisted state for an in-flight multipart video upload, so it can be
/// resumed after the app returns to the foreground (or is relaunched) mid
/// transfer instead of silently losing progress.
///
/// This is **not** true OS-level background upload — nothing keeps
/// transferring bytes while the app is backgrounded/killed. It only records
/// enough (the video id, the already-agreed part plan, and the original
/// form fields) that a later foreground session can pick the same upload
/// back up: `MultipartVideoUpload.upload` already asks the API which parts
/// are already committed (`/multipart/progress`) and only re-sends the
/// missing ones, so resuming is cheap and safe to call repeatedly.
class PendingUpload {
  final String videoId;
  final String filePath;
  final String contentType;
  final int partSize;
  final int partCount;
  final String title;
  final String description;
  final String categoryId;
  final List<String> skillTagIds;
  final String visibility;
  final String videoType;
  final String? scheduledPublishAt;
  final String? thumbnailPath;
  final String? thumbnailContentType;
  final List<String> playlistIds;
  final bool backgrounded;

  const PendingUpload({
    required this.videoId,
    required this.filePath,
    required this.contentType,
    required this.partSize,
    required this.partCount,
    required this.title,
    required this.description,
    required this.categoryId,
    required this.skillTagIds,
    required this.visibility,
    this.videoType = 'video',
    this.scheduledPublishAt,
    this.thumbnailPath,
    this.thumbnailContentType,
    this.playlistIds = const [],
    this.backgrounded = false,
  });

  PendingUpload copyWith({bool? backgrounded}) => PendingUpload(
        videoId: videoId,
        filePath: filePath,
        contentType: contentType,
        partSize: partSize,
        partCount: partCount,
        title: title,
        description: description,
        categoryId: categoryId,
        skillTagIds: skillTagIds,
        visibility: visibility,
        videoType: videoType,
        scheduledPublishAt: scheduledPublishAt,
        thumbnailPath: thumbnailPath,
        thumbnailContentType: thumbnailContentType,
        playlistIds: playlistIds,
        backgrounded: backgrounded ?? this.backgrounded,
      );

  Map<String, dynamic> toJson() => {
        'videoId': videoId,
        'filePath': filePath,
        'contentType': contentType,
        'partSize': partSize,
        'partCount': partCount,
        'title': title,
        'description': description,
        'categoryId': categoryId,
        'skillTagIds': skillTagIds,
        'visibility': visibility,
        'videoType': videoType,
        'scheduledPublishAt': scheduledPublishAt,
        'thumbnailPath': thumbnailPath,
        'thumbnailContentType': thumbnailContentType,
        'playlistIds': playlistIds,
        'backgrounded': backgrounded,
      };

  factory PendingUpload.fromJson(Map<String, dynamic> json) => PendingUpload(
        videoId: json['videoId'] as String,
        filePath: json['filePath'] as String,
        contentType: json['contentType'] as String,
        partSize: json['partSize'] as int,
        partCount: json['partCount'] as int,
        title: json['title'] as String,
        description: json['description'] as String,
        categoryId: json['categoryId'] as String,
        skillTagIds: (json['skillTagIds'] as List).cast<String>(),
        visibility: json['visibility'] as String,
        videoType: json['videoType'] as String? ?? 'video',
        scheduledPublishAt: json['scheduledPublishAt'] as String?,
        thumbnailPath: json['thumbnailPath'] as String?,
        thumbnailContentType: json['thumbnailContentType'] as String?,
        playlistIds: (json['playlistIds'] as List?)?.cast<String>() ?? const [],
        backgrounded: json['backgrounded'] as bool? ?? false,
      );
}

class UploadRepository {
  final ApiClient _client;
  UploadRepository(this._client);

  // Reuses the same FlutterSecureStorage instance/pattern as the rest of
  // the app (api_client.dart, auth_repository.dart) instead of adding a new
  // local-storage dependency for this session state.
  static const _storage = FlutterSecureStorage();

  static const maxBytes = 500 * 1024 * 1024;
  static const allowedTypes = {'video/mp4', 'video/quicktime'};

  Future<String> uploadVideo({
    required String filePath,
    required String contentType,
    required int fileSizeBytes,
    required String title,
    required String description,
    required String categoryId,
    required List<String> skillTagIds,
    required String visibility,
    String videoType = 'video',
    String? scheduledPublishAt,
    String? thumbnailPath,
    String? thumbnailContentType,
    List<String> playlistIds = const [],
    void Function(int percent)? onProgress,
  }) async {
    final presignRes = await _client.dio.post('/videos/presigned-url', data: {
      'contentType': contentType,
      'fileSizeBytes': fileSizeBytes,
    });
    final presign = presignRes.data['data'] as Map<String, dynamic>;
    final videoId = presign['videoId'] as String;

    // Custom thumb must land while status=UPLOADING (before /complete).
    if (thumbnailPath != null && thumbnailContentType != null) {
      await _uploadCustomThumbnail(
        videoId: videoId,
        filePath: thumbnailPath,
        contentType: thumbnailContentType,
      );
    }

    if (isMultipartPresign(presign)) {
      final partSize = presign['partSize'] as int;
      final partCount = presign['partCount'] as int;
      // Persist before the transfer starts: if the app is backgrounded or
      // killed mid-upload, this is what lets a later session resume the
      // *same* video/part plan instead of presigning a brand new video.
      await _savePendingUpload(PendingUpload(
        videoId: videoId,
        filePath: filePath,
        contentType: contentType,
        partSize: partSize,
        partCount: partCount,
        title: title,
        description: description,
        categoryId: categoryId,
        skillTagIds: skillTagIds,
        visibility: visibility,
        videoType: videoType,
        scheduledPublishAt: scheduledPublishAt,
        thumbnailPath: thumbnailPath,
        thumbnailContentType: thumbnailContentType,
        playlistIds: playlistIds,
      ));
      await MultipartVideoUpload(_client.dio).upload(
        videoId: videoId,
        filePath: filePath,
        contentType: contentType,
        partSize: partSize,
        partCount: partCount,
        onProgress: onProgress,
      );
    } else {
      // Small files (below the multipart threshold) go up as a single PUT —
      // not incrementally resumable, so an interruption here means starting
      // the whole PUT over. No resumable session is persisted for this path.
      final uploadUrl = presign['uploadUrl'] as String;
      await _client.dio.put(
        uploadUrl,
        data: File(filePath).openRead(),
        options: Options(
          headers: {'Content-Type': contentType},
          sendTimeout: const Duration(minutes: 30),
          receiveTimeout: const Duration(minutes: 30),
        ),
        onSendProgress: onProgress != null
            ? (sent, total) {
                if (total > 0) onProgress((sent * 100 / total).round());
              }
            : null,
      );
    }

    await _completeUpload(
      videoId: videoId,
      title: title,
      description: description,
      visibility: visibility,
      categoryId: categoryId,
      skillTagIds: skillTagIds,
      videoType: videoType,
      scheduledPublishAt: scheduledPublishAt,
      playlistIds: playlistIds,
    );
    await clearResumableUpload();
    return videoId;
  }

  /// Resumes a multipart upload persisted by [uploadVideo]. Safe to call
  /// any time after a [PendingUpload] exists — `MultipartVideoUpload.upload`
  /// re-queries which parts the API already has and only sends what's
  /// missing, so this works whether the app was merely backgrounded or
  /// fully killed and relaunched.
  Future<String> resumePendingUpload({void Function(int percent)? onProgress}) async {
    final pending = await getPendingUpload();
    if (pending == null) {
      throw StateError('No resumable upload found.');
    }
    await MultipartVideoUpload(_client.dio).upload(
      videoId: pending.videoId,
      filePath: pending.filePath,
      contentType: pending.contentType,
      partSize: pending.partSize,
      partCount: pending.partCount,
      onProgress: onProgress,
    );
    // Best-effort re-PUT if thumb wasn't uploaded before interrupt.
    if (pending.thumbnailPath != null && pending.thumbnailContentType != null) {
      try {
        await _uploadCustomThumbnail(
          videoId: pending.videoId,
          filePath: pending.thumbnailPath!,
          contentType: pending.thumbnailContentType!,
        );
      } catch (_) {}
    }
    await _completeUpload(
      videoId: pending.videoId,
      title: pending.title,
      description: pending.description,
      visibility: pending.visibility,
      categoryId: pending.categoryId,
      skillTagIds: pending.skillTagIds,
      videoType: pending.videoType,
      scheduledPublishAt: pending.scheduledPublishAt,
      playlistIds: pending.playlistIds,
    );
    await clearResumableUpload();
    return pending.videoId;
  }

  Future<void> _completeUpload({
    required String videoId,
    required String title,
    required String description,
    required String visibility,
    required String categoryId,
    required List<String> skillTagIds,
    String videoType = 'video',
    String? scheduledPublishAt,
    List<String> playlistIds = const [],
  }) async {
    await _client.dio.post('/videos/$videoId/complete', data: {
      'title': title.trim(),
      if (description.trim().isNotEmpty) 'description': description.trim(),
      'visibility': visibility,
      'categoryId': categoryId,
      'skillTagIds': skillTagIds,
      'videoType': videoType == 'short' ? 'short' : 'video',
      if (scheduledPublishAt != null) 'scheduledPublishAt': scheduledPublishAt,
      if (playlistIds.isNotEmpty) 'playlistIds': playlistIds,
    });
  }

  Future<void> _uploadCustomThumbnail({
    required String videoId,
    required String filePath,
    required String contentType,
  }) async {
    final allowed = {'image/jpeg', 'image/png', 'image/webp'};
    if (!allowed.contains(contentType)) {
      throw ArgumentError('Thumbnail must be JPEG, PNG, or WebP');
    }
    final presignRes = await _client.dio.post(
      '/videos/$videoId/thumbnail/presigned-url',
      data: {'contentType': contentType},
    );
    final uploadUrl = presignRes.data['data']['uploadUrl'] as String;
    final publicUrl = presignRes.data['data']['publicUrl'] as String?;
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
    if (publicUrl != null && publicUrl.isNotEmpty) {
      await _client.dio.put('/videos/$videoId/thumbnail', data: {
        'thumbnailUrl': publicUrl,
      });
    }
  }

  Future<void> _savePendingUpload(PendingUpload pending) async {
    await _storage.write(
      key: AppConstants.pendingUploadKey,
      value: jsonEncode(pending.toJson()),
    );
  }

  /// Marks the persisted upload session as interrupted-by-backgrounding, so
  /// the next time the upload screen is opened it can show a clear "upload
  /// paused — reopen the app to continue" state instead of just failing
  /// silently. Called from the UI's `WidgetsBindingObserver` on
  /// `AppLifecycleState.paused` while a transfer is active.
  ///
  /// Best-effort only: this does not keep uploading in the background —
  /// mobile OSes suspend/kill network activity for backgrounded apps
  /// without special entitlements (true background transfer would need
  /// WorkManager/native background URLSession, out of scope here).
  Future<void> markBackgrounded() async {
    final pending = await getPendingUpload();
    if (pending == null) return;
    await _savePendingUpload(pending.copyWith(backgrounded: true));
  }

  Future<PendingUpload?> getPendingUpload() async {
    final raw = await _storage.read(key: AppConstants.pendingUploadKey);
    if (raw == null || raw.isEmpty) return null;
    try {
      return PendingUpload.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  Future<void> clearResumableUpload() async {
    await _storage.delete(key: AppConstants.pendingUploadKey);
  }
}
