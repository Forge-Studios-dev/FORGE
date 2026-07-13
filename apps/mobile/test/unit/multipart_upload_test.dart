import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forge_mobile/features/upload/data/multipart_upload.dart';

import 'test_support/fakes.dart';

void main() {
  late Directory tmpDir;
  late File file;

  setUp(() async {
    tmpDir = await Directory.systemTemp.createTemp('forge_multipart_test');
    file = File('${tmpDir.path}/video.bin');
    // 20 bytes, split into two 10-byte parts.
    await file.writeAsBytes(List.generate(20, (i) => i % 256));
  });

  tearDown(() async {
    if (await tmpDir.exists()) await tmpDir.delete(recursive: true);
  });

  MultipartVideoUpload buildUploader({
    required QueuedAdapter apiAdapter,
    required QueuedAdapter s3Adapter,
  }) {
    final apiDio = Dio()..httpClientAdapter = apiAdapter;
    return MultipartVideoUpload(apiDio, createUploadDio: () => Dio()..httpClientAdapter = s3Adapter);
  }

  group('MultipartVideoUpload.upload', () {
    test('resumes: skips parts already reported complete by the server checkpoint', () async {
      final apiAdapter = QueuedAdapter([
        // GET progress — part 1 already uploaded in a prior, interrupted attempt.
        (_) => jsonResponseBody({
              'data': {
                'completedParts': [
                  {'partNumber': 1, 'etag': 'etag-1'},
                ],
              },
            }, 200),
        // POST parts — only part 2 is still pending, so only it gets a signed URL.
        (req) {
          final body = req.data as Map<String, dynamic>;
          expect(body['partNumbers'], [2]);
          return jsonResponseBody({
            'data': {
              'parts': [
                {'partNumber': 2, 'uploadUrl': 'https://s3.example.com/part2'},
              ],
            },
          }, 200);
        },
        // POST checkpoint after part 2 uploads.
        (req) {
          final body = req.data as Map<String, dynamic>;
          expect(body['parts'], [
            {'partNumber': 2, 'etag': 'etag-2'},
          ]);
          return jsonResponseBody({'data': {}}, 200);
        },
        // POST complete with both parts (the resumed one + the newly uploaded one).
        (req) {
          final body = req.data as Map<String, dynamic>;
          expect(body['parts'], [
            {'partNumber': 1, 'etag': 'etag-1'},
            {'partNumber': 2, 'etag': 'etag-2'},
          ]);
          return jsonResponseBody({'data': {}}, 200);
        },
      ]);
      final s3Adapter = QueuedAdapter([
        (req) {
          expect(req.path, 'https://s3.example.com/part2');
          return ResponseBody.fromString('', 200, headers: {
            'etag': ['etag-2'],
          });
        },
      ]);
      final uploader = buildUploader(apiAdapter: apiAdapter, s3Adapter: s3Adapter);
      final progressUpdates = <int>[];

      await uploader.upload(
        videoId: 'v1',
        filePath: file.path,
        contentType: 'video/mp4',
        partSize: 10,
        partCount: 2,
        onProgress: progressUpdates.add,
      );

      // Only ONE S3 PUT — part 1's checkpoint was honored, it was never re-uploaded.
      expect(s3Adapter.requests, hasLength(1));
      expect(progressUpdates.last, 100);
    });

    test('throws when a part upload response is missing an ETag header', () async {
      final apiAdapter = QueuedAdapter([
        (_) => jsonResponseBody({
              'data': {'completedParts': <dynamic>[]},
            }, 200),
        (_) => jsonResponseBody({
              'data': {
                'parts': [
                  {'partNumber': 1, 'uploadUrl': 'https://s3.example.com/part1'},
                ],
              },
            }, 200),
      ]);
      final s3Adapter = QueuedAdapter([
        (_) => ResponseBody.fromString('', 200), // no ETag header
      ]);
      final uploader = buildUploader(apiAdapter: apiAdapter, s3Adapter: s3Adapter);

      await expectLater(
        uploader.upload(
          videoId: 'v1',
          filePath: file.path,
          contentType: 'video/mp4',
          partSize: 20,
          partCount: 1,
        ),
        throwsA(isA<StateError>()),
      );
    });
  });

  test('isMultipartPresign reads the uploadMode flag', () {
    expect(isMultipartPresign({'uploadMode': 'multipart'}), isTrue);
    expect(isMultipartPresign({'uploadMode': 'direct'}), isFalse);
    expect(isMultipartPresign({}), isFalse);
  });
}
