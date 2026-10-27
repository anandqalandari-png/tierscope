# Prompt for Claude Design

Upload these 3 files together: `tierscope-presentation.html`, `tierscope-demo.mp4` and `tierscope-demo-poster.jpg`.
Then paste this:

---

Redesign the attached `tierscope-presentation.html` into a polished 5-slide presentation (16:9). It is a first
draft: the text is final, the design is not.

**Keep**
- All 5 slides, in the same order, and all the text. You can shorten line breaks and regroup lists into cards,
  but don't drop facts or numbers.
- The yellow "Speaker notes" boxes as presenter notes (hidden from the slides, or shown only in a notes view).

**The video (slide 3)**
- Put `tierscope-demo.mp4` where the HTML says `<!-- VIDEO SLOT -->`, with `tierscope-demo-poster.jpg` as the poster.
- Keep `controls` so it can be played, paused and scrubbed. No `autoplay`, no `loop`: it only plays when clicked.
  It has no sound.
- Make the video the main element of slide 3 (about two thirds of the width), with the chapter list beside it.

**Look and feel**
- Brand: Tierscope. Deep green `#0f6e4c` as the accent, near-black `#121614` text, white and very light grey
  backgrounds. A bold, tight sans-serif for headings; a monospace for small labels (the product prints its score
  like a receipt).
- The demo video uses a soft green-to-pink gradient behind a rounded window. Echo that gradient lightly, for example
  on the title slide or behind the video, but keep the other slides clean and minimal.
- Slide 2: three persona cards side by side, each with the quote in large type.
- Slide 4: the 6 steps as a horizontal flow with arrows, then three cards.
- Slide 5: the ranking table as a simple bar or points visual, and the Hot / Warm / Cold / Ignore labels as coloured tags.
- Readable from the back of a room: nothing under 14 px on a 1280 px wide slide.
