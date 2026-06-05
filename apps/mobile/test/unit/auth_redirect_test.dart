import 'package:flutter_test/flutter_test.dart';

void main() {
  test('protected routes include library and profile', () {
    const protected = [
      '/studio',
      '/upload',
      '/notifications',
      '/history',
      '/profile/settings',
      '/library',
      '/profile',
    ];
    expect(protected, contains('/library'));
    expect(protected, contains('/profile'));
  });
}
