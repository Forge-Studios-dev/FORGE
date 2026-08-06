/// Public viewer route for a video — Shorts open the vertical feed.
String publicVideoPath({
  required String id,
  String? videoType,
  int? progressSeconds,
}) {
  if (videoType == 'short') return '/shorts?v=$id';
  if (progressSeconds != null && progressSeconds > 5) {
    return '/watch/$id?t=$progressSeconds';
  }
  return '/watch/$id';
}
