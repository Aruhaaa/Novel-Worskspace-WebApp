import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../data/models.dart';
import '../../state/app_state.dart';
import '../../theme.dart';
import '../../widgets/html_view.dart';

/// Reading a chapter: large calm type, your place kept, and a quick way to change size, typeface and theme.
class ReaderScreen extends StatefulWidget {
  const ReaderScreen({
    super.key,
    required this.project,
    required this.chapters,
    required this.initialIndex,
  });
  final Project project;
  final List<Chapter> chapters;
  final int initialIndex;

  @override
  State<ReaderScreen> createState() => _ReaderScreenState();
}

class _ReaderScreenState extends State<ReaderScreen> {
  late int _index = widget.initialIndex.clamp(0, widget.chapters.length - 1);
  final _scroll = ScrollController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => context.read<AppState>().setProgress(widget.project.id, _index),
    );
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  void _go(int i) {
    if (i < 0 || i >= widget.chapters.length) return;
    setState(() {
      _index = i;
    });
    context.read<AppState>().setProgress(widget.project.id, i);
    if (_scroll.hasClients) _scroll.jumpTo(0);
  }

  void _settings() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const _ReadingSettings(),
    );
  }

  void _contents() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => SafeArea(
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.of(ctx).size.height * 0.7,
          ),
          child: ListView(
            shrinkWrap: true,
            children: [
              for (var i = 0; i < widget.chapters.length; i++)
                ListTile(
                  selected: i == _index,
                  leading: Text(
                    '${i + 1}'.padLeft(2, '0'),
                    style: Theme.of(ctx).textTheme.labelSmall,
                  ),
                  title: Text(
                    widget.chapters[i].title.isEmpty
                        ? 'Untitled chapter'
                        : widget.chapters[i].title,
                  ),
                  onTap: () {
                    Navigator.pop(ctx);
                    _go(i);
                  },
                ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final t = Theme.of(context);
    final chapter = widget.chapters[_index];
    final size = 18.0 * state.fontScale;
    final prose = Fonts.prose(
      proseFontById(state.proseFontId).family,
      size: size,
      color: t.colorScheme.onSurface,
    );
    final last = _index == widget.chapters.length - 1;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          widget.project.title,
          style: t.textTheme.titleLarge?.copyWith(fontSize: 20),
          overflow: TextOverflow.ellipsis,
        ),
        actions: [
          IconButton(
            tooltip: 'Chapters',
            icon: const Icon(Icons.list),
            onPressed: _contents,
          ),
          IconButton(
            tooltip: 'Reading settings',
            icon: const Icon(Icons.text_fields),
            onPressed: _settings,
          ),
        ],
      ),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 680),
            child: ListView(
              controller: _scroll,
              padding: const EdgeInsets.fromLTRB(24, 28, 24, 36),
              children: [
                Text(
                  'CHAPTER ${(_index + 1).toString().padLeft(2, '0')}',
                  style: t.textTheme.labelSmall?.copyWith(
                    letterSpacing: 1.6,
                    color: t.colorScheme.primary,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 10),
                Text(
                  chapter.title.isEmpty ? 'Untitled chapter' : chapter.title,
                  style: t.textTheme.displayMedium?.copyWith(fontSize: 34),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 28),
                SelectionArea(
                  child: HtmlView(
                    html: chapter.content,
                    prose: prose,
                    accent: t.colorScheme.primary,
                    muted: state.theme.muted,
                    border: state.theme.border,
                  ),
                ),
                const SizedBox(height: 18),
                Center(
                  child: Text(
                    '∗',
                    style: TextStyle(fontSize: 22, color: state.theme.muted),
                  ),
                ),
                const SizedBox(height: 22),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        icon: const Icon(Icons.chevron_left),
                        label: const Text('Previous'),
                        onPressed: _index == 0 ? null : () => _go(_index - 1),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: last
                          ? OutlinedButton(
                              onPressed: () => Navigator.of(context).pop(),
                              child: const Text('The end'),
                            )
                          : FilledButton.icon(
                              icon: const Icon(Icons.chevron_right),
                              iconAlignment: IconAlignment.end,
                              label: const Text('Next'),
                              onPressed: () => _go(_index + 1),
                            ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ReadingSettings extends StatelessWidget {
  const _ReadingSettings();

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final t = Theme.of(context);
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Reading settings', style: t.textTheme.titleLarge),
            const SizedBox(height: 14),
            Row(
              children: [
                const Icon(Icons.text_decrease, size: 20),
                Expanded(
                  child: Slider(
                    value: state.fontScale,
                    min: 0.8,
                    max: 1.6,
                    divisions: 8,
                    label: '${(state.fontScale * 100).round()}%',
                    onChanged: state.setFontScale,
                  ),
                ),
                const Icon(Icons.text_increase, size: 24),
              ],
            ),
            const SizedBox(height: 6),
            Text('Typeface', style: t.textTheme.labelLarge),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final f in proseFonts)
                  ChoiceChip(
                    selected: state.proseFontId == f.id,
                    label: Text(f.label),
                    onSelected: (_) => state.setProseFont(f.id),
                  ),
              ],
            ),
            const SizedBox(height: 16),
            Text('Theme', style: t.textTheme.labelLarge),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final th in themeOptions)
                  ChoiceChip(
                    selected: state.theme.id == th.id,
                    avatar: CircleAvatar(
                      backgroundColor: th.canvas,
                      radius: 9,
                      child: CircleAvatar(
                        backgroundColor: th.accent,
                        radius: 5,
                      ),
                    ),
                    label: Text(th.name),
                    onSelected: (_) => state.setTheme(th.id),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
