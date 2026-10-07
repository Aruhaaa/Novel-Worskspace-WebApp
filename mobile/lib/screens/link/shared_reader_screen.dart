import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../data/backend.dart';
import '../../data/models.dart';
import '../../state/app_state.dart';
import '../../theme.dart';
import '../../widgets/common.dart';
import '../../widgets/html_view.dart';

/// A beta reader's view: the whole manuscript in one scroll. Select words and choose Comment, or comment on a chapter.
class SharedReaderScreen extends StatefulWidget {
  const SharedReaderScreen({super.key, required this.token});
  final String token;

  @override
  State<SharedReaderScreen> createState() => _SharedReaderScreenState();
}

class _SharedReaderScreenState extends State<SharedReaderScreen> {
  late Future<SharedManuscript?> _manuscript;
  List<LinkComment> _mine = [];
  String _readerKey = '';
  String _readerName = '';
  final _selected = <String, String>{};

  String get _prefsKey => 'reader_${widget.token.substring(0, 16)}';

  @override
  void initState() {
    super.initState();
    _loadIdentity();
    _manuscript = _load();
  }

  void _loadIdentity() {
    final prefs = context.read<AppState>().prefs;
    try {
      final saved = jsonDecode(prefs.getString(_prefsKey) ?? 'null');
      if (saved is Map && saved['key'] is String) {
        _readerKey = saved['key'] as String;
        _readerName = (saved['name'] ?? '') as String;
        return;
      }
    } catch (_) {
      // make a new one
    }
    _readerKey =
        'r${DateTime.now().millisecondsSinceEpoch.toRadixString(36)}${UniqueKey().hashCode.toRadixString(36)}';
    _saveIdentity(prefs);
  }

  Future<void> _saveIdentity([SharedPreferences? prefs]) =>
      (prefs ?? context.read<AppState>().prefs).setString(
        _prefsKey,
        jsonEncode({'key': _readerKey, 'name': _readerName}),
      );

  Future<SharedManuscript?> _load() async {
    final backend = context.read<Backend>();
    final m = await backend.sharedManuscript(widget.token);
    if (m != null) {
      try {
        final mine = await backend.myLinkComments(widget.token, _readerKey);
        if (mounted)
          setState(() {
            _mine = mine;
          });
      } catch (_) {
        // their earlier comments just do not show
      }
    }
    return m;
  }

  Future<void> _comment(
    SharedManuscript m,
    SharedChapter chapter,
    String quote,
  ) async {
    final nameController = TextEditingController(text: _readerName);
    final noteController = TextEditingController();
    final t = Theme.of(context);
    String? error;
    bool busy = false;
    final sent = await showModalBottomSheet<LinkComment>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheet) => Padding(
          padding: EdgeInsets.fromLTRB(
            20,
            0,
            20,
            MediaQuery.of(ctx).viewInsets.bottom + 20,
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Eyebrow(
                  quote.isEmpty
                      ? 'Comment on the chapter'
                      : 'Comment on this passage',
                ),
                const SizedBox(height: 6),
                Text(
                  chapter.title.isEmpty ? 'Untitled chapter' : chapter.title,
                  style: t.textTheme.titleLarge,
                ),
                if (quote.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.only(left: 12),
                    decoration: BoxDecoration(
                      border: Border(
                        left: BorderSide(
                          color: t.colorScheme.outline,
                          width: 3,
                        ),
                      ),
                    ),
                    child: Text(
                      quote.length > 220
                          ? '${quote.substring(0, 217)}…'
                          : quote,
                      style: t.textTheme.bodyMedium?.copyWith(
                        fontStyle: FontStyle.italic,
                      ),
                    ),
                  ),
                ],
                if (_readerName.trim().isEmpty) ...[
                  const SizedBox(height: 14),
                  TextField(
                    controller: nameController,
                    maxLength: 80,
                    decoration: const InputDecoration(
                      labelText: 'Your name',
                      counterText: '',
                    ),
                  ),
                ],
                const SizedBox(height: 14),
                TextField(
                  controller: noteController,
                  autofocus: true,
                  minLines: 3,
                  maxLines: 6,
                  maxLength: 5000,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: const InputDecoration(
                    labelText: 'Your comment',
                    hintText: 'What did you think? What confused you, moved you, or pulled you out of the story?',
                  ),
                ),
                if (error != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Text(
                      error!,
                      style: TextStyle(color: t.colorScheme.error),
                    ),
                  ),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    TextButton(
                      onPressed: () => Navigator.pop(ctx),
                      child: const Text('Cancel'),
                    ),
                    const SizedBox(width: 8),
                    FilledButton(
                      onPressed: busy
                          ? null
                          : () async {
                              final name =
                                  (_readerName.trim().isEmpty
                                          ? nameController.text
                                          : _readerName)
                                      .trim();
                              if (name.isEmpty) {
                                setSheet(
                                  () => error = 'Please add your name first, so the writer knows who the comment is from.',
                                );
                                return;
                              }
                              if (noteController.text.trim().isEmpty) return;
                              setSheet(() {
                                busy = true;
                                error = null;
                              });
                              try {
                                final c = await context
                                    .read<Backend>()
                                    .addLinkComment(
                                      token: widget.token,
                                      readerKey: _readerKey,
                                      readerName: name,
                                      chapterId: chapter.id,
                                      quote: quote,
                                      note: noteController.text.trim(),
                                    );
                                _readerName = name;
                                await _saveIdentity();
                                if (ctx.mounted) Navigator.pop(ctx, c);
                              } on BackendException catch (e) {
                                setSheet(() {
                                  busy = false;
                                  error = e.offline
                                      ? 'You seem to be offline. Your comment was not sent.'
                                      : e.message;
                                });
                              }
                            },
                      child: Text(busy ? 'Sending…' : 'Send comment'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
    if (sent != null && mounted) {
      setState(() {
        _mine = [..._mine, sent];
      });
      say(context, 'Comment sent.');
    }
  }

  void _myComments(SharedManuscript m) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheet) => SafeArea(
          child: ConstrainedBox(
            constraints: BoxConstraints(
              maxHeight: MediaQuery.of(ctx).size.height * 0.75,
            ),
            child: _mine.isEmpty
                ? const Padding(
                    padding: EdgeInsets.all(28),
                    child: Text(
                      'You have not left any comments yet. Select some words and choose Comment.',
                    ),
                  )
                : ListView(
                    padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
                    shrinkWrap: true,
                    children: [
                      for (final c in _mine)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 14),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Eyebrow(
                                m.chapters
                                        .where((x) => x.id == c.chapterId)
                                        .map((x) => x.title)
                                        .firstOrNull ??
                                    'Chapter',
                              ),
                              if (c.quote.isNotEmpty)
                                Padding(
                                  padding: const EdgeInsets.only(top: 4),
                                  child: Text(
                                    '“${c.quote.length > 140 ? '${c.quote.substring(0, 137)}…' : c.quote}”',
                                    style: const TextStyle(
                                      fontStyle: FontStyle.italic,
                                    ),
                                  ),
                                ),
                              const SizedBox(height: 4),
                              Text(c.note),
                              Align(
                                alignment: Alignment.centerLeft,
                                child: TextButton(
                                  onPressed: () async {
                                    final backend = context.read<Backend>();
                                    if (!await confirm(
                                      ctx,
                                      title: 'Delete this comment?',
                                      text: 'The writer will no longer see it.',
                                      action: 'Delete',
                                    ))
                                      return;
                                    if (await backend.deleteLinkComment(
                                      widget.token,
                                      _readerKey,
                                      c.id,
                                    )) {
                                      setState(() {
                                        _mine = _mine
                                            .where((x) => x.id != c.id)
                                            .toList();
                                      });
                                      setSheet(() {});
                                    }
                                  },
                                  child: const Text('Delete'),
                                ),
                              ),
                              const Divider(),
                            ],
                          ),
                        ),
                    ],
                  ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    final state = context.watch<AppState>();
    return FutureBuilder<SharedManuscript?>(
      future: _manuscript,
      builder: (context, snap) {
        if (snap.connectionState != ConnectionState.done) {
          return Scaffold(
            appBar: AppBar(),
            body: const Center(child: CircularProgressIndicator()),
          );
        }
        if (snap.hasError || snap.data == null) {
          final e = snap.error;
          return Scaffold(
            appBar: AppBar(),
            body: EmptyState(
              icon: Icons.link_off,
              title: 'This link cannot be opened',
              text: e is BackendException ? e.message : 'It may have been turned off, or the address is incomplete. Ask the writer for a new one.',
              action: e is BackendException && e.offline
                  ? OutlinedButton(
                      onPressed: () => setState(() => _manuscript = _load()),
                      child: const Text('Try again'),
                    )
                  : null,
            ),
          );
        }
        final m = snap.data!;
        final prose = Fonts.prose(
          proseFontById(state.proseFontId).family,
          size: 18 * state.fontScale,
          color: t.colorScheme.onSurface,
        );
        return Scaffold(
          appBar: AppBar(title: Text(m.title, overflow: TextOverflow.ellipsis)),
          floatingActionButton: FloatingActionButton.extended(
            onPressed: () => _myComments(m),
            icon: const Icon(Icons.chat_bubble_outline),
            label: Text('Your comments (${_mine.length})'),
          ),
          body: SafeArea(
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 680),
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(24, 20, 24, 96),
                  children: [
                    const Eyebrow('A reading copy'),
                    const SizedBox(height: 8),
                    Text(m.title, style: t.textTheme.displayMedium),
                    if (m.authorName.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          'by ${m.authorName}',
                          style: t.textTheme.bodyMedium,
                        ),
                      ),
                    const SizedBox(height: 14),
                    Text(
                      'Thank you for reading. Press and hold some words, then choose Comment. Or comment on a whole chapter. The writer sees what you write.',
                      style: t.textTheme.bodySmall,
                    ),
                    for (var i = 0; i < m.chapters.length; i++) ...[
                      const SizedBox(height: 30),
                      const Divider(),
                      const SizedBox(height: 22),
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              'CHAPTER ${(i + 1).toString().padLeft(2, '0')}',
                              style: t.textTheme.labelSmall?.copyWith(
                                letterSpacing: 1.6,
                              ),
                            ),
                          ),
                          TextButton.icon(
                            icon: const Icon(
                              Icons.add_comment_outlined,
                              size: 18,
                            ),
                            label: const Text('Comment on chapter'),
                            onPressed: () => _comment(m, m.chapters[i], ''),
                          ),
                        ],
                      ),
                      Text(
                        m.chapters[i].title.isEmpty
                            ? 'Untitled chapter'
                            : m.chapters[i].title,
                        style: t.textTheme.headlineMedium,
                      ),
                      const SizedBox(height: 18),
                      SelectionArea(
                        onSelectionChanged: (c) =>
                            _selected[m.chapters[i].id] = c?.plainText ?? '',
                        contextMenuBuilder: (ctx, selectable) {
                          final items = [
                            ContextMenuButtonItem(
                              label: 'Comment',
                              onPressed: () {
                                final quote =
                                    (_selected[m.chapters[i].id] ?? '').trim();
                                selectable.hideToolbar();
                                if (quote.isNotEmpty)
                                  _comment(
                                    m,
                                    m.chapters[i],
                                    quote.length > 600
                                        ? quote.substring(0, 600)
                                        : quote,
                                  );
                              },
                            ),
                            ...selectable.contextMenuButtonItems.where(
                              (b) => b.type == ContextMenuButtonType.copy,
                            ),
                          ];
                          return AdaptiveTextSelectionToolbar.buttonItems(
                            anchors: selectable.contextMenuAnchors,
                            buttonItems: items,
                          );
                        },
                        child: HtmlView(
                          html: m.chapters[i].html,
                          prose: prose,
                          accent: t.colorScheme.primary,
                          muted: state.theme.muted,
                          border: state.theme.border,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
