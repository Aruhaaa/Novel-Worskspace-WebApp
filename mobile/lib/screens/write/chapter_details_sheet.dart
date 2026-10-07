import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../data/backend.dart';
import '../../data/models.dart';

/// Where a chapter stands, a line about what happens in it, and private notes. Never part of the book.
Future<void> showChapterDetails(
  BuildContext context, {
  required Project project,
  required Chapter chapter,
  required ChapterNote note,
  required ValueChanged<ChapterNote> onChanged,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (ctx) => _ChapterDetails(
      backend: context.read<Backend>(),
      project: project,
      chapter: chapter,
      note: note,
      onChanged: onChanged,
    ),
  );
}

class _ChapterDetails extends StatefulWidget {
  const _ChapterDetails({
    required this.backend,
    required this.project,
    required this.chapter,
    required this.note,
    required this.onChanged,
  });
  final ValueChanged<ChapterNote> onChanged;
  final Backend backend;
  final Project project;
  final Chapter chapter;
  final ChapterNote note;

  @override
  State<_ChapterDetails> createState() => _ChapterDetailsState();
}

class _ChapterDetailsState extends State<_ChapterDetails> {
  late ChapterNote _note = widget.note;
  late final _synopsis = TextEditingController(text: widget.note.synopsis);
  late final _notes = TextEditingController(text: widget.note.notes);
  Timer? _timer;

  void _changed(ChapterNote next) {
    setState(() {
      _note = next;
    });
    widget.onChanged(next);
    _timer?.cancel();
    _timer = Timer(const Duration(milliseconds: 600), _save);
  }

  Future<void> _save() async {
    try {
      await widget.backend.saveChapterNote(
        widget.project.id,
        widget.chapter.id,
        _note,
      );
    } catch (_) {
      // kept in the sheet; sent again on the next change
    }
  }

  @override
  void dispose() {
    if (_timer?.isActive ?? false) {
      _timer!.cancel();
      unawaited(_save());
    }
    _synopsis.dispose();
    _notes.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    return Padding(
      padding: EdgeInsets.fromLTRB(
        20,
        0,
        20,
        MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('This chapter', style: t.textTheme.titleLarge),
            const SizedBox(height: 14),
            Text('Where it stands', style: t.textTheme.labelLarge),
            const SizedBox(height: 8),
            SegmentedButton<ChapterStatus>(
              showSelectedIcon: false,
              segments: [
                for (final s in ChapterStatus.values)
                  ButtonSegment(value: s, label: Text(s.label)),
              ],
              selected: {_note.status},
              onSelectionChanged: (v) =>
                  _changed(_note.copyWith(status: v.first)),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _synopsis,
              maxLines: 2,
              minLines: 2,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(
                labelText: 'In a line or two',
                hintText: 'What happens here?',
              ),
              onChanged: (v) => _changed(_note.copyWith(synopsis: v)),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _notes,
              maxLines: 5,
              minLines: 3,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(
                labelText: 'Notes to yourself',
                hintText: 'Fix the timeline. Foreshadow the storm.',
              ),
              onChanged: (v) => _changed(_note.copyWith(notes: v)),
            ),
            const SizedBox(height: 8),
            Text(
              widget.backend.isCloud
                  ? 'Private. Never part of the book. Syncs with the web app when it is set up for it.'
                  : 'Private. Never part of the book.',
              style: t.textTheme.bodySmall,
            ),
            const SizedBox(height: 12),
            Align(
              alignment: Alignment.centerRight,
              child: FilledButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Done'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
