# House style for the sample library

Every novel in `content/library/` is original fiction written for this app's sample library. These rules apply to all of them. Each novel's own `bible.md` adds its voice, cast and world on top.

## What a good page looks like

- **Scenes, not summaries.** Put people in a place, wanting something, with something in the way. Dramatise. If a stretch of time must pass, cross it in one or two sentences, then land in a scene.
- **Specific over general.** Name the brand of tin, the kind of tree, the dialect word, the exact amount. One true odd detail beats three pretty ones. Check every noun: could it be more particular?
- **Dialogue carries a lot.** Roughly a third to a half of most chapters is people talking, unless the bible says otherwise. Give each speaker a distinct rhythm, vocabulary and habit. People interrupt, dodge, answer a different question, say less than they mean. Avoid dialogue where characters explain things both of them already know.
- **Interiority through choice and perception**, not through lists of feelings. Show what the viewpoint character notices, avoids, misreads and decides.
- **Vary the music.** Mix long and short sentences. Vary how paragraphs open. Do not open consecutive paragraphs with the same word, and do not end every scene on a tidy aphorism.
- **Every chapter turns.** Something changes by the end: a fact learned, a choice made, a relationship moved, a door closed. End on a beat from inside the story (an image, a line of dialogue, a decision), never on a summary or on "and everything changed".
- **Humour belongs wherever the bible allows it.** Even in grim books, people are sometimes funny.
- **Keep the book's promises.** Plant things early; pay them off. Don't introduce new rules of magic, technology or law to rescue a plot late. Characters are consistent in how they look, speak, and what they know.

## Things to avoid

- The stock phrases of machine-written fiction. `scripts/chapter-check.mjs` rejects the worst: "a testament to", "tapestry", "shiver down her spine", "a breath she didn't know she was holding", "couldn't help but", "little did she know", "palpable", "symphony of", "the air was thick with", and more. Do not use them even in a form the checker would miss, and do not swap in near-synonyms. Rewrite the sentence so it says something specific.
- Over-reliance on em dashes. Use full stops, commas, colons and the odd dash. The checker fails more than 14 per 1000 words.
- "Not X, but Y" and "It wasn't just X, it was Y" constructions as a habit. Rare is fine.
- Characters who all think and talk alike; villains who explain their plans; coincidences that solve problems; a convenient letter or diary that delivers the backstory.
- Default fantasy or thriller names and places (Elara, Kael, Lyra, Thorne, Voss, Blackwood, Silas, Mara, Willowbrook, Oakhaven and similar). Use the naming palette in the bible. The checker fails a chapter that uses them.
- Real people, real brands used as plot, and real published characters. Real places and history are welcome where the bible says so, handled accurately and kindly. Do not imitate any living author's voice.
- Anything explicit. Romance is warm and closed-door: kissing and tenderness are fine, anything further fades out. Violence and horror may frighten and may hurt, but are never gratuitous and are never the point. No slurs. Mild profanity only, and only where the character would use it.
- Meta text. No author's notes, no "Chapter ends", no word counts, no summary of what just happened, no mention of being an AI, no headings other than the chapter title.

## File format

Each chapter is `content/library/<slug>/chapters/NN.md`:

```
# The Chapter Title

First paragraph.

Second paragraph, with *italics* for emphasis or thought and **bold** almost never.

* * *

A new scene after a scene break.

> A letter, a notice or a page from a document, when the story needs one.
```

- The first line is `# Title` and nothing else. The title has no number ("The Salt Road", not "Chapter 3: The Salt Road"). The app numbers chapters itself.
- One paragraph per block, a blank line between blocks, no hard line breaks inside a paragraph.
- Straight quotes (`"` and `'`) are fine: the build turns them into typographic quotes. Close every quotation mark inside the paragraph it opens in; start a new paragraph for each new speaker.
- Use `…` or `...` for ellipses and `—` for a dash. No HTML, lists, tables, code blocks or other Markdown.
- A scene break is a line containing only `* * *`.

## Length

Each chapter has a minimum word count, given in your instructions. It is a floor, not a target: aim for the target. If a chapter is short, add what the outline calls for and what the scene deserves (a fuller conversation, a physical beat, a complication, a second location). Never pad with repetition, recaps or throat-clearing.

Check with `node scripts/chapter-check.mjs <file> --min <floor> --max <ceiling>` and fix everything it reports.
