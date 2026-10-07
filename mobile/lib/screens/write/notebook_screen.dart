import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../data/backend.dart';
import '../../data/models.dart';
import '../../widgets/common.dart';

const _labels = {
  EntityType.character: 'Character',
  EntityType.location: 'Place',
  EntityType.item: 'Item',
  EntityType.lore: 'Lore',
  EntityType.scene: 'Scene',
};

IconData _icon(EntityType t) => switch (t) {
  EntityType.character => Icons.person_outline,
  EntityType.location => Icons.place_outlined,
  EntityType.item => Icons.diamond_outlined,
  EntityType.lore => Icons.menu_book_outlined,
  EntityType.scene => Icons.view_agenda_outlined,
};

/// The world notebook: characters, places, things and lore, which can be mentioned in any chapter.
class NotebookScreen extends StatefulWidget {
  const NotebookScreen({super.key, required this.project});
  final Project project;

  @override
  State<NotebookScreen> createState() => _NotebookScreenState();
}

class _NotebookScreenState extends State<NotebookScreen> {
  late Future<List<Entity>> _future;
  EntityType? _filter;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<Entity>> _load() async =>
      (await context.read<Backend>().entities(widget.project.id))
          .where((e) => e.type != EntityType.scene)
          .toList();

  void _reload() => setState(() {
    _future = _load();
  });

  Future<void> _edit(Entity? existing) async {
    final name = TextEditingController(text: existing?.name ?? '');
    final desc = TextEditingController(text: existing?.description ?? '');
    var type = existing?.type ?? EntityType.character;
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setS) => Padding(
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
                Text(
                  existing == null ? 'Add to the notebook' : 'Edit entry',
                  style: Theme.of(ctx).textTheme.titleLarge,
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: name,
                  autofocus: true,
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(
                    labelText: 'Name',
                    hintText: 'Lyra Vance, Spire of Whispers',
                  ),
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  children: [
                    for (final tp in EntityType.values.where(
                      (e) => e != EntityType.scene,
                    ))
                      ChoiceChip(
                        selected: type == tp,
                        label: Text(_labels[tp]!),
                        onSelected: (_) => setS(() => type = tp),
                      ),
                  ],
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: desc,
                  minLines: 2,
                  maxLines: 5,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: const InputDecoration(labelText: 'Short summary'),
                ),
                const SizedBox(height: 16),
                Align(
                  alignment: Alignment.centerRight,
                  child: FilledButton(
                    onPressed: () => Navigator.pop(ctx, true),
                    child: const Text('Save'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
    if (saved != true || name.text.trim().isEmpty || !mounted) return;
    final backend = context.read<Backend>();
    try {
      if (existing == null) {
        await backend.createEntity(
          widget.project.id,
          name.text.trim(),
          type,
          desc.text.trim(),
        );
      } else {
        await backend.updateEntity(
          existing.id,
          name: name.text.trim(),
          type: type,
          description: desc.text.trim(),
        );
      }
      if (mounted) _reload();
    } catch (e) {
      if (mounted) say(context, describe(e));
    }
  }

  Future<void> _delete(Entity e) async {
    if (!await confirm(
      context,
      title: 'Delete ${e.name}?',
      text: 'This cannot be undone. Chapters that mention it keep the name as plain text.',
      action: 'Delete',
    ))
      return;
    if (!mounted) return;
    try {
      await context.read<Backend>().deleteEntity(e.id);
      if (mounted) _reload();
    } catch (err) {
      if (mounted) say(context, describe(err));
    }
  }

  void _show(Entity e) {
    final t = Theme.of(context);
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Eyebrow(_labels[e.type]!),
              const SizedBox(height: 6),
              Text(e.name, style: t.textTheme.headlineMedium),
              const SizedBox(height: 8),
              Text(
                e.description.isEmpty ? 'No description yet.' : e.description,
                style: t.textTheme.bodyLarge,
              ),
              if (e.tags.isNotEmpty) ...[
                const SizedBox(height: 12),
                Wrap(
                  spacing: 6,
                  children: [
                    for (final tag in e.tags) Chip(label: Text('#$tag')),
                  ],
                ),
              ],
              if (e.typedAttributes.isNotEmpty) ...[
                const SizedBox(height: 14),
                for (final a in e.typedAttributes)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SizedBox(
                          width: 110,
                          child: Text(
                            a.key.toUpperCase(),
                            style: t.textTheme.labelSmall,
                          ),
                        ),
                        Expanded(child: Text(a.value)),
                      ],
                    ),
                  ),
              ],
              const SizedBox(height: 16),
              Row(
                children: [
                  OutlinedButton.icon(
                    icon: const Icon(Icons.edit_outlined, size: 18),
                    label: const Text('Edit'),
                    onPressed: () {
                      Navigator.pop(ctx);
                      _edit(e);
                    },
                  ),
                  const SizedBox(width: 10),
                  TextButton.icon(
                    icon: const Icon(Icons.delete_outline, size: 18),
                    label: const Text('Delete'),
                    onPressed: () {
                      Navigator.pop(ctx);
                      _delete(e);
                    },
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('World notebook')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _edit(null),
        icon: const Icon(Icons.add),
        label: const Text('Add'),
      ),
      body: AsyncBody<List<Entity>>(
        future: _future,
        onRetry: _reload,
        builder: (context, all) {
          final shown = all
              .where((e) => _filter == null || e.type == _filter)
              .toList();
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
            children: [
              SizedBox(
                height: 40,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  children: [
                    for (final f in [
                      null,
                      EntityType.character,
                      EntityType.location,
                      EntityType.item,
                      EntityType.lore,
                    ])
                      Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: ChoiceChip(
                          selected: _filter == f,
                          label: Text(
                            f == null
                                ? 'Everything'
                                : '${_labels[f]}s'
                                      .replaceAll('Persons', 'People')
                                      .replaceAll('Lores', 'Lore'),
                          ),
                          labelStyle: TextStyle(
                            fontFamily: 'DM Sans',
                            color: _filter == f
                                ? t.colorScheme.surface
                                : t.colorScheme.onSurface,
                          ),
                          onSelected: (_) => setState(() => _filter = f),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              if (shown.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 40),
                  child: Text(
                    all.isEmpty
                        ? 'Your notebook is empty. Add a character or a place and you can mention it in any chapter.'
                        : 'Nothing here yet.',
                    style: t.textTheme.bodyMedium,
                    textAlign: TextAlign.center,
                  ),
                ),
              for (final e in shown)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Card(
                    child: ListTile(
                      leading: CircleAvatar(
                        backgroundColor: t.colorScheme.primary.withValues(
                          alpha: 0.1,
                        ),
                        child: Icon(
                          _icon(e.type),
                          color: t.colorScheme.primary,
                          size: 20,
                        ),
                      ),
                      title: Text(
                        e.name,
                        style: t.textTheme.titleLarge?.copyWith(fontSize: 20),
                      ),
                      subtitle: Text(
                        e.description.isEmpty
                            ? _labels[e.type]!
                            : '${_labels[e.type]} · ${e.description}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      onTap: () => _show(e),
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}
