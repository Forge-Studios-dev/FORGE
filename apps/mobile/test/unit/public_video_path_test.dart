import 'package:flutter_test/flutter_test.dart';
import 'package:forge_mobile/core/navigation/public_video_path.dart';

void main() {
  test('shorts open vertical feed', () {
    expect(publicVideoPath(id: 's1', videoType: 'short'), '/shorts?v=s1');
  });

  test('videos use watch with optional progress', () {
    expect(publicVideoPath(id: 'v1'), '/watch/v1');
    expect(publicVideoPath(id: 'v1', progressSeconds: 12), '/watch/v1?t=12');
    expect(publicVideoPath(id: 'v1', progressSeconds: 3), '/watch/v1');
  });
}
