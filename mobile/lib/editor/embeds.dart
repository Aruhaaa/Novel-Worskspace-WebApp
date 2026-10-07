import 'package:flutter/material.dart';
import 'package:flutter_quill/flutter_quill.dart';

import '../theme.dart';
import 'html_codec.dart';

/// An @mention of a character, place or note from the notebook. It stays a link to that notebook entry
/// (by id) even if the entry is later renamed, exactly as on the web.
class MentionEmbedBuilder extends EmbedBuilder {
  const MentionEmbedBuilder();

  @override
  String get key => HtmlCodec.mentionKey;

  @override
  bool get expanded => false;

  @override
  String toPlainText(Embed node) {
    final d = node.value.data;
    return d is Map ? '${d['char'] ?? '@'}${d['label'] ?? ''}' : '@';
  }

  @override
  Widget build(BuildContext context, EmbedContext embedContext) {
    final d = embedContext.node.value.data;
    final label = d is Map ? '${d['char'] ?? '@'}${d['label'] ?? ''}' : '@';
    final accent = Theme.of(context).colorScheme.primary;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      decoration: BoxDecoration(
        color: accent.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(3),
      ),
      child: Text(
        label,
        style: embedContext.textStyle.copyWith(
          color: accent,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

/// A scene break (the web editor's horizontal rule).
class DividerEmbedBuilder extends EmbedBuilder {
  const DividerEmbedBuilder();

  @override
  String get key => HtmlCodec.dividerKey;

  @override
  bool get expanded => true;

  @override
  Widget build(BuildContext context, EmbedContext embedContext) {
    final muted = Theme.of(context).colorScheme.onSurface
        .withValues(alpha: 0.5);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Center(
        child: Text(
          '∗   ∗   ∗',
          style: embedContext.textStyle.copyWith(
            color: muted,
            letterSpacing: 4,
          ),
        ),
      ),
    );
  }
}

/// Something the web editor made that the phone editor cannot change (a table, an image, a code block).
/// It is kept exactly as it was and written back untouched, so editing on the phone can never damage it.
class RawEmbedBuilder extends EmbedBuilder {
  const RawEmbedBuilder();

  @override
  String get key => HtmlCodec.rawKey;

  @override
  bool get expanded => true;

  @override
  Widget build(BuildContext context, EmbedContext embedContext) {
    final t = Theme.of(context);
    final html = embedContext.node.value.data is String
        ? embedContext.node.value.data as String
        : '';
    final words = HtmlCodec.plainText(html);
    final kind = RegExp(r'^<\s*(\w+)')
        .firstMatch(html.trimLeft())
        ?.group(1)
        ?.toLowerCase();
    final label = switch (kind) {
      'table' => 'Table',
      'pre' => 'Code block',
      'img' => 'Image',
      'h4' || 'h5' || 'h6' => 'Heading',
      _ => 'Content',
    };
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 6),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        border: Border.all(color: t.colorScheme.outline),
        borderRadius: BorderRadius.circular(4),
        color: t.colorScheme.outline.withValues(alpha: 0.18),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            Icons.lock_outline,
            size: 16,
            color: t.colorScheme.onSurface.withValues(alpha: 0.55),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '$label from the web editor',
                  style: TextStyle(
                    fontFamily: Fonts.sans,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: t.colorScheme.onSurface,
                  ),
                ),
                Text(
                  'Kept exactly as written. Edit it on the web.',
                  style: TextStyle(
                    fontFamily: Fonts.sans,
                    fontSize: 11,
                    color: t.colorScheme.onSurface.withValues(alpha: 0.6),
                  ),
                ),
                if (words.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Text(
                      words.length > 160
                          ? '${words.substring(0, 157)}…'
                          : words,
                      style: TextStyle(
                        fontFamily: Fonts.sans,
                        fontSize: 13,
                        color: t.colorScheme.onSurface.withValues(alpha: 0.75),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

const editorEmbeds = <EmbedBuilder>[
  MentionEmbedBuilder(),
  DividerEmbedBuilder(),
  RawEmbedBuilder(),
];
