import 'package:flutter_quill/quill_delta.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:novelist_workspace/editor/html_codec.dart';

String roundTrip(String html) =>
    HtmlCodec.deltaToHtml(HtmlCodec.htmlToDelta(html));

void main() {
  group('what the web editor writes comes back unchanged', () {
    const same = <String, String>{
      'plain paragraph': '<p>Hello there.</p>',
      'inline marks': '<p>Plain <strong>bold</strong> and <em>italic</em> and <mark>lit</mark> and <s>gone</s> and <u>under</u>.</p>',
      'nested marks': '<p><strong><em>both</em></strong></p>',
      'headings': '<h1>Heading</h1><h2>Sub</h2><h3>Third</h3><p>Body</p>',
      'blockquote': '<blockquote><p>Quoted text</p></blockquote>',
      'multi-paragraph quote': '<blockquote><p>One</p><p>Two</p></blockquote>',
      'bullets': '<ul><li><p>one</p></li><li><p>two</p></li></ul>',
      'numbers': '<ol><li><p>a</p></li><li><p>b</p></li></ol>',
      'nested list': '<ul><li><p>a</p><ul><li><p>b</p></li><li><p>c</p></li></ul></li><li><p>d</p></li></ul>',
      'alignment': '<p style="text-align: center">Centered</p><p style="text-align: right">Right</p><p style="text-align: justify">Justified</p>',
      'aligned heading': '<h2 style="text-align: center">Part One</h2>',
      'scene break': '<p>Before</p><hr><p>After</p>',
      'break at the end': '<p>The end.</p><hr><p></p>',
      'blank paragraphs': '<p>One</p><p></p><p></p><p>Two</p>',
      'soft line break': '<p>Line one<br>line two</p>',
      'link':
          '<p>See <a href="https://example.com/a?b=1&amp;c=2">this</a>.</p>',
      'special characters':
          '<p>Fish &amp; chips &lt;3 &gt; “quotes” — dashes…</p>',
      'sub and sup': '<p>H<sub>2</sub>O and x<sup>2</sup></p>',
      'mention': '<p>The <span data-type="mention" class="mention" data-id="abc-123" data-label="Mara Voss" data-mention-suggestion-char="@">@Mara Voss</span> walked.</p>',
      'mention in bold': '<p><strong>Hi <span data-type="mention" class="mention" data-id="1" data-label="Ada" data-mention-suggestion-char="@">@Ada</span></strong></p>',
    };
    for (final e in same.entries) {
      test(e.key, () => expect(roundTrip(e.value), e.value));
    }
  });

  group('things the editor cannot represent are kept as they were', () {
    const kept = <String, String>{
      'table': '<table><tbody><tr><td>cell</td></tr></tbody></table>',
      'image in a paragraph':
          '<p>Look <img src="https://example.com/a.png" alt="a"> here</p>',
      'code block': '<pre><code>let x = 1;</code></pre>',
      'heading four': '<h4>Deep</h4>',
      'div': '<div class="note">custom</div>',
      'list with two paragraphs in an item':
          '<ul><li><p>one</p><p>two</p></li></ul>',
    };
    for (final e in kept.entries) {
      test(e.key, () => expect(roundTrip(e.value), e.value));
    }

    test('protected blocks sit between ordinary ones without disturbing them', () {
      const html =
          '<p>Before</p><table><tbody><tr><td>x</td></tr></tbody></table><p>After</p>';
      expect(roundTrip(html), html);
    });
  });

  group('forgiving about how the HTML is written', () {
    test(
      'bold written as <b> and italic as <i> come back as strong and em',
      () {
        expect(
          roundTrip('<p><b>x</b> <i>y</i></p>'),
          '<p><strong>x</strong> <em>y</em></p>',
        );
      },
    );
    test('mention attributes in a different order are still recognised', () {
      final a = HtmlCodec.htmlToDelta(
        '<p><span data-id="9" data-type="mention" data-label="Ines">@Ines</span></p>',
      );
      final b = HtmlCodec.htmlToDelta(
        '<p><span data-type="mention" class="mention" data-id="9" data-label="Ines" data-mention-suggestion-char="@">@Ines</span></p>',
      );
      expect(a.toJson(), b.toJson());
    });
    test('newlines inside a paragraph do not split it', () {
      expect(roundTrip('<p>one\ntwo</p>'), '<p>one two</p>');
    });
    test('stray text outside any tag becomes a paragraph', () {
      expect(roundTrip('just words'), '<p>just words</p>');
    });
    test('empty content gives one empty paragraph that is not lost', () {
      expect(HtmlCodec.htmlToDelta('').toJson(), [
        {'insert': '\n'},
      ]);
      expect(roundTrip(''), '<p></p>');
    });
  });

  group('the document is always valid for the editor', () {
    for (final html in [
      '<hr>',
      '<p>a</p><hr>',
      '<table><tr><td>x</td></tr></table>',
      '<p>x</p>',
      '',
    ]) {
      test('ends with a line break: "$html"', () {
        final delta = HtmlCodec.htmlToDelta(html);
        final last = delta.last.data;
        expect(last is String && last.endsWith('\n'), isTrue);
      });
    }
  });

  group('stable: converting twice changes nothing more', () {
    final samples = [
      '<p>a <strong>b</strong></p><hr><ul><li><p>x</p></li></ul>',
      '<blockquote><p>q</p></blockquote><h2>h</h2><p style="text-align: center">c</p>',
      '<p>1</p><table><tr><td>t</td></tr></table><p>2</p>',
      '<p>Line<br>break</p>',
    ];
    for (var i = 0; i < samples.length; i++) {
      test('sample $i', () {
        final once = roundTrip(samples[i]);
        expect(roundTrip(once), once);
      });
    }
  });

  group('editing a chapter changes only what was edited', () {
    test('typing into one paragraph leaves a scene break, a mention and a table alone', () {
      const original =
          '<p>First <span data-type="mention" class="mention" data-id="7" data-label="Ada" data-mention-suggestion-char="@">@Ada</span> line.</p><hr><p>Second</p><table><tbody><tr><td>t</td></tr></tbody></table>';
      final delta = HtmlCodec.htmlToDelta(original);
      // Append " more" to the "Second" paragraph, the way the editor would
      final json = delta.toJson();
      final idx = json.indexWhere(
        (op) =>
            op['insert'] is String &&
            (op['insert'] as String).contains('Second'),
      );
      expect(idx, greaterThan(-1));
      json[idx] = {
        'insert': (json[idx]['insert'] as String).replaceFirst(
          'Second',
          'Second more',
        ),
      };
      final result = HtmlCodec.deltaToHtml(Delta.fromJson(json));
      expect(result, original.replaceFirst('Second', 'Second more'));
    });
  });

  group('word counts match the web app', () {
    test('counts words after stripping tags', () {
      expect(HtmlCodec.countWords('<p>One two</p><p>three</p>'), 3);
    });
    test('a mention counts as a word', () {
      expect(
        HtmlCodec.countWords('<p>Hi <span data-type="mention">@Ada</span></p>'),
        2,
      );
    });
    test('empty is zero', () {
      expect(HtmlCodec.countWords(''), 0);
      expect(HtmlCodec.countWords('<p></p>'), 0);
    });
    test('entities are decoded the same way', () {
      expect(HtmlCodec.plainText('<p>a&nbsp;b &amp; c</p>'), 'a b & c');
    });
  });
}
