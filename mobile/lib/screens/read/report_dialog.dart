import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../data/backend.dart';
import '../../data/models.dart';
import '../../state/app_state.dart';
import '../../widgets/common.dart';

/// Why a novel might be reported. The ids are what the database stores; they match the website's.
const reportReasons = <({String id, String label, String hint})>[
  (
    id: 'spam',
    label: 'Spam or advertising',
    hint: 'Repeated links, promotion, or posts that are not real writing.',
  ),
  (
    id: 'harassment',
    label: 'Harassment or hate',
    hint: 'Targets a person or group, threatens, or demeans.',
  ),
  (
    id: 'sexual',
    label: 'Sexual content',
    hint: 'Explicit material in a place that is not marked for it.',
  ),
  (
    id: 'violence',
    label: 'Graphic violence',
    hint: 'Extreme violence or self-harm shown without care.',
  ),
  (
    id: 'copyright',
    label: 'Copyright or plagiarism',
    hint: 'Someone else\'s work posted as their own.',
  ),
  (id: 'other', label: 'Something else', hint: 'Tell us what is wrong below.'),
];

/// Ask why, then send the report. Reports are private: the writer is not told who sent one.
Future<void> reportNovelFlow(BuildContext context, Project project) async {
  final sent = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => _ReportSheet(project: project),
  );
  if (sent == true && context.mounted) {
    say(context, 'Thank you. The report is sent and will be looked at.');
  }
}

class _ReportSheet extends StatefulWidget {
  const _ReportSheet({required this.project});
  final Project project;

  @override
  State<_ReportSheet> createState() => _ReportSheetState();
}

class _ReportSheetState extends State<_ReportSheet> {
  String? _reason;
  final _details = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _details.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final reason = _reason;
    if (reason == null) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await context.read<AppState>().reportNovel(
        widget.project,
        reason,
        _details.text,
      );
      if (mounted) Navigator.pop(context, true);
    } on BackendException catch (e) {
      if (mounted) {
        setState(() {
          _error = e.message;
          _busy = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    // The buttons stay at the bottom of the sheet; only the reasons scroll, so Send is never off the screen
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          left: 20,
          right: 20,
          bottom: MediaQuery.of(context).viewInsets.bottom + 12,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Flexible(
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Eyebrow('Report'),
                    const SizedBox(height: 6),
                    Text('Report this novel', style: t.textTheme.headlineSmall),
                    const SizedBox(height: 4),
                    Text(
                      'Reports are private. The writer is not told who sent it.',
                      style: t.textTheme.bodySmall,
                    ),
                    const SizedBox(height: 8),
                    RadioGroup<String>(
                      groupValue: _reason,
                      onChanged: (v) => setState(() => _reason = v),
                      child: Column(
                        children: [
                          for (final r in reportReasons)
                            RadioListTile<String>(
                              contentPadding: EdgeInsets.zero,
                              value: r.id,
                              title: Text(r.label),
                              subtitle: Text(
                                r.hint,
                                style: t.textTheme.bodySmall,
                              ),
                            ),
                        ],
                      ),
                    ),
                    TextField(
                      controller: _details,
                      maxLines: 3,
                      maxLength: 2000,
                      decoration: const InputDecoration(
                        labelText: 'Anything we should know? (optional)',
                      ),
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: 6),
                      Text(
                        _error!,
                        style: TextStyle(color: t.colorScheme.error),
                        key: const Key('report-error'),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 10),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton(
                  onPressed: _busy ? null : () => Navigator.pop(context, false),
                  child: const Text('Cancel'),
                ),
                const SizedBox(width: 8),
                FilledButton(
                  onPressed: _reason == null || _busy ? null : _send,
                  child: Text(_busy ? 'Sending…' : 'Send report'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
