import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../data/backend.dart';
import '../../data/models.dart';
import '../../state/app_state.dart';
import '../../widgets/common.dart';
import '../auth_screen.dart';
import 'project_screen.dart';

/// The writer's home: every book they are working on.
class ProjectsScreen extends StatefulWidget {
  const ProjectsScreen({super.key});

  @override
  State<ProjectsScreen> createState() => _ProjectsScreenState();
}

class _ProjectsScreenState extends State<ProjectsScreen> {
  Future<List<Project>>? _future;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _future ??= _load();
  }

  Future<List<Project>> _load() {
    final user = context.read<AppState>().user;
    if (user == null) return Future.value(const []);
    return context.read<Backend>().myProjects(user.id);
  }

  void _reload() => setState(() {
    _future = _load();
  });

  Future<void> _create() async {
    final title = await askForText(
      context,
      title: 'Start a project',
      label: 'Title',
      hint: 'Whispers of the Starward',
      action: 'Create',
    );
    if (title == null || title.isEmpty || !mounted) return;
    final user = context.read<AppState>().user!;
    try {
      final p = await context.read<Backend>().createProject(user.id, title, '');
      if (!mounted) return;
      _reload();
      await Navigator.of(context)
          .push(MaterialPageRoute(builder: (_) => ProjectScreen(project: p)));
      if (mounted) _reload();
    } catch (e) {
      if (mounted) say(context, describe(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final t = Theme.of(context);

    if (!state.signedIn) {
      return Scaffold(
        appBar: AppBar(title: const Text('Write')),
        body: EmptyState(
          icon: Icons.edit_note,
          title: 'Sign in to write',
          text: 'Reading needs no account. To plan, draft and keep your own novels, sign in or create a free account.',
          action: FilledButton(
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const AuthScreen(signUp: true)),
            ),
            child: const Text('Get started'),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Write')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _create,
        icon: const Icon(Icons.add),
        label: const Text('New project'),
      ),
      body: AsyncBody<List<Project>>(
        future: _future!,
        onRetry: _reload,
        builder: (context, projects) {
          if (projects.isEmpty) {
            return EmptyState(
              icon: Icons.auto_stories_outlined,
              title: 'Your first book starts here',
              text: 'Give it a title and the rest can wait.',
              action: FilledButton(
                onPressed: _create,
                child: const Text('Start a project'),
              ),
            );
          }
          return RefreshIndicator(
            onRefresh: () async => _reload(),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
              children: [
                Text('Which story today?', style: t.textTheme.headlineMedium),
                const SizedBox(height: 4),
                Text(
                  '${projects.length} ${projects.length == 1 ? 'project' : 'projects'}',
                  style: t.textTheme.bodySmall,
                ),
                const SizedBox(height: 14),
                for (final p in projects)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(6),
                      onTap: () async {
                        await Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => ProjectScreen(project: p),
                          ),
                        );
                        if (mounted) _reload();
                      },
                      child: Card(
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Row(
                            children: [
                              Cover(project: p, width: 60),
                              const SizedBox(width: 14),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      p.title,
                                      style: t.textTheme.titleLarge,
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      p.description.isEmpty
                                          ? 'No description yet.'
                                          : p.description,
                                      style: t.textTheme.bodySmall,
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                    const SizedBox(height: 8),
                                    Row(
                                      children: [
                                        Icon(
                                          p.isPublished
                                              ? Icons.public
                                              : Icons.lock_outline,
                                          size: 14,
                                          color: p.isPublished
                                              ? t.colorScheme.primary
                                              : t.colorScheme.outline,
                                        ),
                                        const SizedBox(width: 6),
                                        Text(
                                          p.isPublished ? 'Published' : 'Draft',
                                          style: t.textTheme.bodySmall,
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                              const Icon(Icons.chevron_right),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}
