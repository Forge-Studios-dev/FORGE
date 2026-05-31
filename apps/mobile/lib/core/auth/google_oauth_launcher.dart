import 'package:url_launcher/url_launcher.dart';
import '../platform/platform_config.dart';

Future<void> launchGoogleOAuthSignIn() async {
  final uri = Uri.parse(googleOAuthStartUrl());
  if (!await canLaunchUrl(uri)) {
    throw Exception('Cannot open Google sign-in URL');
  }
  await launchUrl(uri, mode: LaunchMode.externalApplication);
}
