import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_quill/flutter_quill.dart';
import 'package:provider/provider.dart';

import '../../data/backend.dart';
import '../../data/models.dart';
import '../../editor/autosave.dart';
import '../../editor/embeds.dart';
import '../../editor/html_codec.dart';
import '../../state/app_state.dart';
import '../../theme.dart';
import '../../widgets/common.dart';
import 'chapter_details_sheet.dart';

/// Writing a chapter. Chapters are HTML shared with the web app; this editor reads and writes that same HTML,
/// keeping anything it cannot edit (a table, an image) untouched.
class ChapterEditorScreen extends StatefulWidget {
  const ChapterEditorScreen({
    super.key,
    required this.project,
    required this.chapter,
    this.note,
  });
  final Project project;
  final Chapter chapter;
  final ChapterNote? note;

  @override
  State<ChapterEditorScreen> createState() => _ChapterEditorScreenState();
}

class _ChapterEditorScreenState extends State<ChapterEditorScreen>
    with WidgetsBindingObserver {
  late final QuillController _controller;
  late final TextEditingController _title;
  late final Autosave _autosave;
  final _focus = FocusNode();
  final _scroll = ScrollController();
  StreamSubscription<DocChange>? _changes;
  bool _recovered = false;
  int _words = 0;
  late ChapterNote _note = widget.note ?? const ChapterNote();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    final state = context.read<AppState>();
    final draft = Autosave.readDraft(state.prefs, widget.chapter.id);
    _recovered = draft != null;
    final html = draft?.html ?? widget.chapter.content;
    _title = TextEditingController(text: draft?.title ?? widget.chapter.title);
    _controller = QuillController(
      document: Document.fromDelta(HtmlCodec.htmlToDelta(html)),
      selection: const TextSelection.collapsed(offset: 0),
    );
    _words = _countWords();
    _autosave = Autosave(
      backend: context.read<Backend>(),
      prefs: state.prefs,
      dailyWords: state.dailyWords,
      projectId: widget.project.id,
      chapterId: widget.chapter.id,
      currentTitle: () => _title.text,
      currentHtml: () => HtmlCodec.deltaToHtml(_controller.document.toDelta()),
    )..addListener(() => mounted ? setState(() {}) : null);
    if (_recovered) _autosave.markRecovered();
    _changes = _controller.document.changes.listen((_) {
      _autosave.changed();
      final n = _countWords();
      if (n != _words && mounted)
        setState(() {
          _words = n;
        });
    });
    _title.addListener(() => _autosave.changed());
  }

  int _countWords() {
    // An @mention is one object in the editor; count it as a word like the web does
    final text = _controller.document
        .toPlainText()
        .replaceAll(Embed.kObjectReplacementCharacter, 'x')
        .trim();
    return text.isEmpty ? 0 : text.split(RegExp(r'\s+')).length;
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState s) {
    if (s == AppLifecycleState.paused || s == AppLifecycleState.inactive)
      unawaited(_autosave.flush());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _changes?.cancel();
    _autosave.dispose();
    _controller.dispose();
    _title.dispose();
    _focus.dispose();
    _scroll.dispose();
    super.dispose();
  }

  // ---- inserting ----

  void _toggleHighlight() {
    final on = _controller.getSelectionStyle().attributes.containsKey(
      Attribute.background.key,
    );
    _controller.formatSelection(
      on
          ? Attribute.clone(Attribute.background, null)
          : BackgroundAttribute(HtmlCodec.highlightColor),
    );
  }

  void _insertBreak() {
    final at = _controller.selection.baseOffset.clamp(
      0,
      _controller.document.length - 1,
    );
    // A scene break stands on a line of its own
    _controller.replaceText(at, 0, '\n', null);
    _controller.replaceText(
      at + 1,
      0,
      const Embeddable(HtmlCodec.dividerKey, 'hr'),
      null,
    );
    _controller.replaceText(
      at + 2,
      0,
      '\n',
      TextSelection.collapsed(offset: at + 3),
    );
  }

  Future<void> _insertMention() async {
    final backend = context.read<Backend>();
    List<Entity> entities;
    try {
      entities = (await backend.entities(widget.project.id))
          .where((e) => e.type != EntityType.scene)
          .toList();
    } catch (e) {
      if (mounted) say(context, describe(e));
      return;
    }
    if (!mounted) return;
    if (entities.isEmpty) {
      say(
        context,
        'Your notebook is empty. Add a character or a place first, then you can mention it here.',
      );
      return;
    }
    final picked = await showModalBottomSheet<Entity>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => _EntityPicker(entities: entities),
    );
    if (picked == null) return;
    final sel = _controller.selection;
    final at = sel.start.clamp(0, _controller.document.length - 1);
    final len = (sel.end - sel.start).clamp(
      0,
      _controller.document.length - 1 - at,
    );
    // By id, so the mention keeps pointing at the entry if it is renamed later
    _controller.replaceText(
      at,
      len,
      Embeddable(HtmlCodec.mentionKey, {
        'id': picked.id,
        'label': picked.name,
        'char': '@',
      }),
      null,
    );
    _controller.replaceText(
      at + 1,
      0,
      ' ',
      TextSelection.collapsed(offset: at + 2),
    );
    _focus.requestFocus();
  }

  Future<void> _details() async {
    await showChapterDetails(
      context,
      project: widget.project,
      chapter: widget.chapter,
      note: _note,
      onChanged: (n) => _note = n,
    );
  }

  // ---- looks ----

  DefaultStyles _styles(AppState state, ThemeData t) {
    final base = Fonts.prose(
      proseFontById(state.proseFontId).family,
      size: 18 * state.fontScale,
      color: t.colorScheme.onSurface,
    );
    TextStyle heading(double mult) => TextStyle(
      fontFamily: Fonts.display,
      fontSize: base.fontSize! * mult,
      height: 1.2,
      color: t.colorScheme.onSurface,
    );
    DefaultTextBlockStyle block(
      TextStyle s, {
      double top = 0,
      double bottom = 12,
    }) => DefaultTextBlockStyle(
      s,
      const HorizontalSpacing(0, 0),
      VerticalSpacing(top, bottom),
      const VerticalSpacing(0, 0),
      null,
    );
    return DefaultStyles(
      paragraph: block(base),
      h1: block(heading(1.75), top: 8, bottom: 10),
      h2: block(heading(1.4), top: 6, bottom: 8),
      h3: block(heading(1.2), top: 4, bottom: 6),
      quote: DefaultTextBlockStyle(
        base.copyWith(fontStyle: FontStyle.italic, color: state.theme.muted),
        const HorizontalSpacing(0, 0),
        const VerticalSpacing(0, 12),
        const VerticalSpacing(0, 0),
        BoxDecoration(
          border: Border(left: BorderSide(color: state.theme.border, width: 3)),
        ),
      ),
      placeHolder: block(base.copyWith(color: state.theme.muted)),
    );
  }

  String get _statusText => switch (_autosave.state) {
    SaveState.saved => 'Saved',
    SaveState.pending => 'Changes pending',
    SaveState.saving => 'Saving…',
    SaveState.error => 'Not saved yet',
  };

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    final state = context.watch<AppState>();
    final failed = _autosave.state == SaveState.error;

    return PopScope(
      onPopInvokedWithResult: (_, _) => unawaited(_autosave.flush()),
      child: Scaffold(
        appBar: AppBar(
          titleSpacing: 0,
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                widget.project.title,
                style: t.textTheme.titleLarge?.copyWith(fontSize: 18),
                overflow: TextOverflow.ellipsis,
              ),
              Text(
                '$_statusText · ${_words.toString()} ${_words == 1 ? 'word' : 'words'}',
                style: t.textTheme.bodySmall?.copyWith(
                  color: failed ? t.colorScheme.error : null,
                  fontSize: 11,
                ),
              ),
            ],
          ),
          actions: [
            if (failed)
              TextButton(
                onPressed: _autosave.flush,
                child: const Text('Retry'),
              ),
            IconButton(
              tooltip: 'Status, synopsis and notes',
              icon: const Icon(Icons.tune),
              onPressed: _details,
            ),
          ],
        ),
        body: SafeArea(
          child: Column(
            children: [
              if (_recovered)
                MaterialBanner(
                  backgroundColor: t.colorScheme.primary.withValues(alpha: 0.1),
                  content: const Text(
                    'Recovered unsaved changes from this phone.',
                  ),
                  actions: [
                    TextButton(
                      onPressed: () => setState(() => _recovered = false),
                      child: const Text('Dismiss'),
                    ),
                  ],
                ),
              if (failed)
                Container(
                  width: double.infinity,
                  color: t.colorScheme.error.withValues(alpha: 0.1),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 8,
                  ),
                  child: Text(
                    '${_autosave.lastError ?? 'Could not save.'} Your words are kept on this phone and it will keep trying.',
                    style: t.textTheme.bodySmall,
                  ),
                ),
              Expanded(
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 720),
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(20, 14, 20, 0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          TextField(
                            controller: _title,
                            style: t.textTheme.headlineMedium,
                            textCapitalization: TextCapitalization.sentences,
                            decoration: const InputDecoration(
                              hintText: 'Untitled chapter',
                              border: InputBorder.none,
                              enabledBorder: InputBorder.none,
                              focusedBorder: InputBorder.none,
                              filled: false,
                              contentPadding: EdgeInsets.zero,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Expanded(
                            child: QuillEditor(
                              controller: _controller,
                              focusNode: _focus,
                              scrollController: _scroll,
                              config: QuillEditorConfig(
                                placeholder: 'Every world begins somewhere…',
                                padding: const EdgeInsets.only(bottom: 80),
                                embedBuilders: editorEmbeds,
                                customStyles: _styles(state, t),
                                scrollable: true,
                                expands: false,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
              _Toolbar(
                controller: _controller,
                onMention: _insertMention,
                onHighlight: _toggleHighlight,
                onBreak: _insertBreak,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Toolbar extends StatelessWidget {
  const _Toolbar({
    required this.controller,
    required this.onMention,
    required this.onHighlight,
    required this.onBreak,
  });
  final QuillController controller;
  final VoidCallback onMention;
  final VoidCallback onHighlight;
  final VoidCallback onBreak;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    return Container(
      decoration: BoxDecoration(
        color: t.colorScheme.surface,
        border: Border(top: BorderSide(color: t.colorScheme.outline)),
      ),
      // One scrolling row: the writing extras first, then the formatting buttons
      child: QuillSimpleToolbar(
        controller: controller,
        config: QuillSimpleToolbarConfig(
          multiRowsDisplay: false,
          showDividers: false,
          showFontFamily: false,
          showFontSize: false,
          showSmallButton: false,
          showInlineCode: false,
          showColorButton: false,
          showBackgroundColorButton: false,
          showClearFormat: false,
          showCodeBlock: false,
          showListCheck: false,
          showIndent: false,
          showLink: true,
          showSearchButton: false,
          showSubscript: false,
          showSuperscript: false,
          showDirection: false,
          showHeaderStyle: true,
          showAlignmentButtons: true,
          showLeftAlignment: true,
          showCenterAlignment: true,
          showRightAlignment: true,
          showJustifyAlignment: false,
          customButtons: [
            QuillToolbarCustomButtonOptions(
              tooltip: 'Mention a character or place',
              icon: const Icon(Icons.alternate_email),
              onPressed: onMention,
            ),
            QuillToolbarCustomButtonOptions(
              tooltip: 'Highlight',
              icon: const Icon(Icons.border_color_outlined),
              onPressed: onHighlight,
            ),
            QuillToolbarCustomButtonOptions(
              tooltip: 'Scene break',
              icon: const Icon(Icons.more_horiz),
              onPressed: onBreak,
            ),
          ],
        ),
      ),
    );
  }
}

class _EntityPicker extends StatefulWidget {
  const _EntityPicker({required this.entities});
  final List<Entity> entities;

  @override
  State<_EntityPicker> createState() => _EntityPickerState();
}

class _EntityPickerState extends State<_EntityPicker> {
  String _q = '';

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    final shown = widget.entities
        .where((e) => e.name.toLowerCase().contains(_q.toLowerCase()))
        .toList();
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom,
        ),
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.of(context).size.height * 0.7,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                child: TextField(
                  autofocus: true,
                  onChanged: (v) => setState(() => _q = v),
                  decoration: const InputDecoration(
                    hintText: 'Mention…',
                    prefixIcon: Icon(Icons.search),
                  ),
                ),
              ),
              Flexible(
                child: ListView(
                  shrinkWrap: true,
                  children: [
                    for (final e in shown)
                      ListTile(
                        leading: CircleAvatar(
                          backgroundColor: t.colorScheme.primary.withValues(
                            alpha: 0.12,
                          ),
                          child: Text(
                            e.name.isEmpty ? '?' : e.name[0].toUpperCase(),
                            style: TextStyle(
                              color: t.colorScheme.primary,
                              fontFamily: Fonts.display,
                              fontSize: 18,
                            ),
                          ),
                        ),
                        title: Text(e.name),
                        subtitle: Text(e.type.name),
                        onTap: () => Navigator.pop(context, e),
                      ),
                    if (shown.isEmpty)
                      const Padding(
                        padding: EdgeInsets.all(24),
                        child: Text('No match.'),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
