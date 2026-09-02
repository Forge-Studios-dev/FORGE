import 'package:flutter_test/flutter_test.dart';
import 'package:forge_mobile/core/network/api_envelope.dart';

void main() {
  group('readApiList', () {
    test('unwraps a direct list payload', () {
      final list = readApiList({
        'success': true,
        'data': [
          {'id': 'c1', 'title': 'Intro'},
        ],
      });
      expect(list, hasLength(1));
      expect(list.first['id'], 'c1');
    });

    test('unwraps a nested { data: list } service payload', () {
      final list = readApiList({
        'success': true,
        'data': {
          'data': [
            {'id': 'c2', 'title': 'Advanced'},
          ],
        },
      });
      expect(list.first['title'], 'Advanced');
    });
  });

  group('readApiMap', () {
    test('unwraps a nested program object', () {
      final map = readApiMap({
        'success': true,
        'data': {
          'data': {'id': 'p1', 'name': 'Full Stack'},
        },
      });
      expect(map?['name'], 'Full Stack');
    });

    test('returns a flat object payload', () {
      final map = readApiMap({
        'success': true,
        'data': {'checkoutUrl': 'https://checkout.stripe.com/test'},
      });
      expect(map?['checkoutUrl'], contains('stripe.com'));
    });
  });
}
