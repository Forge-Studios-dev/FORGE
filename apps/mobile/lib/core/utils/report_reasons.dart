import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../constants/app_constants.dart';

/// Canonical video report reasons — keep aligned with `@forge/shared-types` VIDEO_REPORT_REASONS.
const kVideoReportReasons = <String>[
  'Spam or misleading',
  'Hate speech or harassment',
  'Sexual content',
  'Violent or repulsive content',
  'Harmful or dangerous acts',
  'Child abuse',
  'Promotes terrorism',
  'Copyright infringement',
  'Privacy violation',
  'Other',
];

const kCopyrightInfringementReason = 'Copyright infringement';

/// Opens the web DMCA notice form for [videoId]. Returns true if launched.
Future<bool> openCopyrightNoticeForm(String videoId) async {
  final uri = Uri.parse(
    '${AppConstants.webBaseUrl}/copyright/notice?videoId=${Uri.encodeComponent(videoId)}',
  );
  if (!await canLaunchUrl(uri)) return false;
  return launchUrl(uri, mode: LaunchMode.externalApplication);
}

/// If [reason] is copyright, opens the DMCA form and returns true (caller should not POST /reports).
Future<bool> handleCopyrightReportIfNeeded({
  required BuildContext context,
  required String videoId,
  required String reason,
}) async {
  if (reason != kCopyrightInfringementReason) return false;
  final launched = await openCopyrightNoticeForm(videoId);
  if (!context.mounted) return true;
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      content: Text(
        launched
            ? 'Copyright claims use the DMCA notice form — opened in your browser.'
            : 'Open the copyright notice form on the website to file a DMCA claim.',
      ),
    ),
  );
  return true;
}
