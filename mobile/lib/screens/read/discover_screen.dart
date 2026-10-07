import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../data/backend.dart';
import '../../data/genres.dart';
import '../../data/models.dart';
import '../../state/app_state.dart';
import '../../widgets/common.dart';
import '../link/reading_link_screen.dart';
import 'novel_screen.dart';

/// The reader's home: continue reading, browse by genre, and the novels you saved.
class DiscoverScreen extends StatefulWidget {
  const DiscoverScreen({super.key});

  @override
  State<DiscoverScreen> createState() => _DiscoverScreenState();
}

class _DiscoverScreenState extends State<DiscoverScreen> {
  late Future<List<Project>> _future;
  final _search = TextEditingController();
  String _query = '';
  String? _genre;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<List<Project>> _load() => context.read<Backend>().publishedProjects();

  Future<void> _refresh() async {
    final next = _load();
    setState(() {
      _future = next;
    });
    try {
      await next;
    } catch (_) {
      // the error is shown in the list
    }
  }

  bool _matches(Project p) {
    if (_genre != null && p.genre != _genre) return false;
    final q = _query.trim().toLowerCase();
    if (q.isEmpty) return true;
    return p.title.toLowerCase().contains(q) ||
        p.authorName.toLowerCase().contains(q) ||
        p.description.toLowerCase().contains(q);
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Read'),
          actions: [
            IconButton(
              tooltip: 'Open a reading link',
              icon: const Icon(Icons.link),
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const ReadingLinkScreen()),
              ),
            ),
          ],
          bottom: TabBar(
            labelStyle: Theme.of(context).textTheme.labelLarge,
            tabs: [
              const Tab(text: 'Discover'),
              Tab(
                text: state.saved.isEmpty
                    ? 'Saved'
                    : 'Saved (${state.saved.length})',
              ),
            ],
          ),
        ),
        body: FutureBuilder<List<Project>>(
          future: _future,
          builder: (context, snap) {
            if (snap.connectionState != ConnectionState.done)
              return const Center(child: CircularProgressIndicator());
            if (snap.hasError) {
              final e = snap.error;
              final offline = e is BackendException && e.offline;
              return EmptyState(
                icon: offline ? Icons.cloud_off_outlined : Icons.error_outline,
                title: offline
                    ? 'You seem to be offline'
                    : 'The library did not load',
                text: offline
                    ? 'Connect and pull down to try again. Novels you have already opened still open.'
                    : describe(e!),
                action: OutlinedButton(
                  onPressed: _refresh,
                  child: const Text('Try again'),
                ),
              );
            }
            final all = snap.data!;
            return TabBarView(
              children: [
                _discover(context, state, all),
                _saved(context, state, all),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _discover(BuildContext context, AppState state, List<Project> all) {
    final t = Theme.of(context);
    final byId = {for (final p in all) p.id: p};
    final resume = state.continueReading
        .map((id) => byId[id])
        .whereType<Project>()
        .toList();
    final shown = all.where(_matches).toList();
    return RefreshIndicator(
      onRefresh: _refresh,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        children: [
          TextField(
            controller: _search,
            onChanged: (v) => setState(() => _query = v),
            textInputAction: TextInputAction.search,
            decoration: InputDecoration(
              hintText: 'Search titles, authors, themes',
              prefixIcon: const Icon(Icons.search),
              suffixIcon: _query.isEmpty
                  ? null
                  : IconButton(
                      icon: const Icon(Icons.close),
                      tooltip: 'Clear',
                      onPressed: () => setState(() {
                        _search.clear();
                        _query = '';
                      }),
                    ),
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 40,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                for (final g in [null, ...genres])
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      selected: _genre == g,
                      label: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (g != null) ...[
                            Container(
                              width: 9,
                              height: 9,
                              decoration: BoxDecoration(
                                color: genreColor(g),
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 7),
                          ],
                          Text(g ?? 'All'),
                        ],
                      ),
                      labelStyle: TextStyle(
                        color: _genre == g
                            ? t.colorScheme.surface
                            : t.colorScheme.onSurface,
                        fontFamily: 'DM Sans',
                      ),
                      onSelected: (_) => setState(() => _genre = g),
                    ),
                  ),
              ],
            ),
          ),
          if (resume.isNotEmpty && _query.isEmpty && _genre == null) ...[
            const SizedBox(height: 22),
            const Eyebrow('Continue reading'),
            const SizedBox(height: 10),
            SizedBox(
              height: 168,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: resume.length,
                separatorBuilder: (_, _) => const SizedBox(width: 14),
                itemBuilder: (_, i) => InkWell(
                  onTap: () => _open(resume[i]),
                  child: SizedBox(
                    width: 96,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [Cover(project: resume[i], width: 96)],
                    ),
                  ),
                ),
              ),
            ),
          ],
          const SizedBox(height: 22),
          Eyebrow(_genre ?? (_query.isEmpty ? 'New and noted' : 'Results')),
          const SizedBox(height: 10),
          if (shown.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 36),
              child: Text(
                all.isEmpty
                    ? 'No novels have been published yet.'
                    : 'Nothing matches. Try another word or genre.',
                style: t.textTheme.bodyMedium,
                textAlign: TextAlign.center,
              ),
            )
          else
            for (final p in shown)
              _NovelTile(project: p, onTap: () => _open(p)),
        ],
      ),
    );
  }

  Widget _saved(BuildContext context, AppState state, List<Project> all) {
    final saved = all.where((p) => state.saved.contains(p.id)).toList();
    if (saved.isEmpty) {
      return const EmptyState(
        icon: Icons.bookmark_border,
        title: 'Nothing saved yet',
        text: 'Tap the bookmark on a novel and it waits here for you.',
      );
    }
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      children: [
        for (final p in saved) _NovelTile(project: p, onTap: () => _open(p)),
      ],
    );
  }

  void _open(Project p) =>
      Navigator.of(context)
          .push(MaterialPageRoute(builder: (_) => NovelScreen(project: p)));
}

class _NovelTile extends StatelessWidget {
  const _NovelTile({required this.project, required this.onTap});
  final Project project;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    final state = context.watch<AppState>();
    final progress = state.progressFor(project.id);
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: InkWell(
        borderRadius: BorderRadius.circular(6),
        onTap: onTap,
        child: Card(
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Cover(project: project, width: 72),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        project.title,
                        style: t.textTheme.titleLarge,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        project.authorName.isEmpty
                            ? 'Unknown author'
                            : 'by ${project.authorName}',
                        style: t.textTheme.bodySmall,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        project.description.isEmpty
                            ? 'No description yet.'
                            : project.description,
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                        style: t.textTheme.bodyMedium,
                      ),
                      const SizedBox(height: 10),
                      Wrap(
                        spacing: 10,
                        runSpacing: 4,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          if (project.genre.isNotEmpty)
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Container(
                                  width: 8,
                                  height: 8,
                                  decoration: BoxDecoration(
                                    color: genreColor(project.genre),
                                    shape: BoxShape.circle,
                                  ),
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  project.genre,
                                  style: t.textTheme.bodySmall,
                                ),
                              ],
                            ),
                          if (project.likes.isNotEmpty)
                            Text(
                              '♥ ${project.likes.length}',
                              style: t.textTheme.bodySmall,
                            ),
                          if (progress != null)
                            Text(
                              'Chapter ${progress.chapterIndex + 1}',
                              style: t.textTheme.bodySmall?.copyWith(
                                color: t.colorScheme.primary,
                              ),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
                if (state.isSaved(project.id))
                  Icon(Icons.bookmark, color: t.colorScheme.primary, size: 20),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
