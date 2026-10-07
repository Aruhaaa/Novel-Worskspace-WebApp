import 'package:flutter_quill/quill_delta.dart';
import 'package:html/dom.dart' as dom;
import 'package:html/parser.dart' as html_parser;

/// Converts between the HTML the web editor (Tiptap) stores and the Delta the phone editor (Quill) edits.
///
/// Chapters are shared between the web app and this app, so a chapter written on the web must come back
/// from the phone exactly as it was, apart from the edits. Generic converters flatten scene breaks,
/// highlights and @mentions, so this one is written for exactly what the web editor produces, and anything
/// it does not understand is kept as a protected "raw" block and written back untouched.
class HtmlCodec {
  HtmlCodec._();

  /// A highlight is a background colour in the editor; it is written back as <mark>.
  static const highlightColor = '#ffe066';

  /// Replaces a soft line break (<br>) inside a paragraph, which the editor has no way to store as a character.
  static const softBreak = ' ';

  static const mentionKey = 'mention';
  static const rawKey = 'raw';
  static const dividerKey = 'divider';

  // ---------------------------------------------------------------------------------------------
  // HTML -> Delta
  // ---------------------------------------------------------------------------------------------

  static Delta htmlToDelta(String html) {
    final delta = Delta();
    final fragment = html_parser.parseFragment(html);
    for (final node in fragment.nodes) {
      _block(node, delta);
    }
    // A document must end with a line break
    if (delta.isEmpty) delta.insert('\n');
    return delta;
  }

  static void _block(dom.Node node, Delta out) {
    if (node is dom.Text) {
      if (node.text.trim().isEmpty) return;
      _paragraph([node], out, null);
      return;
    }
    if (node is! dom.Element) return;
    final tag = node.localName ?? '';
    switch (tag) {
      case 'p':
        if (!_paragraph(node.nodes, out, _align(node))) _raw(node, out);
      case 'h1':
      case 'h2':
      case 'h3':
        final level = int.parse(tag.substring(1));
        final ops = Delta();
        if (_inline(node.nodes, ops, const {})) {
          final align = _align(node);
          _appendLine(out, ops, {'header': level, 'align': ?align});
        } else {
          _raw(node, out);
        }
      case 'blockquote':
        if (!_quote(node, out)) _raw(node, out);
      case 'ul':
      case 'ol':
        final ops = Delta();
        if (_list(node, ops, 0)) {
          for (final op in ops.toList()) {
            out.push(op);
          }
        } else {
          _raw(node, out);
        }
      case 'hr':
        out.insert({dividerKey: 'hr'});
        out.insert('\n');
      default:
        _raw(node, out);
    }
  }

  static String? _alignOf(dom.Element el) {
    final style = el.attributes['style'];
    if (style == null) return null;
    final m = RegExp(
      r'text-align:\s*(left|right|center|justify)',
      caseSensitive: false,
    ).firstMatch(style);
    return m?.group(1)?.toLowerCase();
  }

  static String? _align(dom.Element el) {
    final a = _alignOf(el);
    return (a == null || a == 'left') ? null : a;
  }

  static void _raw(dom.Element node, Delta out) {
    // A protected block: kept exactly as written, and shown to the writer as such
    out.insert({rawKey: node.outerHtml});
    out.insert('\n');
  }

  /// A paragraph. Returns false if it holds something the editor cannot represent.
  static bool _paragraph(List<dom.Node> nodes, Delta out, String? align) {
    final ops = Delta();
    if (!_inline(nodes, ops, const {})) return false;
    _appendLine(out, ops, align == null ? null : {'align': align});
    return true;
  }

  static void _appendLine(
    Delta out,
    Delta inlineOps,
    Map<String, dynamic>? blockAttrs,
  ) {
    for (final op in inlineOps.toList()) {
      out.push(op);
    }
    out.insert('\n', blockAttrs);
  }

  static bool _quote(dom.Element node, Delta out) {
    final lines = Delta();
    for (final child in node.nodes) {
      if (child is dom.Text) {
        if (child.text.trim().isEmpty) continue;
        return false;
      }
      if (child is! dom.Element || child.localName != 'p') return false;
      final ops = Delta();
      if (!_inline(child.nodes, ops, const {})) return false;
      _appendLine(lines, ops, {'blockquote': true, 'align': ?_align(child)});
    }
    if (lines.isEmpty) return false;
    for (final op in lines.toList()) {
      out.push(op);
    }
    return true;
  }

  static bool _list(dom.Element list, Delta out, int depth) {
    final kind = list.localName == 'ol' ? 'ordered' : 'bullet';
    for (final child in list.nodes) {
      if (child is dom.Text) {
        if (child.text.trim().isEmpty) continue;
        return false;
      }
      if (child is! dom.Element || child.localName != 'li') return false;
      final inlineNodes = <dom.Node>[];
      final nested = <dom.Element>[];
      var wroteLine = false;
      for (final part in child.nodes) {
        if (part is dom.Element &&
            (part.localName == 'ul' || part.localName == 'ol')) {
          nested.add(part);
        } else if (part is dom.Element &&
            part.localName == 'p' &&
            !wroteLine &&
            inlineNodes.isEmpty) {
          inlineNodes.addAll(part.nodes);
          wroteLine = true;
        } else if (part is dom.Element && part.localName == 'p') {
          return false; // more than one paragraph in one item
        } else {
          inlineNodes.add(part);
        }
      }
      final ops = Delta();
      if (!_inline(inlineNodes, ops, const {})) return false;
      _appendLine(out, ops, {'list': kind, if (depth > 0) 'indent': depth});
      for (final sub in nested) {
        if (!_list(sub, out, depth + 1)) return false;
      }
    }
    return true;
  }

  /// Inline content. Returns false on anything the editor cannot hold (an image, a table cell, an unknown embed).
  static bool _inline(
    List<dom.Node> nodes,
    Delta out,
    Map<String, dynamic> attrs,
  ) {
    for (final node in nodes) {
      if (node is dom.Text) {
        final text = node.text.replaceAll('\r', '').replaceAll('\n', ' ');
        if (text.isEmpty) continue;
        out.insert(text, attrs.isEmpty ? null : Map<String, dynamic>.of(attrs));
        continue;
      }
      if (node is! dom.Element) continue;
      final tag = node.localName ?? '';
      switch (tag) {
        case 'br':
          out.insert(
            softBreak,
            attrs.isEmpty ? null : Map<String, dynamic>.of(attrs),
          );
        case 'strong':
        case 'b':
          if (!_inline(node.nodes, out, {...attrs, 'bold': true})) return false;
        case 'em':
        case 'i':
          if (!_inline(node.nodes, out, {...attrs, 'italic': true}))
            return false;
        case 'u':
          if (!_inline(node.nodes, out, {...attrs, 'underline': true}))
            return false;
        case 's':
        case 'strike':
        case 'del':
          if (!_inline(node.nodes, out, {...attrs, 'strike': true}))
            return false;
        case 'code':
          if (!_inline(node.nodes, out, {...attrs, 'code': true})) return false;
        case 'mark':
          if (!_inline(node.nodes, out, {
            ...attrs,
            'background': highlightColor,
          }))
            return false;
        case 'sub':
          if (!_inline(node.nodes, out, {...attrs, 'script': 'sub'}))
            return false;
        case 'sup':
          if (!_inline(node.nodes, out, {...attrs, 'script': 'super'}))
            return false;
        case 'a':
          final href = node.attributes['href'];
          if (href == null || href.isEmpty) {
            if (!_inline(node.nodes, out, attrs)) return false;
          } else if (!_inline(node.nodes, out, {...attrs, 'link': href})) {
            return false;
          }
        case 'span':
          if (node.attributes['data-type'] == 'mention') {
            final id = node.attributes['data-id'] ?? '';
            final label =
                node.attributes['data-label'] ??
                node.text.replaceFirst(RegExp(r'^[@#]'), '');
            final char = node.attributes['data-mention-suggestion-char'] ?? '@';
            out.insert({
              mentionKey: {'id': id, 'label': label, 'char': char},
            }, attrs.isEmpty ? null : Map<String, dynamic>.of(attrs));
          } else if (!_inline(node.nodes, out, attrs)) {
            return false;
          }
        default:
          return false;
      }
    }
    return true;
  }

  // ---------------------------------------------------------------------------------------------
  // Delta -> HTML
  // ---------------------------------------------------------------------------------------------

  static String deltaToHtml(Delta delta) {
    final lines = _lines(delta);
    final out = StringBuffer();
    var i = 0;
    while (i < lines.length) {
      final line = lines[i];
      if (line.embed != null) {
        out.write(line.embed);
        i++;
        continue;
      }
      final attrs = line.attrs;
      if (attrs['list'] != null) {
        final group = <_Line>[];
        while (i < lines.length &&
            lines[i].embed == null &&
            lines[i].attrs['list'] != null) {
          group.add(lines[i]);
          i++;
        }
        out.write(_listHtml(group));
      } else if (attrs['blockquote'] == true) {
        out.write('<blockquote>');
        while (i < lines.length &&
            lines[i].embed == null &&
            lines[i].attrs['blockquote'] == true) {
          out.write(_paragraphHtml(lines[i]));
          i++;
        }
        out.write('</blockquote>');
      } else if (attrs['header'] != null) {
        final level = (attrs['header'] as num).toInt().clamp(1, 6);
        final align = attrs['align'];
        final style = (align is String && align != 'left')
            ? ' style="text-align: $align"'
            : '';
        out.write('<h$level$style>${_runsHtml(line.runs)}</h$level>');
        i++;
      } else {
        out.write(_paragraphHtml(line));
        i++;
      }
    }
    return out.toString();
  }

  static List<_Line> _lines(Delta delta) {
    final lines = <_Line>[];
    var runs = <_Run>[];
    void endLine(Map<String, dynamic>? attrs) {
      final only = runs.length == 1 ? runs.first.block : null;
      lines.add(
        _Line(only != null ? const [] : runs, attrs ?? const {}, embed: only),
      );
      runs = <_Run>[];
    }

    for (final op in delta.toList()) {
      final data = op.data;
      final attrs = op.attributes;
      if (data is String) {
        final parts = data.split('\n');
        for (var p = 0; p < parts.length; p++) {
          if (parts[p].isNotEmpty)
            runs.add(_Run(text: parts[p], attrs: attrs ?? const {}));
          if (p < parts.length - 1) endLine(attrs);
        }
      } else if (data is Map) {
        final map = Map<String, dynamic>.from(data);
        if (map.containsKey(mentionKey)) {
          runs.add(
            _Run(
              mention: Map<String, dynamic>.from(map[mentionKey] as Map),
              attrs: attrs ?? const {},
            ),
          );
        } else if (map.containsKey(dividerKey) || map.containsKey(rawKey)) {
          // A divider or protected block stands on its own line, which the line break after it ends
          if (runs.isNotEmpty) endLine(null);
          runs.add(
            _Run(
              block: map.containsKey(dividerKey)
                  ? '<hr>'
                  : map[rawKey] as String,
              attrs: const {},
            ),
          );
        }
      }
    }
    if (runs.isNotEmpty) endLine(null);
    return lines;
  }

  static String _paragraphHtml(_Line line) {
    final align = line.attrs['align'];
    final style = (align is String && align != 'left')
        ? ' style="text-align: $align"'
        : '';
    return '<p$style>${_runsHtml(line.runs)}</p>';
  }

  static String _listHtml(List<_Line> group) {
    final out = StringBuffer();
    // Open lists, outermost first: (indent depth, tag)
    final open = <(int, String)>[];
    final liOpen = <bool>[]; // whether a <li> is still open at each depth

    void closeTo(int depth) {
      while (open.isNotEmpty && open.last.$1 > depth) {
        if (liOpen.last) out.write('</li>');
        out.write('</${open.last.$2}>');
        open.removeLast();
        liOpen.removeLast();
      }
    }

    for (final line in group) {
      final depth = ((line.attrs['indent'] as num?) ?? 0).toInt();
      final tag = line.attrs['list'] == 'ordered' ? 'ol' : 'ul';
      closeTo(depth);
      if (open.isNotEmpty && open.last.$1 == depth && open.last.$2 != tag) {
        if (liOpen.last) out.write('</li>');
        out.write('</${open.last.$2}>');
        open.removeLast();
        liOpen.removeLast();
      }
      if (open.isNotEmpty && open.last.$1 == depth) {
        if (liOpen.last) out.write('</li>');
      } else {
        // A deeper list opens inside the item above it
        out.write('<$tag>');
        open.add((depth, tag));
        liOpen.add(false);
      }
      out.write('<li><p>${_runsHtml(line.runs)}</p>');
      liOpen[liOpen.length - 1] = true;
    }
    closeTo(-1);
    return out.toString();
  }

  /// The marks on a run, outermost first. The order is fixed so neighbouring runs share their wrapping tags,
  /// which gives <strong>one <em>two</em> three</strong> rather than a separate <strong> around each piece.
  static List<(String, String)> _marks(Map<String, dynamic> a) {
    final marks = <(String, String)>[];
    final link = a['link'];
    if (link is String && link.isNotEmpty)
      marks.add(('a', '<a href="${_attr(link)}">'));
    if (a['script'] == 'sub') marks.add(('sub', '<sub>'));
    if (a['script'] == 'super') marks.add(('sup', '<sup>'));
    if (a['bold'] == true) marks.add(('strong', '<strong>'));
    if (a['italic'] == true) marks.add(('em', '<em>'));
    if (a['underline'] == true) marks.add(('u', '<u>'));
    if (a['strike'] == true) marks.add(('s', '<s>'));
    if (a['background'] != null) marks.add(('mark', '<mark>'));
    if (a['code'] == true) marks.add(('code', '<code>'));
    return marks;
  }

  static String _runsHtml(List<_Run> runs) {
    final out = StringBuffer();
    var open = <(String, String)>[];
    for (final run in runs) {
      final want = _marks(run.attrs);
      // Keep the tags both runs share open; close the rest, then open what this run adds
      var common = 0;
      while (common < open.length &&
          common < want.length &&
          open[common].$2 == want[common].$2) {
        common++;
      }
      for (var i = open.length - 1; i >= common; i--) {
        out.write('</${open[i].$1}>');
      }
      for (var i = common; i < want.length; i++) {
        out.write(want[i].$2);
      }
      open = want;
      if (run.mention != null) {
        final m = run.mention!;
        final char = (m['char'] as String?) ?? '@';
        out.write(
          '<span data-type="mention" class="mention" data-id="${_attr(m['id'] as String? ?? '')}" data-label="${_attr(m['label'] as String? ?? '')}" data-mention-suggestion-char="${_attr(char)}">${_text('$char${m['label'] ?? ''}')}</span>',
        );
      } else {
        out.write(_text(run.text!).replaceAll(softBreak, '<br>'));
      }
    }
    for (var i = open.length - 1; i >= 0; i--) {
      out.write('</${open[i].$1}>');
    }
    return out.toString();
  }

  static String _text(String s) => s
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
  static String _attr(String s) => _text(s).replaceAll('"', '&quot;');

  // ---------------------------------------------------------------------------------------------
  // Plain text, matching the web app (words and reading time are counted the same way on both)
  // ---------------------------------------------------------------------------------------------

  static String plainText(String html) {
    return html
        .replaceAll(
          RegExp(r'</(p|h[1-6]|li|blockquote)>', caseSensitive: false),
          ' ',
        )
        .replaceAll(RegExp(r'<[^>]*>'), '')
        .replaceAll('&nbsp;', ' ')
        .replaceAll('&amp;', '&')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
  }

  static int countWords(String html) {
    final text = plainText(html);
    return text.isEmpty ? 0 : text.split(' ').length;
  }
}

class _Run {
  _Run({this.text, this.mention, this.block, required this.attrs});
  final String? text;

  /// Finished HTML, for a divider or a protected block
  final String? block;
  final Map<String, dynamic>? mention;
  final Map<String, dynamic> attrs;
}

class _Line {
  _Line(this.runs, this.attrs, {this.embed});
  final List<_Run> runs;
  final Map<String, dynamic> attrs;

  /// Finished HTML for a divider or a protected block
  final String? embed;
}
