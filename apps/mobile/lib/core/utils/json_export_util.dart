import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:share_plus/share_plus.dart';

/// Downloads authenticated JSON from the API and opens the platform share sheet.
class JsonExportUtil {
  static Future<void> downloadAndShare({
    required Dio dio,
    required String apiPath,
    required String filename,
  }) async {
    final response = await dio.get(apiPath);
    final payload = response.data is Map && (response.data as Map)['data'] != null
        ? (response.data as Map)['data']
        : response.data;
    final text = const JsonEncoder.withIndent('  ').convert(payload);

    final safeName = filename.replaceAll(RegExp(r'[^\w.\-]+'), '_');
    final file = File('${Directory.systemTemp.path}/$safeName');
    await file.writeAsString(text, flush: true);

    await SharePlus.instance.share(
      ShareParams(
        files: [XFile(file.path, mimeType: 'application/json', name: safeName)],
        subject: safeName,
      ),
    );
  }
}
