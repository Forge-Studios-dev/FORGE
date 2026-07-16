import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage_platform_interface/flutter_secure_storage_platform_interface.dart';

/// In-memory FlutterSecureStorage backend (HIGH-09) — avoids the real
/// plugin's platform channel, which has no implementation under
/// `flutter test`. Install with:
///   FlutterSecureStoragePlatform.instance = FakeSecureStoragePlatform(data);
class FakeSecureStoragePlatform extends FlutterSecureStoragePlatform {
  final Map<String, String> data;
  FakeSecureStoragePlatform(this.data);

  @override
  Future<bool> containsKey({required String key, required Map<String, String> options}) async =>
      data.containsKey(key);

  @override
  Future<void> delete({required String key, required Map<String, String> options}) async =>
      data.remove(key);

  @override
  Future<void> deleteAll({required Map<String, String> options}) async => data.clear();

  @override
  Future<String?> read({required String key, required Map<String, String> options}) async =>
      data[key];

  @override
  Future<Map<String, String>> readAll({required Map<String, String> options}) async => data;

  @override
  Future<void> write({
    required String key,
    required String value,
    required Map<String, String> options,
  }) async =>
      data[key] = value;
}

/// Replays a fixed queue of responses in order and records every request
/// that passed through it — a small enough seam to fake Dio's
/// [HttpClientAdapter] directly, no HTTP-mocking package needed.
class QueuedAdapter implements HttpClientAdapter {
  QueuedAdapter(this._responses);

  final List<ResponseBody Function(RequestOptions)> _responses;
  final List<RequestOptions> requests = [];
  int _cursor = 0;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    if (_cursor >= _responses.length) {
      throw StateError('No queued response for ${options.method} ${options.path}');
    }
    return _responses[_cursor++](options);
  }

  @override
  void close({bool force = false}) {}
}

/// Builds a JSON [ResponseBody] for a [QueuedAdapter] entry.
ResponseBody jsonResponseBody(Map<String, dynamic> body, int statusCode) => ResponseBody.fromString(
      jsonEncode(body),
      statusCode,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
