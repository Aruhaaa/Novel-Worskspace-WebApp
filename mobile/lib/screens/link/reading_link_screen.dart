import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../widgets/common.dart';
import 'shared_reader_screen.dart';

/// Pulls the secret out of whatever was pasted: the whole link, or just the long code at its end.
String? tokenFromLink(String text) {
  final m = RegExp(r'([0-9a-fA-F]{64})').firstMatch(text.trim());
  return m?.group(1)?.toLowerCase();
}

/// Where someone with a reading link from a writer comes to open it.
class ReadingLinkScreen extends StatefulWidget {
  const ReadingLinkScreen({super.key});

  @override
  State<ReadingLinkScreen> createState() => _ReadingLinkScreenState();
}

class _ReadingLinkScreenState extends State<ReadingLinkScreen> {
  final _controller = TextEditingController();
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _paste() async {
    final data = await Clipboard.getData(Clipboard.kTextPlain);
    if (data?.text != null) {
      _controller.text = data!.text!;
      _open();
    }
  }

  void _open() {
    final token = tokenFromLink(_controller.text);
    if (token == null) {
      setState(() {
        _error = 'That does not look like a reading link. Paste the whole link the writer sent you.';
      });
      return;
    }
    setState(() {
      _error = null;
    });
    Navigator.of(
      context,
    ).push(MaterialPageRoute(builder: (_) => SharedReaderScreen(token: token)));
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Reading link')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            const Eyebrow('A private reading copy'),
            const SizedBox(height: 10),
            Text('A writer sent you a link?', style: t.textTheme.headlineSmall),
            const SizedBox(height: 10),
            Text(
              'Paste it here to read their manuscript and leave comments. You do not need an account.',
              style: t.textTheme.bodyLarge,
            ),
            const SizedBox(height: 22),
            TextField(
              controller: _controller,
              minLines: 2,
              maxLines: 4,
              keyboardType: TextInputType.url,
              decoration: const InputDecoration(
                labelText: 'Reading link',
                hintText: 'https://…#/read/…',
              ),
              onSubmitted: (_) => _open(),
            ),
            if (_error != null) ...[
              const SizedBox(height: 10),
              Text(_error!, style: TextStyle(color: t.colorScheme.error)),
            ],
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    icon: const Icon(Icons.content_paste),
                    label: const Text('Paste'),
                    onPressed: _paste,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton(
                    onPressed: _open,
                    child: const Text('Open'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 22),
            Text(
              'Anyone with the link can read the manuscript, so only share it with people you trust.',
              style: t.textTheme.bodySmall,
            ),
          ],
        ),
      ),
    );
  }
}
