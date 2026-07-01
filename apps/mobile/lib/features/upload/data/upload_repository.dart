import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import 'multipart_upload.dart';

final uploadRepositoryProvider = Provider<UploadRepository>((ref) {
  return UploadRepository(ref.read(apiClientProvider));
});

class UploadRepository {
  final ApiClient _client;
  UploadRepository(this._client);

  static const maxBytes = 500 * 1024 * 1024;
  static const allowedTypes = {'video/mp4', 'video/quicktime'};

  Future<String> uploadLesson({
    required String filePath,
    required String contentType,
    required int fileSizeBytes,
    required String title,
    required String description,
    required String categoryId,
    required List<String> skillTagIds,
    required String visibility,
    void Function(int percent)? onProgress,
  }) async {
    final presignRes = await _client.dio.post('/videos/presigned-url', data: {
      'contentType': contentType,
      'fileSizeBytes': fileSizeBytes,
    });
    final presign = presignRes.data['data'] as Map<String, dynamic>;
    final videoId = presign['videoId'] as String;

    if (isMultipartPresign(presign)) {
      await MultipartVideoUpload(_client.dio).upload(
        videoId: videoId,
        filePath: filePath,
        contentType: contentType,
        partSize: presign['partSize'] as int,
        partCount: presign['partCount'] as int,
        onProgress: onProgress,
      );
    } else {
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

    await _client.dio.post('/videos/$videoId/complete', data: {
      'title': title.trim(),
      if (description.trim().isNotEmpty) 'description': description.trim(),
      'visibility': visibility,
      'categoryId': categoryId,
      'skillTagIds': skillTagIds,
    });

    return videoId;
  }
}
