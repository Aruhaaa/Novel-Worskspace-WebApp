import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../data/backend.dart';
import '../../data/genres.dart';
import '../../data/models.dart';
import '../../editor/html_codec.dart';
import '../../state/app_state.dart';
import '../../state/daily_words.dart';
import '../../widgets/common.dart';
import 'chapter_editor_screen.dart';
import 'notebook_screen.dart';

class _Loaded {
  _Loaded(this.chapters, this.notes, this.logs);
  final List<Chapter> chapters;
  final Map<String, ChapterNote> notes;
  final List<WordLog> logs;
}

/// One book: its chapters (drag to reorder), today's progress, and everything else about it.
class ProjectScreen extends StatefulWidget {
  const ProjectScreen({super.key, required this.project});
  final Project project;

  @override
  State<ProjectScreen> createState() => _ProjectScreenState();
}

class _ProjectScreenState extends State<ProjectScreen> {
  late Project _project = widget.project;
  late Future<_Loaded> _future;
  List<Chapter>? _chapters; // the order shown, which can run ahead of the server while a reorder saves
  Map<String, ChapterNote> _notes = {};
  List<WordLog> _logs = [];

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_Loaded> _load() async {
    final backend = context.read<Backend>();
    final dailyWords = context.read<AppState>().dailyWords;
    final results = await Future.wait([
      backend.chapters(_project.id),
      backend.chapterNotes(_project.id),
      backend.wordLogs(_project.id),
    ]);
    final chapters = results[0] as List<Chapter>;
    // Today's count starts from how long the book is this morning
    await dailyWords.startDay(_project.id, {
      for (final c in chapters) c.id: HtmlCodec.countWords(c.content),
    });
    _chapters = chapters;
    _notes = results[1] as Map<String, ChapterNote>;
    _logs = results[2] as List<WordLog>;
    return _Loaded(chapters, _notes, _logs);
  }

  void _reload() => setState(() {
    _future = _load();
  });

  Backend get _backend => context.read<Backend>();

  // ---- chapters ----

  Future<void> _addChapter() async {
    final title = await askForText(
      context,
      title: 'What comes next?',
      label: 'Chapter title',
      hint: 'Chapter 5: The tide table',
      action: 'Create',
    );
    if (title == null || title.isEmpty || !mounted) return;
    try {
      final c = await _backend.createChapter(_project.id, title);
      if (!mounted) return;
      await context.read<AppState>().dailyWords.markExisting(
        _project.id,
        c.id,
        0,
      );
      _open(c);
    } catch (e) {
      if (mounted) say(context, describe(e));
    }
  }

  Future<void> _open(Chapter c) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ChapterEditorScreen(
          project: _project,
          chapter: c,
          note: _notes[c.id],
        ),
      ),
    );
    if (mounted) _reload();
  }

  Future<void> _reorder(int from, int to) async {
    final list = [..._chapters!];
    final moved = list.removeAt(from);
    list.insert(to, moved);
    setState(() {
      _chapters = list;
    });
    try {
      await Future.wait([
        for (var i = 0; i < list.length; i++)
          if (list[i].position != i)
            _backend.updateChapter(list[i].id, position: i),
      ]);
    } catch (e) {
      if (mounted) {
        say(context, 'Could not save the new order. ${describe(e)}');
        _reload();
      }
    }
  }

  Future<void> _delete(Chapter c) async {
    if (!await confirm(
      context,
      title: 'Delete “${c.title.isEmpty ? 'Untitled chapter' : c.title}”?',
      text: 'It moves to Recently deleted, where you can bring it back.',
      action: 'Delete',
    ))
      return;
    if (!mounted) return;
    final state = context.read<AppState>();
    try {
      await _backend.keepDeleted(c);
      await _backend.deleteChapter(c.id);
      await state.dailyWords.forget(_project.id, c.id);
      final rest = [..._chapters!]..removeWhere((x) => x.id == c.id);
      await Future.wait([
        for (var i = 0; i < rest.length; i++)
          if (rest[i].position != i)
            _backend.updateChapter(rest[i].id, position: i),
      ]);
      if (!mounted) return;
      _reload();
      say(
        context,
        'Deleted “${c.title.isEmpty ? 'Untitled chapter' : c.title}”.',
        actionLabel: 'Undo',
        onAction: () => _restoreLast(c),
      );
    } catch (e) {
      if (mounted) say(context, describe(e));
    }
  }

  Future<void> _restoreLast(Chapter original) async {
    final bin = await _backend.recentlyDeleted(_project.id);
    final item = bin
        .where(
          (b) => b.title == original.title && b.content == original.content,
        )
        .firstOrNull;
    if (item != null) await _restore(item);
  }

  Future<void> _restore(DeletedChapter item) async {
    final state = context.read<AppState>();
    try {
      final c = await _backend.createChapter(_project.id, item.title);
      await _backend.updateChapter(c.id, content: item.content);
      // Put it back where it was, moving the chapters after it along
      final current = await _backend.chapters(_project.id);
      final ordered = [...current.where((x) => x.id != c.id)];
      ordered.insert(item.position.clamp(0, ordered.length), c);
      await Future.wait([
        for (var i = 0; i < ordered.length; i++)
          if (ordered[i].position != i || ordered[i].id == c.id)
            _backend.updateChapter(ordered[i].id, position: i),
      ]);
      await state.dailyWords.markExisting(
        _project.id,
        c.id,
        HtmlCodec.countWords(item.content),
      );
      await _backend.forgetDeleted(item.id);
      if (mounted) _reload();
    } catch (e) {
      if (mounted) say(context, describe(e));
    }
  }

  void _showBin() async {
    List<DeletedChapter> items;
    try {
      items = await _backend.recentlyDeleted(_project.id);
    } catch (e) {
      if (mounted) say(context, describe(e));
      return;
    }
    if (!mounted) return;
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheet) => SafeArea(
          child: items.isEmpty
              ? const Padding(
                  padding: EdgeInsets.all(28),
                  child: Text('Nothing has been deleted.'),
                )
              : ListView(
                  shrinkWrap: true,
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
                  children: [
                    Text(
                      'Recently deleted',
                      style: Theme.of(ctx).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 8),
                    for (final item in items)
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text(
                          item.title.isEmpty ? 'Untitled chapter' : item.title,
                        ),
                        subtitle: Text(
                          '${HtmlCodec.countWords(item.content)} words · deleted ${item.deletedAt.toLocal().toString().substring(0, 10)}',
                        ),
                        trailing: Wrap(
                          children: [
                            TextButton(
                              onPressed: () async {
                                Navigator.pop(ctx);
                                await _restore(item);
                              },
                              child: const Text('Restore'),
                            ),
                            IconButton(
                              tooltip: 'Delete for good',
                              icon: const Icon(Icons.delete_outline),
                              onPressed: () async {
                                if (!await confirm(
                                  ctx,
                                  title: 'Delete for good?',
                                  text: 'This one cannot be brought back.',
                                  action: 'Delete',
                                ))
                                  return;
                                await _backend.forgetDeleted(item.id);
                                items = items
                                    .where((x) => x.id != item.id)
                                    .toList();
                                setSheet(() {});
                              },
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

  // ---- the project ----

  Future<void> _edit() async {
    final title = TextEditingController(text: _project.title);
    final desc = TextEditingController(text: _project.description);
    String genre = _project.genre;
    final saved = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setD) => AlertDialog(
          title: Text(
            'Project details',
            style: Theme.of(ctx).textTheme.titleLarge,
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: title,
                  decoration: const InputDecoration(labelText: 'Title'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: desc,
                  minLines: 2,
                  maxLines: 4,
                  decoration: const InputDecoration(labelText: 'Synopsis'),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: genre.isEmpty ? null : genre,
                  decoration: const InputDecoration(labelText: 'Genre'),
                  items: [
                    for (final g in genres)
                      DropdownMenuItem(value: g, child: Text(g)),
                  ],
                  onChanged: (v) => setD(() => genre = v ?? ''),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Save'),
            ),
          ],
        ),
      ),
    );
    if (saved != true || title.text.trim().isEmpty || !mounted) return;
    try {
      final p = await _backend.updateProject(
        _project.id,
        title: title.text.trim(),
        description: desc.text.trim(),
        genre: genre,
      );
      if (mounted)
        setState(() {
          _project = p;
        });
    } catch (e) {
      if (mounted) say(context, describe(e));
    }
  }

  Future<void> _togglePublish() async {
    final publishing = !_project.isPublished;
    final ok = await confirm(
      context,
      title: publishing
          ? 'Publish “${_project.title}”?'
          : 'Take “${_project.title}” down?',
      text: publishing
          ? 'It joins the public library, where anyone can read it. You can take it down again whenever you like.'
          : 'It leaves the public library. Your chapters stay yours.',
      action: publishing ? 'Publish' : 'Unpublish',
    );
    if (!ok || !mounted) return;
    try {
      final p = await _backend.setPublished(
        _project.id,
        publishing,
        context.read<AppState>().authorName,
      );
      if (!mounted) return;
      setState(() {
        _project = p;
      });
      say(
        context,
        publishing ? 'Published to the library.' : 'No longer public.',
        actionLabel: 'Undo',
        onAction: () async {
          final back = await _backend.setPublished(
            _project.id,
            !publishing,
            context.read<AppState>().authorName,
          );
          if (mounted)
            setState(() {
              _project = back;
            });
        },
      );
    } catch (e) {
      if (mounted) say(context, describe(e));
    }
  }

  void _progress(int totalWords) {
    final today = localDate();
    final logs = [..._logs]..sort((a, b) => a.date.compareTo(b.date));
    final byDate = {for (final l in logs) l.date: l.count};
    final days = [
      for (var i = 13; i >= 0; i--) DateTime.now().subtract(Duration(days: i)),
    ];
    final counts = [for (final d in days) byDate[localDate(d)] ?? 0];
    final maxCount = counts.fold<int>(1, (m, n) => n > m ? n : m);
    var streak = 0;
    for (var i = days.length - 1; i >= 0; i--) {
      if (counts[i] > 0) {
        streak++;
      } else if (i == days.length - 1) {
        continue; // today is not over yet
      } else {
        break;
      }
    }
    final t = Theme.of(context);
    showModalBottomSheet<void>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Your writing, over time', style: t.textTheme.titleLarge),
              const SizedBox(height: 14),
              Row(
                children: [
                  _Stat('Total', _fmt(totalWords)),
                  _Stat('Streak', '$streak ${streak == 1 ? 'day' : 'days'}'),
                  _Stat('Today', _fmt(byDate[today] ?? 0)),
                ],
              ),
              const SizedBox(height: 18),
              Text('Last 14 days', style: t.textTheme.labelLarge),
              const SizedBox(height: 10),
              SizedBox(
                height: 90,
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    for (var i = 0; i < counts.length; i++)
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 2),
                          child: Tooltip(
                            message:
                                '${localDate(days[i])}: ${counts[i]} words',
                            child: Container(
                              height: 4 + 82 * counts[i] / maxCount,
                              decoration: BoxDecoration(
                                color: counts[i] == 0
                                    ? t.colorScheme.outline
                                    : t.colorScheme.primary,
                                borderRadius: BorderRadius.circular(2),
                              ),
                            ),
                          ),
                        ),
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

  static String _fmt(int n) => n.toString().replaceAllMapped(
    RegExp(r'(\d)(?=(\d{3})+$)'),
    (m) => '${m[1]},',
  );

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    final state = context.watch<AppState>();
    return Scaffold(
      appBar: AppBar(
        title: Text(_project.title, overflow: TextOverflow.ellipsis),
        actions: [
          IconButton(
            tooltip: 'Notebook',
            icon: const Icon(Icons.public),
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => NotebookScreen(project: _project),
              ),
            ),
          ),
          PopupMenuButton<String>(
            onSelected: (v) {
              switch (v) {
                case 'edit':
                  _edit();
                case 'publish':
                  _togglePublish();
                case 'bin':
                  _showBin();
              }
            },
            itemBuilder: (_) => [
              const PopupMenuItem(
                value: 'edit',
                child: Text('Project details'),
              ),
              PopupMenuItem(
                value: 'publish',
                child: Text(
                  _project.isPublished ? 'Unpublish' : 'Publish to the library',
                ),
              ),
              const PopupMenuItem(
                value: 'bin',
                child: Text('Recently deleted'),
              ),
            ],
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _addChapter,
        icon: const Icon(Icons.add),
        label: const Text('New chapter'),
      ),
      body: AsyncBody<_Loaded>(
        future: _future,
        onRetry: _reload,
        builder: (context, loaded) {
          final chapters = _chapters ?? loaded.chapters;
          final totalWords = chapters.fold<int>(
            0,
            (n, c) => n + HtmlCodec.countWords(c.content),
          );
          final goal = state.profile?.dailyWordGoal ?? 1000;
          final remoteToday =
              _logs
                  .where((l) => l.date == localDate())
                  .map((l) => l.count)
                  .firstOrNull ??
              0;
          final written =
              state.dailyWords.writtenToday(_project.id) > remoteToday
              ? state.dailyWords.writtenToday(_project.id)
              : remoteToday;
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
            children: [
              Card(
                child: InkWell(
                  borderRadius: BorderRadius.circular(6),
                  onTap: () => _progress(totalWords),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Eyebrow('Today'),
                            const Spacer(),
                            Text(
                              '${_fmt(totalWords)} words in the book',
                              style: t.textTheme.bodySmall,
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              _fmt(written),
                              style: t.textTheme.headlineMedium,
                            ),
                            const SizedBox(width: 6),
                            Padding(
                              padding: const EdgeInsets.only(bottom: 4),
                              child: Text(
                                '/ ${_fmt(goal)} words',
                                style: t.textTheme.bodySmall,
                              ),
                            ),
                            const Spacer(),
                            const Icon(Icons.bar_chart, size: 20),
                          ],
                        ),
                        const SizedBox(height: 10),
                        LinearProgressIndicator(
                          value: (written / goal).clamp(0.0, 1.0),
                          minHeight: 6,
                          borderRadius: BorderRadius.circular(3),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 18),
              Row(
                children: [
                  const Eyebrow('Chapters'),
                  const SizedBox(width: 8),
                  Text('${chapters.length}', style: t.textTheme.bodySmall),
                  const Spacer(),
                  if (chapters.length > 1)
                    Flexible(
                      child: Text(
                        'Hold and drag to reorder',
                        style: t.textTheme.bodySmall,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 8),
              if (chapters.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 28),
                  child: Center(
                    child: Text(
                      'No chapters yet. Start with the first.',
                      style: t.textTheme.bodyMedium,
                    ),
                  ),
                )
              else
                ReorderableListView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  buildDefaultDragHandles: false,
                  itemCount: chapters.length,
                  onReorderItem: _reorder,
                  itemBuilder: (context, i) {
                    final c = chapters[i];
                    final words = HtmlCodec.countWords(c.content);
                    final note = _notes[c.id];
                    return Padding(
                      key: ValueKey(c.id),
                      padding: const EdgeInsets.only(bottom: 10),
                      child: Card(
                        child: InkWell(
                          borderRadius: BorderRadius.circular(6),
                          onTap: () => _open(c),
                          child: Padding(
                            padding: const EdgeInsets.fromLTRB(14, 12, 4, 12),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                SizedBox(
                                  width: 26,
                                  child: Text(
                                    '${i + 1}'.padLeft(2, '0'),
                                    style: t.textTheme.labelSmall,
                                  ),
                                ),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        c.title.isEmpty
                                            ? 'Untitled chapter'
                                            : c.title,
                                        style: t.textTheme.titleLarge?.copyWith(
                                          fontSize: 20,
                                        ),
                                      ),
                                      if (note != null &&
                                          note.synopsis.isNotEmpty)
                                        Padding(
                                          padding: const EdgeInsets.only(
                                            top: 3,
                                          ),
                                          child: Text(
                                            note.synopsis,
                                            style: t.textTheme.bodySmall,
                                            maxLines: 2,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ),
                                      const SizedBox(height: 6),
                                      Wrap(
                                        spacing: 10,
                                        runSpacing: 4,
                                        crossAxisAlignment:
                                            WrapCrossAlignment.center,
                                        children: [
                                          Text(
                                            words == 0
                                                ? 'Not started'
                                                : '${_fmt(words)} words',
                                            style: t.textTheme.bodySmall,
                                          ),
                                          _StatusChip(
                                            note?.status ?? ChapterStatus.draft,
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                                PopupMenuButton<String>(
                                  tooltip: 'Chapter options',
                                  onSelected: (v) =>
                                      v == 'delete' ? _delete(c) : _open(c),
                                  itemBuilder: (_) => const [
                                    PopupMenuItem(
                                      value: 'open',
                                      child: Text('Open'),
                                    ),
                                    PopupMenuItem(
                                      value: 'delete',
                                      child: Text('Delete'),
                                    ),
                                  ],
                                ),
                                ReorderableDragStartListener(
                                  index: i,
                                  child: Padding(
                                    padding: const EdgeInsets.all(8),
                                    child: Icon(
                                      Icons.drag_handle,
                                      color: t.colorScheme.outline,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    );
                  },
                ),
            ],
          );
        },
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat(this.label, this.value);
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label.toUpperCase(), style: t.textTheme.labelSmall),
          const SizedBox(height: 2),
          Text(value, style: t.textTheme.titleLarge),
        ],
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip(this.status);
  final ChapterStatus status;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    final done = status == ChapterStatus.done;
    final revising = status == ChapterStatus.revising;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 2),
      decoration: BoxDecoration(
        color: done ? t.colorScheme.onSurface : Colors.transparent,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: revising ? t.colorScheme.primary : t.colorScheme.outline,
        ),
      ),
      child: Text(
        status.label,
        style: TextStyle(
          fontFamily: 'DM Sans',
          fontSize: 11,
          color: done
              ? t.colorScheme.surface
              : (revising
                    ? t.colorScheme.primary
                    : t.colorScheme.onSurface.withValues(alpha: 0.7)),
        ),
      ),
    );
  }
}
