import 'package:flutter/material.dart';
import '../theme/forge_tokens.dart';
import '../utils/description_chapters.dart';
import 'description_chapters_hint.dart';

/// Structured chapter rows that rewrite YouTube-style timestamp lines in [controller].
class DescriptionChaptersEditor extends StatefulWidget {
  const DescriptionChaptersEditor({
    super.key,
    required this.controller,
  });

  final TextEditingController controller;

  @override
  State<DescriptionChaptersEditor> createState() => _DescriptionChaptersEditorState();
}

class _DescriptionChaptersEditorState extends State<DescriptionChaptersEditor> {
  bool _open = false;
  final _times = <TextEditingController>[];
  final _titles = <TextEditingController>[];

  @override
  void dispose() {
    _disposeRows();
    super.dispose();
  }

  void _disposeRows() {
    for (final c in _times) {
      c.dispose();
    }
    for (final c in _titles) {
      c.dispose();
    }
    _times.clear();
    _titles.clear();
  }

  void _hydrateFromDescription() {
    _disposeRows();
    final parsed = listChapterDraftRows(widget.controller.text);
    final seed = parsed.isEmpty
        ? const [
            ChapterDraftRow(time: '0:00', title: ''),
            ChapterDraftRow(time: '', title: ''),
            ChapterDraftRow(time: '', title: ''),
          ]
        : parsed;
    for (final row in seed) {
      _times.add(TextEditingController(text: row.time));
      _titles.add(TextEditingController(text: row.title));
    }
  }

  void _commit() {
    final rows = <ChapterDraftRow>[];
    for (var i = 0; i < _times.length; i++) {
      rows.add(ChapterDraftRow(time: _times[i].text, title: _titles[i].text));
    }
    widget.controller.text = applyChapterRowsToDescription(widget.controller.text, rows);
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final t = ForgeTokens.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        DescriptionChaptersHint(description: widget.controller.text),
        TextButton(
          onPressed: () {
            setState(() {
              if (_open) {
                _open = false;
              } else {
                _hydrateFromDescription();
                _open = true;
              }
            });
          },
          child: Text(_open ? 'Hide chapter editor' : 'Edit chapters'),
        ),
        if (_open) ...[
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: t.surfaceContainerHigh.withValues(alpha: 0.5),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: t.outlineVariant.withValues(alpha: 0.4)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Rows write timestamp lines into the description.',
                  style: TextStyle(fontSize: 12, color: t.onSurfaceVariant),
                ),
                const SizedBox(height: 8),
                for (var i = 0; i < _times.length; i++)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Row(
                      children: [
                        SizedBox(
                          width: 72,
                          child: TextField(
                            controller: _times[i],
                            decoration: const InputDecoration(
                              isDense: true,
                              labelText: 'Time',
                            ),
                            onChanged: (_) => _commit(),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: TextField(
                            controller: _titles[i],
                            decoration: const InputDecoration(
                              isDense: true,
                              labelText: 'Title',
                            ),
                            onChanged: (_) => _commit(),
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.close, size: 18),
                          tooltip: 'Remove chapter',
                          onPressed: () {
                            setState(() {
                              _times.removeAt(i).dispose();
                              _titles.removeAt(i).dispose();
                              if (_times.isEmpty) {
                                _times.add(TextEditingController(text: '0:00'));
                                _titles.add(TextEditingController());
                              }
                              _commit();
                            });
                          },
                        ),
                      ],
                    ),
                  ),
                Row(
                  children: [
                    TextButton(
                      onPressed: () {
                        setState(() {
                          _times.add(TextEditingController());
                          _titles.add(TextEditingController());
                        });
                      },
                      child: const Text('Add chapter'),
                    ),
                    TextButton(
                      onPressed: () {
                        setState(() {
                          _disposeRows();
                          _times.add(TextEditingController(text: '0:00'));
                          _titles.add(TextEditingController());
                          _times.add(TextEditingController());
                          _titles.add(TextEditingController());
                          _times.add(TextEditingController());
                          _titles.add(TextEditingController());
                          _commit();
                        });
                      },
                      child: const Text('Clear'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}
