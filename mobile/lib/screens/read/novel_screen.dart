import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../data/backend.dart';
import '../../data/genres.dart';
import '../../data/models.dart';
import '../../editor/html_codec.dart';
import '../../state/app_state.dart';
import '../../widgets/common.dart';
import 'reader_screen.dart';

/// A novel's page: its cover, blurb and chapters, with one button to start or carry on.
class NovelScreen extends StatefulWidget {
  const NovelScreen({super.key, required this.project});
  final Project project;

  @override
  State<NovelScreen> createState() => _NovelScreenState();
}

class _NovelScreenState extends State<NovelScreen> {
  late Future<List<Chapter>> _chapters;
  late Project _project = widget.project;

  @override
  void initState() {
    super.initState();
    _chapters = context.read<Backend>().chapters(widget.project.id);
  }

  void _retry() => setState(() {
    _chapters = context.read<Backend>().chapters(widget.project.id);
  });

  Future<void> _like() async {
    final state = context.read<AppState>();
    final user = state.user;
    if (user == null) {
      say(context, 'Sign in to like a novel.');
      return;
    }
    try {
      final updated = await context.read<Backend>().toggleLike(
        _project.id,
        user.id,
      );
      if (mounted)
        setState(() {
          _project = updated;
        });
    } catch (e) {
      if (mounted) say(context, describe(e));
    }
  }

  void _read(List<Chapter> chapters, int index) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ReaderScreen(
          project: _project,
          chapters: chapters,
          initialIndex: index,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    final state = context.watch<AppState>();
    final liked = state.user != null && _project.likes.contains(state.user!.id);
    final saved = state.isSaved(_project.id);
    final progress = state.progressFor(_project.id);

    return Scaffold(
      appBar: AppBar(
        title: const Text(''),
        actions: [
          IconButton(
            tooltip: saved ? 'Remove from saved' : 'Save for later',
            icon: Icon(saved ? Icons.bookmark : Icons.bookmark_border),
            onPressed: () => state.toggleSaved(_project.id),
          ),
          IconButton(
            tooltip: liked ? 'Unlike' : 'Like',
            icon: Icon(
              liked ? Icons.favorite : Icons.favorite_border,
              color: liked ? t.colorScheme.primary : null,
            ),
            onPressed: _like,
          ),
        ],
      ),
      body: AsyncBody<List<Chapter>>(
        future: _chapters,
        onRetry: _retry,
        builder: (context, chapters) {
          final totalWords = chapters.fold<int>(
            0,
            (n, c) => n + HtmlCodec.countWords(c.content),
          );
          final resumeAt = progress == null
              ? 0
              : progress.chapterIndex.clamp(
                  0,
                  chapters.isEmpty ? 0 : chapters.length - 1,
                );
          return ListView(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 28),
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Cover(project: _project, width: 112),
                  const SizedBox(width: 18),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (_project.genre.isNotEmpty)
                          Eyebrow(
                            _project.genre,
                            color: genreColor(_project.genre),
                          ),
                        const SizedBox(height: 6),
                        Text(_project.title, style: t.textTheme.headlineMedium),
                        const SizedBox(height: 4),
                        Text(
                          _project.authorName.isEmpty
                              ? 'Unknown author'
                              : 'by ${_project.authorName}',
                          style: t.textTheme.bodyMedium,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          '${chapters.length} ${chapters.length == 1 ? 'chapter' : 'chapters'} · ${_minutes(totalWords)}${_project.likes.isEmpty ? '' : ' · ♥ ${_project.likes.length}'}',
                          style: t.textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              if (_project.description.isNotEmpty)
                Text(_project.description, style: t.textTheme.bodyLarge),
              const SizedBox(height: 20),
              if (chapters.isNotEmpty)
                FilledButton.icon(
                  icon: const Icon(Icons.menu_book_outlined),
                  label: Text(
                    progress == null
                        ? 'Start reading'
                        : 'Continue: chapter ${resumeAt + 1}',
                  ),
                  onPressed: () => _read(chapters, resumeAt),
                ),
              const SizedBox(height: 26),
              const Eyebrow('Chapters'),
              const SizedBox(height: 6),
              if (chapters.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 18),
                  child: Text(
                    'No chapters yet.',
                    style: t.textTheme.bodyMedium,
                  ),
                ),
              for (var i = 0; i < chapters.length; i++)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: SizedBox(
                    width: 28,
                    child: Text(
                      '${i + 1}'.padLeft(2, '0'),
                      style: t.textTheme.labelSmall,
                    ),
                  ),
                  title: Text(
                    chapters[i].title.isEmpty
                        ? 'Untitled chapter'
                        : chapters[i].title,
                    style: t.textTheme.titleLarge?.copyWith(fontSize: 20),
                  ),
                  subtitle: Text(
                    _minutes(HtmlCodec.countWords(chapters[i].content)),
                    style: t.textTheme.bodySmall,
                  ),
                  trailing: progress != null && i == resumeAt
                      ? Icon(
                          Icons.bookmark,
                          size: 18,
                          color: t.colorScheme.primary,
                        )
                      : const Icon(Icons.chevron_right),
                  onTap: () => _read(chapters, i),
                ),
            ],
          );
        },
      ),
    );
  }

  static String _minutes(int words) =>
      words < 200 ? 'under a minute' : '${(words / 200).round()} min read';
}
