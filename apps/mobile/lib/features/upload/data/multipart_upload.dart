import 'dart:io';

import 'package:dio/dio.dart';

/// S3 multipart upload for large videos (API flag `multipart_upload`, >= 50MB).
class MultipartVideoUpload {
  /// [createUploadDio] is a test seam (HIGH-09) for the per-part S3 PUT —
  /// real callers never pass it, so production behavior is unchanged.
  MultipartVideoUpload(this._dio, {Dio Function()? createUploadDio})
      : _createUploadDio = createUploadDio ?? (() => Dio());

  final Dio _dio;
  final Dio Function() _createUploadDio;
  static const partUrlBatch = 10;
  static const concurrency = 3;

  Future<void> upload({
    required String videoId,
    required String filePath,
    required String contentType,
    required int partSize,
    required int partCount,
    void Function(int percent)? onProgress,
  }) async {
    final file = File(filePath);
    final etags = <int, String>{};

    final progressRes = await _dio.get('/videos/$videoId/multipart/progress');
    final remote = progressRes.data['data']['completedParts'] as List<dynamic>? ?? [];
    for (final p in remote) {
      etags[p['partNumber'] as int] = p['etag'] as String;
    }

    final pending = List.generate(partCount, (i) => i + 1)
        .where((n) => !etags.containsKey(n))
        .toList();

    for (var i = 0; i < pending.length; i += partUrlBatch) {
      final batch = pending.skip(i).take(partUrlBatch).toList();
      final partsRes = await _dio.post(
        '/videos/$videoId/multipart/parts',
        data: {'partNumbers': batch},
      );
      final signed = partsRes.data['data']['parts'] as List<dynamic>;

      final queue = List<Map<String, dynamic>>.from(
        signed.map((e) => e as Map<String, dynamic>),
      );
      final workers = List.generate(
        concurrency.clamp(1, queue.length),
        (_) => _uploadWorker(
          queue: queue,
          file: file,
          partSize: partSize,
          contentType: contentType,
          etags: etags,
          partCount: partCount,
          videoId: videoId,
          onProgress: onProgress,
        ),
      );
      await Future.wait(workers);
    }

    if (etags.length != partCount) {
      throw StateError('Multipart incomplete (${etags.length}/$partCount)');
    }

    final parts = List.generate(
      partCount,
      (i) => {'partNumber': i + 1, 'etag': etags[i + 1]!},
    );
    await _dio.post('/videos/$videoId/multipart/complete', data: {'parts': parts});
    onProgress?.call(100);
  }

  Future<void> _uploadWorker({
    required List<Map<String, dynamic>> queue,
    required File file,
    required int partSize,
    required String contentType,
    required Map<int, String> etags,
    required int partCount,
    required String videoId,
    void Function(int percent)? onProgress,
  }) async {
    while (queue.isNotEmpty) {
      final next = queue.removeAt(0);
      final partNumber = next['partNumber'] as int;
      final uploadUrl = next['uploadUrl'] as String;
      final start = (partNumber - 1) * partSize;
      final fileLen = await file.length();
      final end = start + partSize > fileLen ? fileLen : start + partSize;
      final stream = file.openRead(start, end);

      final res = await _createUploadDio().put(
        uploadUrl,
        data: stream,
        options: Options(
          headers: {'Content-Type': contentType},
          sendTimeout: const Duration(minutes: 15),
          receiveTimeout: const Duration(minutes: 15),
        ),
      );
      final etag = res.headers.value('etag') ?? res.headers.value('ETag');
      if (etag == null || etag.isEmpty) {
        throw StateError('Part $partNumber missing ETag');
      }
      etags[partNumber] = etag;
      await _dio.post(
        '/videos/$videoId/multipart/checkpoint',
        data: {
          'parts': [
            {'partNumber': partNumber, 'etag': etag},
          ],
        },
      );
      onProgress?.call((etags.length * 99 / partCount).round());
    }
  }
}

bool isMultipartPresign(Map<String, dynamic> presign) {
  return presign['uploadMode'] == 'multipart';
}
