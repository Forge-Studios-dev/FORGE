import 'dart:io';

import 'package:dio/dio.dart';
import 'package:share_plus/share_plus.dart';

/// Downloads an authenticated CSV export from the API and opens the platform share sheet.
class CsvExportUtil {
  static Future<void> downloadAndShare({
    required Dio dio,
    required String apiPath,
    required String filename,
  }) async {
    final response = await dio.get<List<int>>(
      apiPath,
      options: Options(responseType: ResponseType.bytes),
    );
    final bytes = response.data;
    if (bytes == null || bytes.isEmpty) {
      throw StateError('Export returned no data');
    }

    final safeName = filename.replaceAll(RegExp(r'[^\w.\-]+'), '_');
    final file = File('${Directory.systemTemp.path}/$safeName');
    await file.writeAsBytes(bytes, flush: true);

    await SharePlus.instance.share(
      ShareParams(
        files: [XFile(file.path, mimeType: 'text/csv', name: safeName)],
        subject: safeName,
      ),
    );
  }

  static Future<void> shareCsvText({
    required String csv,
    required String filename,
  }) async {
    final safeName = filename.replaceAll(RegExp(r'[^\w.\-]+'), '_');
    final file = File('${Directory.systemTemp.path}/$safeName');
    await file.writeAsString(csv, flush: true);
    await SharePlus.instance.share(
      ShareParams(
        files: [XFile(file.path, mimeType: 'text/csv', name: safeName)],
        subject: safeName,
      ),
    );
  }
}
