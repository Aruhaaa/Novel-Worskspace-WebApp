import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:html/dom.dart' as dom;
import 'package:html/parser.dart' as html_parser;
import 'package:url_launcher/url_launcher.dart';

import '../theme.dart';

/// Shows a chapter's HTML as readable text: paragraphs, headings, quotes, lists, scene breaks, emphasis and links.
/// Nothing is ever run, so a chapter from anyone is safe to show.
/// Elements that are never shown, neither as pictures nor as their inner text
const _hidden = {'script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'noscript', 'template', 'svg', 'math', 'head', 'title'};

class HtmlView extends StatefulWidget {
  const HtmlView({
    super.key,
    required this.html,
    required this.prose,
    required this.accent,
    required this.muted,
    required this.border,
  });

  final String html;

  /// The reading style (family, size and line height already chosen)
  final TextStyle prose;
  final Color accent;
  final Color muted;
  final Color border;

  @override
  State<HtmlView> createState() => _HtmlViewState();
}

class _HtmlViewState extends State<HtmlView> {
  final _recognizers = <TapGestureRecognizer>[];

  @override
  void dispose() {
    for (final r in _recognizers) {
      r.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    for (final r in _recognizers) {
      r.dispose();
    }
    _recognizers.clear();
    final fragment = html_parser.parseFragment(widget.html);
    final blocks = <Widget>[];
    for (final node in fragment.nodes) {
      final w = _block(node, widget.prose, 0);
      if (w != null) blocks.add(w);
    }
    if (blocks.isEmpty) {
      blocks.add(
        Text(
          'This chapter is empty.',
          style: widget.prose.copyWith(
            color: widget.muted,
            fontStyle: FontStyle.italic,
          ),
        ),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: blocks,
    );
  }

  TextAlign? _align(dom.Element el) {
    final style = el.attributes['style'] ?? '';
    final m = RegExp(r'text-align:\s*(left|right|center|justify)')
        .firstMatch(style);
    return switch (m?.group(1)) {
      'center' => TextAlign.center,
      'right' => TextAlign.right,
      'justify' => TextAlign.justify,
      _ => null,
    };
  }

  Widget? _block(dom.Node node, TextStyle style, int depth) {
    final gap = (widget.prose.fontSize ?? 18) * 0.85;
    if (node is dom.Text) {
      if (node.text.trim().isEmpty) return null;
      return Padding(
        padding: EdgeInsets.only(bottom: gap),
        child: Text(node.text.trim(), style: style),
      );
    }
    if (node is! dom.Element) return null;
    if (_hidden.contains(node.localName)) return null;
    switch (node.localName) {
      case 'p':
        final spans = _inline(node.nodes, style);
        // An empty paragraph is a blank line the writer chose to leave
        if (spans.isEmpty) return SizedBox(height: gap);
        return Padding(
          padding: EdgeInsets.only(bottom: gap),
          child: Text.rich(
            TextSpan(children: spans),
            style: style,
            textAlign: _align(node),
          ),
        );
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6':
        final level = int.parse(node.localName!.substring(1));
        final size =
            (widget.prose.fontSize ?? 18) *
            (level == 1
                ? 1.75
                : level == 2
                ? 1.4
                : 1.2);
        final heading = TextStyle(
          fontFamily: Fonts.display,
          fontSize: size,
          height: 1.2,
          color: style.color,
        );
        return Padding(
          padding: EdgeInsets.only(top: gap * 0.6, bottom: gap * 0.7),
          child: Text.rich(
            TextSpan(children: _inline(node.nodes, heading)),
            style: heading,
            textAlign: _align(node),
          ),
        );
      case 'blockquote':
        final inner = <Widget>[];
        for (final child in node.nodes) {
          final w = _block(
            child,
            style.copyWith(color: widget.muted, fontStyle: FontStyle.italic),
            depth,
          );
          if (w != null) inner.add(w);
        }
        return Container(
          margin: EdgeInsets.only(bottom: gap),
          padding: const EdgeInsets.only(left: 14),
          decoration: BoxDecoration(
            border: Border(left: BorderSide(color: widget.border, width: 3)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: inner,
          ),
        );
      case 'ul':
      case 'ol':
        return _list(node, style, depth, gap);
      case 'hr':
        return Padding(
          padding: EdgeInsets.symmetric(vertical: gap),
          child: Center(
            child: Text(
              '∗   ∗   ∗',
              style: style.copyWith(color: widget.muted, letterSpacing: 4),
            ),
          ),
        );
      case 'pre':
        return Container(
          width: double.infinity,
          margin: EdgeInsets.only(bottom: gap),
          padding: const EdgeInsets.all(12),
          color: widget.border.withValues(alpha: 0.5),
          child: Text(
            node.text,
            style: style.copyWith(
              fontFamily: 'monospace',
              fontSize: (style.fontSize ?? 18) * 0.85,
            ),
          ),
        );
      default:
        // Anything else (a table, a custom block): show its words rather than hide them
        final text = node.text.trim();
        if (text.isEmpty) return null;
        return Padding(
          padding: EdgeInsets.only(bottom: gap),
          child: Text(text, style: style),
        );
    }
  }

  Widget _list(dom.Element list, TextStyle style, int depth, double gap) {
    final ordered = list.localName == 'ol';
    final items = <Widget>[];
    var n = 0;
    for (final li in list.nodes.whereType<dom.Element>().where(
      (e) => e.localName == 'li',
    )) {
      n++;
      final inlineNodes = <dom.Node>[];
      final nested = <Widget>[];
      for (final part in li.nodes) {
        if (part is dom.Element &&
            (part.localName == 'ul' || part.localName == 'ol')) {
          nested.add(_list(part, style, depth + 1, gap * 0.5));
        } else if (part is dom.Element && part.localName == 'p') {
          inlineNodes.addAll(part.nodes);
        } else {
          inlineNodes.add(part);
        }
      }
      items.add(
        Padding(
          padding: EdgeInsets.only(left: 6.0 + depth * 18, bottom: gap * 0.4),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: 26,
                    child: Text(
                      ordered ? '$n.' : '•',
                      style: style.copyWith(color: widget.muted),
                    ),
                  ),
                  Expanded(
                    child: Text.rich(
                      TextSpan(children: _inline(inlineNodes, style)),
                      style: style,
                    ),
                  ),
                ],
              ),
              ...nested,
            ],
          ),
        ),
      );
    }
    return Padding(
      padding: EdgeInsets.only(bottom: depth == 0 ? gap : 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: items,
      ),
    );
  }

  List<InlineSpan> _inline(List<dom.Node> nodes, TextStyle style) {
    final out = <InlineSpan>[];
    for (final node in nodes) {
      if (node is dom.Text) {
        final text = node.text.replaceAll('\n', ' ');
        if (text.isNotEmpty) out.add(TextSpan(text: text));
        continue;
      }
      if (node is! dom.Element) continue;
      if (_hidden.contains(node.localName)) continue;
      switch (node.localName) {
        case 'br':
          out.add(const TextSpan(text: '\n'));
        case 'strong':
        case 'b':
          out.add(
            TextSpan(
              style: const TextStyle(fontWeight: FontWeight.w700),
              children: _inline(node.nodes, style),
            ),
          );
        case 'em':
        case 'i':
          out.add(
            TextSpan(
              style: const TextStyle(fontStyle: FontStyle.italic),
              children: _inline(node.nodes, style),
            ),
          );
        case 'u':
          out.add(
            TextSpan(
              style: const TextStyle(decoration: TextDecoration.underline),
              children: _inline(node.nodes, style),
            ),
          );
        case 's':
        case 'strike':
        case 'del':
          out.add(
            TextSpan(
              style: const TextStyle(decoration: TextDecoration.lineThrough),
              children: _inline(node.nodes, style),
            ),
          );
        case 'mark':
          out.add(
            TextSpan(
              style: TextStyle(
                backgroundColor: widget.accent.withValues(alpha: 0.22),
              ),
              children: _inline(node.nodes, style),
            ),
          );
        case 'code':
          out.add(
            TextSpan(
              style: TextStyle(
                fontFamily: 'monospace',
                backgroundColor: widget.border.withValues(alpha: 0.6),
              ),
              children: _inline(node.nodes, style),
            ),
          );
        case 'a':
          final href = node.attributes['href'] ?? '';
          TapGestureRecognizer? tap;
          if (RegExp(
            r'^(https?:|mailto:)',
            caseSensitive: false,
          ).hasMatch(href)) {
            tap = TapGestureRecognizer()
              ..onTap = () => launchUrl(
                Uri.parse(href),
                mode: LaunchMode.externalApplication,
              );
            _recognizers.add(tap);
          }
          out.add(
            TextSpan(
              style: TextStyle(
                color: widget.accent,
                decoration: TextDecoration.underline,
              ),
              recognizer: tap,
              children: _inline(node.nodes, style),
            ),
          );
        case 'span':
          if (node.attributes['data-type'] == 'mention') {
            out.add(
              TextSpan(
                text: node.text,
                style: TextStyle(
                  color: widget.accent,
                  fontWeight: FontWeight.w600,
                ),
              ),
            );
          } else {
            out.addAll(_inline(node.nodes, style));
          }
        case 'sub':
        case 'sup':
          out.addAll(_inline(node.nodes, style));
        default:
          final text = node.text;
          if (text.isNotEmpty) out.add(TextSpan(text: text));
      }
    }
    return out;
  }
}
