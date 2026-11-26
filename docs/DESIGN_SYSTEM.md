# Gokan SRS: Design System v2

Gokan (語感) is a Japanese study instrument, not a game: calm, precise, trustworthy.
Readability and clarity come first. Hierarchy of information is king, and the app speaks
one stable visual language: a colour, a shape or a word always means, and leads to, the
same thing, so the learner can trust it without thinking.

## 1. Principles

1. **One primary thing per screen.** At most one primary (accent-filled) button per
   screen; the most important information is the largest and comes first.
2. **Content before metadata; the learner's data before the dataset's.** Dataset
   internals (ids, counts, dataset-only fields) sit behind a collapsed "Dictionary
   details" / "Dataset details" `Disclosure` (on a word's page, "Combines N dictionary
   entries"; its few readable facts are in the header's facts row).
3. **Colour is a language** (section 2). Accent never decorates.
4. **Type carries the hierarchy**, through a fixed set of roles (section 3), not ad hoc
   sizes.
5. **Boxes only when they mean something.** A card is an object (an activity, a chart, a
   modal, an item in a grid of objects). Page sections are a heading plus spacing. The
   welcome page is the one exception: its sections are full-bleed bands (section 5, Welcome
   page).
6. **One frame**: two content widths, one header, one Back (section 5).
7. **Everything clickable looks clickable, and nothing else does.**
8. **One word per concept** (section 6).

If a change is ambiguous under these rules, choose restraint.

## 2. Colour

Values are written as CSS custom properties in exactly one file:
`apps/gokan-srs/src/index.css` (`:root` for light, `.dark` for dark). Everywhere else,
use a Tailwind token class (`text-error`, `bg-divider`, `text-feedback-correct`, with
`/opacity` for tints) or, for inline styles and SVG, `THEME` in `commons/theme.ts` (CSS
variables, so dark mode follows automatically).

| Meaning | Token | Used for | Never used for |
| --- | --- | --- | --- |
| Content | `primary` (ink) | Japanese text, glosses, values, titles, body copy | |
| Supporting | `secondary` (neutral grey) | descriptions, readings beside a headword, field labels | links, anything clickable |
| Meta | `tertiary` | counts, dates, captions | body copy |
| Action, selection, focus, your progress | `accent` | links and action text, primary buttons, selected controls, focus rings, progress and mastery fills, the current item | plain text, metadata chips, decorative icons |
| Answer correct | `feedback-correct` (blue) | answer results only: quiz feedback, session ticker, review history, answer charts | anything else |
| Answer wrong | `feedback-incorrect` (orange) | answer results only, as for `feedback-correct` | errors, warnings, destructive actions |
| Error, warning, destructive | `error` | errors, warnings, destructive actions | answer results, decoration |
| Metadata | neutral (`divider` border + `secondary` text) | JLPT level, part of speech, register, status chips | |

Rules that follow from the table:

- Text in `text-accent` is always a link or an action. A plain-text or chip usage of
  accent is a bug: fix the colour, not the rule.
- A link in running text (any `<a>` inside a `<p>`) is also underlined, so it is never
  told apart from the words around it by colour alone (one base rule, `p a`, in
  `index.css`, as in the dictionary, #128; a utility on the link still wins). Rows, cards,
  tabs and buttons are links by their shape and do not sit in a paragraph; nor does a link
  standing alone on its line (a grammar point's chapter link), which is wrapped in a `<div>`
  and underlined on hover only (`check:conventions`, `link-alone-in-paragraph`).
- Correct and incorrect answers use the feedback pair everywhere an answer result is
  shown (quiz feedback and blanks, the session ticker and counter, the hub week chart,
  daily activity, review history, `StackedBarChart` series), always with a second cue
  (position, label, tooltip), never colour alone. A wrong answer is never `error`: the
  answer pair and the error colour are separate languages.
- **Answer results are blue (correct) and orange (wrong) for everyone**, chosen to be
  safe for red-green colour blindness. There is no setting: one pair keeps the colour
  language stable across learners. The hues are Okabe-Ito, contrast-adjusted where
  needed (values below).
- Mastery and review forecasts use the accent in steps (reading 100%, meaning 60%,
  production 35%), never a second hue.
- No categorical hues: quiz kind (construction / inflection / lexical) is neutral text,
  not a colour axis. The former `quiz-cloze` / `quiz-conjugation` / `quiz-lexical` tokens
  are gone.

### Token values (`index.css`)

| Token | Light | Dark |
| --- | --- | --- |
| `--background` | `#F5F0E8` | `#12110F` |
| `--feedback-background` | `#F0EEE8` | `#1C1B18` |
| `--surface` | `#FFFFFF` | `#1C1B18` |
| `--surface-hover` | `#F3EEE6` | `#24221E` |
| `--primary` | `#1a1a2e` | `#E8E4DC` |
| `--secondary` | `#5C5A55` | `#A8A29A` |
| `--tertiary` | `#736B5E` | `#918B83` |
| `--divider` | `#E8E0D0` | `#2C2A26` |
| `--accent` | `#3D5A80` | `#6B8FA8` |
| `--accent-hover` | `#2A405D` | `#8AB4D4` |
| `--error` | `#8A3A2E` | `#E0796D` |
| `--feedback-correct` | `#0072B2` (Okabe-Ito blue) | `#56B4E9` (Okabe-Ito sky blue) |
| `--feedback-incorrect` | `#AD4F00` (Okabe-Ito vermillion, darkened for contrast) | `#E69F00` (Okabe-Ito orange) |

Each answer colour is at least 4.5:1 on `--surface` and `--background` in its theme
(light 5.19 / 4.57 and 5.39 / 4.75, dark 7.46 / 8.18 and 7.65 / 8.38). The blue is
saturated where the accent is a muted slate, so a correct result never reads as a link
or as progress.

`--secondary` and `--tertiary` are deliberately NOT the old accent blue: that collision
(`--secondary` used to equal `--accent`) is why plain text used to read as a link
everywhere. `--mastery-reading/meaning/production` derive from `--accent` via
`color-mix`, so the mastery ladder always follows the accent hue.

Removed: `--muted`, `--subtle`, `--label-neutral`, `--meaning-muted`, the six
`--quiz-*` tokens, and `--error-accent` (a wrong answer's note uses
`feedback-incorrect/45`). A removed token used in a class (`text-muted`, `bg-quiz-cloze`...)
fails `bun run check` (`check-conventions.ts`, rule `design-tokens`) rather than quietly
resolving to nothing. Map an old usage to `primary` (glosses, body copy that was
`meaning-muted`) or `tertiary` (everything else that was `muted`/`subtle`/`label-neutral`).

## 3. Typography

**Fonts** (one Google Fonts stylesheet, preloaded from `index.html` so it starts with the
page and blocks neither the first paint nor the app's script; `display=swap`): Inter
(400/500/600) and Noto Sans JP (400/500), plus Source Serif 4 and Noto Serif JP. Sawarabi Gothic is gone (it has no
weight but 400, so every `font-semibold`/`font-bold` on it used to be synthesized by the
browser).

- `--font-sans`: `"Inter", "Noto Sans JP", system-ui, sans-serif` - the `body` font and
  every UI sans usage (`font-sans`).
- `--font-gothic`: `"Noto Sans JP", "Hiragino Sans", "Meiryo", "Yu Gothic", sans-serif` -
  Japanese UI text (`font-gothic`). A field typed in Japanese sets `placeholder:font-sans`,
  because the placeholder inherits the field's face; the `--font-sans` fallback draws a
  Japanese placeholder (ひらがな, 語) in Noto Sans JP. Enforced (`placeholder-font`).
- `--font-serif`: `"Source Serif 4", Georgia, serif` - page and section titles, the logo.
- `--font-mincho`: `"Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", "MS PMincho",
  serif` - Japanese display (headwords, sentences). `font-serif` has no CJK glyphs; never
  use it for Japanese text, nor at a body size (`text-xs`/`sm`/`base`, or 12 to 17px): that is
  body copy, which is sans and is where inline Japanese lands. Enforced (`serif-body-text`).
  An element that renders a headword (`headwordOf`, `secondaryForm`, `headwordWithReading`)
  names a Japanese face itself (`font-mincho`, `font-gothic` or a `jp-` class), since the face
  it would inherit has no CJK glyphs. Enforced (`headword-japanese-face`).

**Type roles**, defined once as Tailwind v4 `@utility` classes in `index.css`, used
instead of ad hoc size/colour combinations:

| Utility | Spec | Use |
| --- | --- | --- |
| `type-hero` | serif 600, 36px / `sm` 46px / `lg` 56px, leading 1.08, tracking -0.015em, `primary`, balanced | the welcome page `<h1>` only |
| `type-display` | serif 600, 28px / `sm` 34px, leading 1.2, `primary`, balanced | the welcome page's section headings |
| `type-page-title` | serif, `text-2xl` / `md:text-3xl`, `primary` | the one page title |
| `type-section` | serif, `text-xl`, `primary` | section headings in a page |
| `type-subsection` | sans 600, `text-base`, `primary` | card and group titles |
| `type-body` | sans, `text-base`, `leading-relaxed`, `primary` | body copy, glosses |
| `type-support` | sans, `text-sm`, `secondary` | descriptions, supporting lines |
| `type-value` | sans, `text-sm`, `primary` | a fact's value in a header's facts row (`DetailField compact`) |
| `type-meta` | sans, `text-xs` (12px), `tertiary` | counts, dates, captions |
| `type-label` | sans 500, `text-sm`, `secondary`, sentence case | field labels (replaces every uppercase tracked label) |
| `jp-display` | mincho, `text-6xl` / `md:text-7xl`, `primary` | the headword of a detail page |
| `text-kanji` (in `DisplayHeadword`) | mincho, 4rem / 8rem from `md`, `primary`, scaled down to fit | the headword of a new word's intro card and of a desktop quiz card |
| `jp-headword` | mincho, `text-xl`, `primary` | a word or grammar title in a list row |

**Floor**: nothing below 12px, except `em` (relative, used for furigana:
`text-[0.5em]`). Enforced (`font-size-floor`). No uppercase
letter-spaced labels: `tracking-wide`/`wider`/`widest` are gone everywhere, including the
logo (enforced, `no-tracking-wide`); use `type-label` instead. Weights in use: 400, 500,
600 only.

**Furigana**, the same rules in both apps:

- Each reading sits over its run of kanji only, never over okurigana or other kana: 登場し
  carries とうじょう over 登場, 食べる carries た over 食. One function splits a reading,
  `rubyParts` (`@gokan/dataset-schema`); when the kana in a word do not match its reading (an
  irregular reading), the whole word carries the whole reading rather than a wrong split. That
  fallback is marked (`data-ruby-fallback`), the one ruby whose base may hold kana.
- The reading is `font-gothic` (mincho's thin strokes blur at 12px), `0.5em` of the text under
  it. In the app a caller picks only its colour (`Ruby`'s `tone`).
- A ruby (a run of kanji with its reading) never breaks across lines (`white-space: nowrap` on
  `ruby`): the browser would cut base and reading apart, so とうじょうじ would sit over 登場
  and んぶつ over 人物.
- Neighbouring readings never touch: `rt` has `padding-inline: 0.1em` (さんど とうじょう, not
  さんどとうじょう). It only takes space where a reading is wider than its kanji.
- `ruby-align` stays the default. A reading wider than its kanji spreads them a little;
  `center` would keep them together but open a gap on both sides of the word, which reads as a
  space between words.
- In the app every ruby is the `Ruby` component (`components/Ruby.tsx`, enforced,
  `one-ruby`); in the dictionary, `SentenceText.svelte` (styled by `.sentence-jp rt`).

## 4. Shape, surfaces, motion

- **Radius**: `rounded-md` (6px) for every card, panel, input, button and chip,
  including the quiz card frame. `rounded-full` only for pills, avatars, rings, toggles
  and the progress bar.
- **Padding** (`components/ui/Card.tsx`): `sm` = `p-4`, `md` = `p-5 md:p-6`, `lg`
  unchanged (quiz cards).
- **Shadows**: none on in-page surfaces; one soft shadow allowed for overlays (dropdown,
  modal, tooltip).
- **Spacing** (8px grid): page top padding 32px (24px mobile); between page sections
  `space-y-10`; heading to content 16px; inside groups 8 or 12px.
- **A line means a new level, nothing else.** A tab row's `divider` line separates the page's
  header from its one open tab (a word's page); the foot of a word's Dict tab (its facts) sits
  under one line too. Nothing draws a line inside a level: example sentences are 16px apart, not
  ruled. No cards or boxed sections either: a section is a heading plus spacing (principle 5).
- **Motion**: 150-200ms, ease-in-out, no bounce, no elastic. No `hover:scale-*` or
  `active:scale-*` anywhere (enforced, `no-scale-transform`). The one exception is
  explanatory motion on the welcome page only: the ink bloom behind a kanji just marked known
  (520ms) and the accent stroke that runs down "How it works" when the order changes (380ms),
  with the steps settling in after it. Everything on that page stops under
  `prefers-reduced-motion: reduce` (`[data-welcome]` in `index.css`); the states still change.

## 5. Page frame and navigation

- **Two content widths**: `wide` = `max-w-5xl` (1024px), `narrow` = `max-w-3xl` (768px),
  plus the quiz session's own layout. The header's inner container is
  `max-w-5xl mx-auto px-4 md:px-6`, so the logo and navigation line up with page content.
- **`Page`** (`components/Page.tsx`): `width: 'narrow' | 'wide'`, a header, children.
  Every routed page uses it except the quiz sessions and onboarding. `Page` sets its inline
  padding as `--page-inset` (16px, 24px from `md`); an element inside a `Page` that bleeds to its
  edges uses `PAGE_BLEED` and puts the padding back with `PAGE_BLEED_INSET`, never its own
  numbers. The app chrome (header, footer, search bar, banners) still writes the same values as
  `px-4 md:px-6` to line up with page content: a change to one must change the other.
- **`PageHeader`**: left-aligned (centre only for logos and empty states). An optional
  `← Back` row in accent above the title (`navigate(-1)` inside the app, else a
  `parentPath` prop; nothing links to `/grammar` as a "Back", since that route starts a
  session). Title in `type-page-title`, optional `type-support` subtitle, optional
  `actions` slot aligned right.
- **`DetailHeader`**: the identity block of vocab, kanji and grammar pages, not inside a
  card: Back link, the subject as the title (`jp-display` for a word/kanji, mincho
  `text-3xl md:text-4xl` for a grammar point), readings/romaji, neutral chips, and the
  actions area. From `lg` the header uses the body's grid (12 columns, 8/4, `gap-10`), so
  the actions start on the side column's left edge, left-aligned and top-aligned with the
  headword; below `lg` they follow the readings. A page whose body is one column (`DetailBody`
  `tabs` below `lg`, a word's page) passes `layout="column"`: there is no side column to line up
  with, so the actions follow the facts and the status has the full width; from `lg`, where the
  same page is one full page on the grid, it passes `grid`. The actions hold only the status or, before the item is studied, the one primary "Learn this ..." button. The status is one
  line, the next review after the `StatusDot` label ("● Learning · Due now"), and never
  repeats the status word: a mastered item with nothing scheduled shows only
  "● Mastered" (`statusReviewPhrase`). The kanji header keeps Known / Not known. No mastery rings: those, with their values, are only in "Your
  study" (`YourProgress`, a word's page and a grammar point's).
- **`DetailBody`**: the body under every `DetailHeader`. Either from `lg` the same 12-column
  grid, `main` (8: the subject's content, meanings first) and `side` (4: the learner's data,
  related items, the details `Disclosure`), and below `lg` one column in reading order
  (`stacked` when it interleaves the two); or `tabs`: a sticky tab row (`TabNav` page tabs) and
  the panels under it, one column.
- **Tabs on phones, one full page on desktop** (every tabbed detail page, issue 256: the SRS
  word, kanji and grammar pages, one tab state, `useDetailTabs`, and one body, `DetailTabsBody`,
  since #169. The static dictionary switches the same way at `$bp-detail`, with its own plain-TS
  script, `client/detailTabs.ts`: "Detail tabs, shared", section 8). One
  switch width, **1024px** (Tailwind's `lg`, where the 8/4 grid starts; `useFullDetailPage`):
  below it tabs (tablets too), from it one full page with no tab row. `DetailBody` `tabs` takes the
  full page as one prop, `full` (`main`, `side`): the same panel components, in the same order,
  stacked as sections on the grid under a `divider` line, never a second copy of any panel. The
  full page is not everything at once: it keeps the page's levels (the header with its facts, the
  essentials, the rest, a line between levels only, no cards), and every long section shows a
  short preview with its search and "Show N more" in place, so a learner sees every section and
  what is in it without scrolling indefinitely. A hash lands on its section, its heading just
  under the viewport's top; a link that scrolls to a section (a word's Dict links) moves keyboard
  focus to its heading (`DetailSection` `focusable`), which draws the accent focus ring, a hash landing does not; crossing 1024px keeps the learner where they were (the open tab's
  section in view, and back, the section in view as the open tab). The page is `wide` from
  `lg`, `narrow` below. The 12-column grid exists only in these two components
  (enforced, `detail-layout`).
- **Word page** (`pages/vocab/VocabDetailScreen.tsx`): below 1024px `Page width="narrow"`, one
  column: a header holding what a learner looks the word up for, then one row of tabs
  (`DetailBody` `tabs`), one tab open at a time (320, 375 and 768px alike). From 1024px
  `Page width="wide"`, the same header, then the full page (`DetailBody` `full`), no tab row:
  - Main (8): Dict as in its tab (Meanings, Examples, Closest synonyms, its merged entries), then
    under a `divider` line Sentences and Synonyms, each a `type-section` heading (`DetailSection`)
    and its panel. Side (4): Study (Your study, Your mix-ups) for a word in study, Kanji, Related.
  - Previews, chosen on 取る, 輝く and 今 at 1280px: Sentences its tab's first 5 and "Show 5
    more"; Synonyms 2 meaning groups of 3 rows (its tab: 4), then "Show N more meanings"; Related
    5 rows a list (its tab: 10), each "Show N more" in place. 取る is about 2,600px tall at 1280px
    (`check:layout` holds it under 3,200px).
  - The hashes (`#sentences`, `#synonyms`, `#kanji`, `#related`, `#study`) land on their section,
    loaded or followed inside the app, once the sentences have settled; Dict's "All N sentences →"
    and "Compare all N →" scroll to their section and leave the URL as it is. The section in view
    (the one under a line a third of the way down, the main column's first) is kept as the open
    tab, so crossing below 1024px opens it.
  - Header, top to bottom: the headword, its spellings and reading (the kana note for a word
    learned in kana, "Also:" readings), the reading followed by its `PlayButton`: with its
    pitch accent the button follows the first pattern, any other after it, past the row's 16px
    gap, wider than the 8px (4px in the dictionary) the button is pulled back to after the reading
    (so the button reads as the first's, and two contours never read as one line). The space is
    the gap, never a margin on the later pattern, and there is no 、 between them: a wrap drops a
    gap, so a pattern wrapping after the button starts flush under the first, where a margin would
    indent it and a 、 would open its line. A long reading is set smaller to leave the button room
    on its line; the summary gloss (`summaryGloss`, one
    `type-body` line of the first four distinct common glosses); one chips row, the JLPT chip,
    How common on one line (the `FrequencyMeter` and the band's name, the round "Top 300 words"
    and the exact rank in its `title`); under it the facts row (`DetailHeader` `facts`), KKLC step
    (none for a word learned in kana: the kanji orders never teach it) and Textbooks
    (`textbookLessonsLabel`) as `DetailField compact`; the status line under it at every width (`DetailHeader`
    `layout="column"`): Learn this word, or the status and the one due phrase. No Review now: a
    due word is reviewed in the next session. This line is the only place on the page that says "Due now". At 375x667 and 320x568 the
    headword, reading, summary gloss and status line are on the first screen (`check:layout`).
  - The tab row: Dict, Sentences, Synonyms, Kanji, Related, Study, each only when it has
    content, no counts in the labels (each panel's result line gives them). `TabNav` in its
    page mode. Once the header has scrolled away the row sticks at the viewport's top (the app
    header does not stick), on the page background with its `divider` line; a tab chosen while
    it is stuck brings its panel's top just under the row, one chosen while it is in place does
    not scroll, and the open tab tapped again while it is stuck goes back to its panel's top. On
    a phone the row scrolls sideways inside itself, the open tab kept in view; the page never
    does. The row runs to the screen's edges (its tabs padded back in line with the page), so
    the tabs scroll under the edge and a tab cut there shows there is more: choosing a tab
    scrolls the row so a tab is cut at each edge with more behind it (`check:layout`, from
    either end, for every tab). Every tab but Dict has a hash (`#sentences`, `#synonyms`, `#kanji`,
    `#related`, `#study`), replaced as a tab is chosen; the page opens on the hash's tab, else the
    tab last chosen this browser session, else Dict (`initialWordTab`).
  - Dict: Meanings (3 common senses, then "Show all N meanings" in place, rare ones under a
    "Rare and archaic" label), Examples (2 sentences, `pickWordExamples`; "All N sentences →"
    opens Sentences), Closest synonyms (up to 5 `WordTile`s from the first sense's section,
    "For meaning 1: ..." under them, "Compare all N →" opens Synonyms), then at its foot, under a
    `divider` line, "Combines N dictionary entries" for a merged entry.
  - Sentences, Synonyms, Related: one search field each (44px, `text-base`, a hidden label) and a
    count line above the results (`aria-live`); nothing else, no selects, no filter pills. An
    English query matches from the start of a word, a Japanese one anywhere, kana folded;
    matches are marked (`Marked`: `<mark>`, an accent tint, the text's own colour) in the English
    line. Sentences: 5 at a time and "Shortest first"; Synonyms: groups by meaning, each headed
    "3 · to get, to obtain" in `type-subsection` (a group title, not a field label: the groups are
    the tab's structure), 32px apart, 3 rows each and 4 groups at a time; Related: Built from and Used in, 10 at a time.
  - Kanji: each kanji of the word in order as a `KanjiSummary`: its `KanjiTile` linking to its
    page, its meanings, On and Kun readings (`kunReadingLabel`), Known / Not known.
  - Study, for a word in study: Your study (one row of 40px rings, each direction's status
    beside its ring from `sm`, below `sm` a 3-column grid with the name and status centred under
    each ring; a due direction says its stage, not "Due now"; "Added ... · N reviews" on the
    heading's line; the learning curve and review log under one collapsed `Disclosure`), then
    Your mix-ups when there are any, with its search.
- **Kanji page** (`pages/kanji/KanjiDetailScreen.tsx`, issue 169): the word page's two
  arrangements, `narrow` with tabs below 1024px, `wide` and one full page from it.
  - Header: the glyph, its readings labelled On and Kun, neutral chips (JLPT, and the kanji's
    number in the learner's own method, "RTK #346"), then the facts row: How common (the
    `FrequencyMeter` and the band, on the kanji scale: the newspaper list's 2,500, "Top 500 kanji"
    in its `title`), School grade, Strokes, Radical; then Known / Not known and its button.
  - Tabs: Kanji (Meanings, Components as `KanjiTile`s, Common words: the 5 most common, the
    learner's studied ones first, and "All N words →", which opens Words; under a `divider`
    line at its foot, Details folded), Words (`#words`: every word, searchable, 20 at a time),
    Study (`#study`, when the learner studies words with the kanji: "Your words with 学", their
    counts by status, the same list; a kanji only marked known has none: Known is in the header).
  - Full page: main Kanji (Meanings, Components: no Common words, since Words, the next
    section, opens with the same rows; the full page never shows a tab's preview of a section
    above that section), then under a `divider` line Words, 10 at a time; side Study (5 at a
    time, without the JLPT chip: the column is about 300px wide at 1024px), then Details
    unfolded (readings in names, the Kangxi radical's number, every other book's number). 一 (660 words) is about 1,650px tall at 1280px (`check:layout` holds it under 2,100px).
- **Grammar page** (`pages/grammar/GrammarDetailScreen.tsx`, issue 169): the same two arrangements.
  - Header: the title, its romaji, the JLPT chip, then the facts row: Formality, Position (the
    chapter, "Chapter 18, point 3 of 5", a link to it), Kind (construction, inflection,
    lexical); then the status line or "Learn this grammar point".
  - Tabs: Point (Formation; the short explanation and "Read the full explanation" in place;
    When to use; 2 examples and "All N examples →", which opens Examples; the id in a folded
    "Dataset details" at its foot), Examples (`#examples`: the curated examples and the
    corpus's as one searchable list, curated first, 10 at a time, each marked "Curated example"
    or "From the corpus" on its romaji line), Related (`#related`: Similar grammar, Other
    forms), Study (`#study`, a point in study: the compact Your study, one ring; a due point says its
    stage in Study, the header says Due now, so the page says it once).
  - Full page: main Point (Formation, the short explanation with the full one in place, When
    to use: no examples, since Examples, the next section, opens with the same two, and its
    "Examples" heading would be the page's second), then under a `divider` line Examples, 5 at
    a time; side Study, then Related, then "Dataset details" folded (at the foot of Point it
    would sit between two lines). The point with the most curated and corpus examples measured, n5-001, is about
    1,600px tall at 1280px (`check:layout` holds it under 2,000px).
  - The Formation box stays, the one boxed block on these pages: it is an object, a pattern to
    copy (principle 5), not a card around a section, so the "no cards" direction does not
    reach it.
- **Readings**: on in katakana, kun in hiragana with the okurigana in parentheses, まな(ぶ),
  through `kunReadingLabel` in both apps (enforced, `kun-reading`). Parentheses, not a
  colour: every colour already means something (section 2). A reading beside its headword is
  `secondary`, its On/Kun label a field label. A list of readings (On, Kun, and a kanji's
  readings in names in its Details) keeps each reading whole on its line and breaks only after a
  、 (`ReadingList` in `KanjiReadings.tsx`; `check:layout` on the kanji full page's side column at
  1024 and 1280px, where てん once broke as て / ん).
- **A session card's headword** at display size is a `DisplayHeadword`: 4rem on a phone, 8rem
  from `md`, and smaller when the word is too long for its card, so it stays on one line: its
  size is the card's width over its character count (a Japanese character is one em wide),
  never under 1.5rem. Its parts are inline text, never flex items, which shrink to one character
  and stacked a long word's kana (乗り換える, issue 239). `check:layout` holds a five-character
  headword to one line inside its card at 320px, 375px and 1280px.
- **Session cards**: every card of a study session (each exercise, both intro cards, the
  chapter review, the kanji unlock) is drawn in `QuizCardFrame`, which owns one width
  (`w-full max-w-2xl`, on the animated wrapper too) and one padding, so a card's size
  never depends on what it contains.
- **Settings**: Account, Storage (only where the browser can keep progress from being
  cleared: the one place persistent storage is asked for), Appearance (theme), Typing answers
  (romaji as kana; how to add a Japanese keyboard, in a collapsed `Disclosure`), Review pacing,
  AI answer checking, Activity settings, Danger zone. Activity settings holds one collapsed
  `Disclosure` per activity (a `type-subsection` heading and a one-line description), so
  they read as subordinate to the global settings.
- **Desktop/tablet nav** (`md`+): logo, text links Study / Vocabulary / Grammar /
  Listening / Stats / Kanji, then search and Settings. Active link: ink text, 2px accent
  underline; inactive: secondary text, ink on hover.
- **Mobile nav** (below `md`): a top bar (logo, "Gokan", search icon) and a fixed bottom
  tab bar (Study, Vocabulary, Grammar, Stats, More); `/about` before setup has no tab bar.
- **Session focus mode** (`/quiz`, `/grammar`): no nav links, no bottom tab bar, no
  search field - just the logo (links to the hub), a search icon, and an "End session"
  ghost button.
- Footer ("About Gokan SRS", "Dictionary", "What's new", and the version in `type-meta` on
  the right) on every non-session page on desktop; its links are in the mobile More sheet,
  and the version is on About and What's new; `/about` before setup shows the footer at
  every width (`alwaysVisible`).

### Welcome page (`pages/setup/WelcomeScreen.tsx`, `pages/setup/welcome/`)

The homepage before setup, and the page a crawler renders. It departs from the frame above on
purpose, and only here:

- **Bands mark its sections** (principle 5): full-bleed, alternating `background` and
  `surface`, 96px of vertical padding (72px below `sm`), content in a 1120px column with a
  40px gutter (20px below `sm`). Each section starts with a `type-label` and a `type-display`
  heading (`SectionHead`); section labels are never accent.
- **The lede** is the one type combination outside a role: `type-body text-secondary
  sm:text-lg`.
- **Two filled buttons**: the hero's "I already know some kanji" and the closing "Set up
  Gokan", which sits a screen or more below it (principle 1 counts per screen).
- **Buttons** are `Button` at size `lg` (52px); a link that looks like one ("Browse the
  dictionary first") takes `buttonClassName` (`components/ui/buttonStyles.ts`), never a copy.
- **Motion** runs past 200ms in two places (section 4).
- **Boxed glyphs that do not link**: the Try it demo's tiles (toggle buttons, like the
  known-kanji grid's) and step two's two boxes (an illustration of the known tiles above,
  `aria-hidden`). They are the only ones outside `KanjiTile` and the known-kanji grid.

## 6. Shared components

Defined once, in `components/` or `components/ui/`, never copied:

- **`Button`** (`ui/Button.tsx`): variants `primary`, `secondary`, `ghost`,
  `danger-outline`, `danger`. Each variant owns its colours completely; `className` adds
  layout only, never a colour/border/background class (overriding one through
  `className` is what made the Danger zone buttons render invisible).
- **`Chip`** (`ui/Chip.tsx`): the one chip style, neutral only (`border-divider`,
  `text-secondary`). `JlptChip` and `TagChip` are thin wrappers over it.
- **`StatusDot`** (`StatusDot.tsx`): the learning-state language. Mastered = solid accent
  dot, Learning = accent at 35%, New = hollow divider ring, always paired with a text
  label as a second cue.
  It also carries a listening title's watch progress: Watching on the learning step,
  Completed on the mastered step, always with its label.
  A label that wraps keeps the dot beside its first line.
- **`SelectableOption`** (`ui/SelectableOption.tsx`): the one selected style for a
  single-choice option (option grids, the learning-order picker, the theme picker,
  onboarding, a quiz slot's options). Selected: accent border, `bg-accent/10`, a check icon top-right, ink text.
  A quiz's options are drawn only by `quiz/SlotChoices.tsx`: while answering, the picked
  option is the selected one; once answered, the options stop responding (`disabled`), the
  one that fits is the selected one, and a wrong pick is written in the incorrect colour, so
  right and wrong are never told apart by a border alone. Japanese options are gothic, `lang="ja"`.
- **`FilterToggle`** (`ui/FilterToggle.tsx`): the multi-select pill style (list filters,
  genre pills, grammar browse toggles). Selected: accent border, accent text,
  `bg-accent/10`.
- **`ListRow`** (`ui/ListRow.tsx`): a clickable row, always a `<Link>`, never a `div`
  with `onClick`. Hover `bg-surface-hover`, focus-visible accent ring, optional trailing
  slot.
- **Search row** (`SearchBar.tsx`, and the dictionary's `.search-row`, one shape in both apps):
  two lines, 4px apart (`gap-1`). Line 1 the thing itself: a word and its reading, a kanji and
  its main readings, a grammar title and its romaji. Line 2 its type as a neutral `Chip` (Word,
  Kanji, Grammar), leading, then its gloss truncated to one line. The app's status (Learn, a
  status dot, Known / Not known yet) sits in a column as wide as it, centred on the row and flush
  with the row's right padding, so every status ends on one edge down the list (a fixed-width
  column once left an empty band right of Learn); every chip shares one left edge because it
  leads line 2. The dictionary has no status. `check:layout` holds the chips, the gap and the
  flush status for `water` at 320px, 375px and 1280px.
- **`Disclosure`** (`ui/Disclosure.tsx`): a collapsible section (chevron button,
  `aria-expanded`), collapsed by default. Used for dataset/dictionary details, review
  history, rare senses, long explanations.
- **`StackedBarChart`** (`ui/StackedBarChart.tsx`): the one bar chart (the hub week
  chart, the review forecast, daily activity). Bars share a bottom baseline (see
  `utils/stackedBarChart.utils.ts` for why `flex-col-reverse` + `justify-end` does not
  do this); a y-axis shows the max value and a midline; every bar is a focusable button
  that shows its values on hover, focus and tap, its tooltip anchored to the bar's outer
  edge in the first and last third (`tooltipAnchor`) so it stays inside the chart; x labels
  are never truncated. A long chart (the 30-day pacing forecast) keeps one bar a day at every
  width: on a phone its per-bar values are a detail, read through the figures above it.
- **`TabNav`** (`ui/TabNav.tsx`): tabs, active in ink text with a 2px accent underline, in
  two modes. Route tabs (`to`), each its own page, as links: the Grammar home. Page tabs
  (`selected`), panels of one page, as ARIA tabs: buttons with `role="tab"`, `aria-selected`
  and `aria-controls`, panels with `role="tabpanel"`, Left / Right / Home / End moving between
  them; the row scrolls sideways inside itself when too wide (no scrollbar shown), the open tab
  kept in its view, its `divider` drawn under the tabs as a line over its content box only. The
  open tab is kept clear of the edge by the padding, the gap and a slice of the next tab
  (`keepInViewMargin`), then nudged so neither edge falls in a gap between two tabs with more
  behind it (`tabRowScroll`, `utils/tabScroll.utils.ts`): aligned to the padding alone, the
  next tab would start exactly on a phone's edge, hidden whole. A
  page bleeds the row to the screen's edges (`PAGE_BLEED_INSET`) so a tab cut by the edge is
  the cue it scrolls; the gap is `gap-4` on a phone, `gap-6` from `sm`, since a wide gap on the
  edge would hide the next tab whole. A word's page. There is
  no second tab component, and no segmented control: one tab is always open.
- **`TextButton`** (`ui/TextButton.tsx`): an action written as text ("Show 5 more", "Compare
  all 12 →"), accent, underlined on hover; the arrow when it moves the learner down the page.
- **Synonyms panel** (`pages/vocab/explore/SynonymsPanel.tsx`) and **Closest synonyms**: the
  panel lists every synonym in groups by the meaning it shares (the sense's number in Meanings
  and its first two glosses), each row the other word, what they share as its description
  (wrapped, never cut off: it is the row's content, unlike Related words' one-line gloss), and
  how close they are as a neutral `TagChip` told apart by its sign and word (= Interchangeable,
  ≈ Close in this sense, ≠ Not interchangeable), never by a colour. A word mixed up with this
  one says so in the row's trailing slot ("Mixed up 2 times"). One line above says what the quiz
  does with them. Closest synonyms shows the first group's best five (never a ≠ pair) as
  `WordTile`s.
- **`WordTile`** (`WordTile.tsx`): one word as a boxed link, the sign (= or ≈), the headword
  in mincho and its `SecondaryForm`. Boxed because it links, as a `KanjiTile` is (principle 7).
- **`FrequencyMeter`** (`FrequencyMeter.tsx`): four signal bars (5, 8, 11, 14px high, 4px
  wide), as many filled as `frequencyBand` says (Very common 4 to Rare 1), filled `secondary`,
  empty `divider`. Never accent: it is a fact about the word, not the learner's progress. The
  band's name always stands beside it.
- **Your mix-ups** (`pages/vocab/YourMixups.tsx`): in a word page's Study tab, one entry per
  record, newest first: the answer as typed (Japanese, a link only when it names a word) with
  how it was graded, the card's English sentence (or "From its English meanings"), and the date
  in `type-meta`. Five, then "Show all mix-ups". It is an answer history, so the grading uses
  the feedback pair (accepted correct, marked wrong incorrect, the words being the second cue);
  "no penalty" is neither and stays secondary.
- **`KanjiTile`** (`KanjiTile.tsx`): one glyph, a word's kanji or a kanji's components. A
  box (surface, divider border, accent on hover and focus) only when it links to the glyph's
  page; a glyph with no page (氵) is drawn plain at the same size, so nothing unclickable
  looks clickable (principle 7). Optional caption ("Known"); at `size="sm"` (32px) the
  caption sits beside it (a word's kanji in its page's header). Every boxed glyph is one
  (enforced, `glyph-tile`); the known-kanji grid's toggles are the one other, and they are
  buttons. The dictionary's equivalent is the `glyph-tiles` mixin.
- **Lookup card** (`components/lookup/`): any Japanese word or kanji looked up in place, on
  every surface that names one: each word of an `InteractiveSentence` (but the word a quiz card
  is about), every linking `KanjiTile` (not the one beside its own `KanjiSummary`), each kanji
  of a word page's headword and of a new word's intro card's, `WordTile`, synonym, related and mix-up rows, the vocabulary list
  and a kanji's word list. One card, two bodies: the **word card** (headword, its
  `SecondaryForm` (or its reading with its pitch accent, at the same `text-sm`, a second pattern
  at 12px) and `PlayButton`, the first two meanings, `StatusDot`, "Learn this word" for
  a word not in study, never mid-session, and "Open word page") and the **kanji card** (`KanjiSummary` and
  "Open kanji page"). With a mouse it is a popover (`rounded-md`, divider border, `bg-surface`,
  `shadow-lg`, 288px wide), above its trigger and clamped into the viewport, pinned by the edge
  facing its trigger so that growing as its data arrives never covers the trigger (which would
  take its hover for a frame), opened after 220ms
  of hover or focus and kept 120ms after leaving the trigger and the card. In a sentence (an
  inline trigger) a click or Enter pins it until Esc, a click outside or another pin; Enter
  moves focus into it and Esc gives it back. A tile or row (a link trigger) keeps its link on
  click and Enter. On touch, a tap on a sentence word opens the card as a `BottomSheet`; a link
  trigger navigates, with no card, its page being the card's content. Quiz cards keep sentence
  words out of the Tab order. Its pure parts (`utils/lookup.utils.ts`): which click does what
  (`clickAction`), the open/close timing (`lookupReducer`), the placement (`placePopover`).
- **`PlayButton`** (`PlayButton.tsx`): a word's reading or a sentence read aloud. A speaker
  icon in accent (an action), a filled square while it plays; no text, named by `aria-label`
  ("Play 不思議", "Play sentence"), `aria-pressed` while playing. 44px on phones, 32px from `md`,
  with negative block margins so it never heightens its line, and its focus ring drawn inside
  it (`ring-inset`) so it never overlaps the lines around it. After a word's reading (its page
  header, the word card, a new word's intro card; on a word learned in kana, at the first line
  of its kanji-spelling note) and beside each example sentence on a word page, a grammar page and
  the intro card, at the sentence's first line: `SentenceWithPlay` puts it in a right-hand column,
  so it never wraps onto a line of its own. On a centred card (the intro) a word's reading balances
  the button with a `PlaySpacer` as wide as it (`WordReading`'s `intro` variant), so the reading
  stays under the headword, the button right after it. The sentence's row is as wide as the
  sentence and centred (`WordSentence centred`), so its button is right after it at every width;
  from `md` up a spacer on its left balances it too; on a phone the sentence keeps that width for
  its words and its translation is centred on its column instead, so the two share one axis about
  24px left of the headword's. A kana word's spelling note, a long line, is
  balanced from `md` up only, likewise. A word's reading line is one component,
  `WordReading` (the word page header and the intro, enforced). Only where the item has a clip, never disabled; never
  on a quiz card (listening is an exercise there). The intro card is the one session card with
  it: it comes before any exercise on its word, so hearing it gives nothing away. No credit on it:
  every clip is in one voice, credited on About.
- **`PlayControl`** (`PlayButton.tsx`): a clip that is the subject of what is on screen rather than
  a line's companion, first the listening cloze's sentence. A secondary `Button` (44px tall at every
  width) with its words after the speaker in accent: "Play" until the clip has played once (`heard`: its first play has played through, or been stopped),
  then "Play again". Its words never say "Stop": playing shows only as the icon (a filled square) and
  `aria-pressed`, so the accessible name and the state never contradict. It is as wide as "Play
  again" whatever it reads (the longer words laid out unseen), so it never moves. Its host places it
  (the listening cloze centres it under the instruction). Its key goes in `aria-keyshortcuts` and its
  title (the listening cloze's Alt+R). It runs on the same player as
  `PlayButton` (`hooks/useClip.ts`, one clip at a time), so any other clip that deserves a labelled
  control uses it rather than a new button.
- **`BottomSheet`** (`ui/BottomSheet.tsx`): a panel over the bottom of the screen on a
  `bg-primary/20` backdrop, `rounded-t-md`, capped at `max-w-lg` and centred from `sm` up; a
  44px Close (in the heading row, or in the corner when the content names itself), Esc and a
  tap on the backdrop close it. The phone navigation's More and the touch lookup card; no
  second sheet (enforced, `one-sheet`).
- **Option grids with a long tail** (the kanji method picker): the few options most
  learners pick in an `OptionGrid`, the rest in a collapsed "More ..." `Disclosure`, opened
  when the current choice is among them.

## 7. Glossary

One word per concept, applied to all UI copy:

| Use | Instead of |
| --- | --- |
| Study (the hub) | "Choose an activity" pages, "activities" |
| Vocabulary | "vocab" in UI copy |
| Stats (nav and page title) | Statistics |
| Kanji (nav and page title of `/kanji`) | "Kanji Configuration", "Your learning" |
| Settings | "Profile and global settings" |
| New / Learning / Mastered | Graduated, In progress, Introduced, untouched |
| Due, "Next review in 3 days" | Ready |
| Recall rate | Win rate |
| Learn this word / Learn this grammar point | Add to Learning List, Add to Grammar Queue |
| Reading / Meaning / Production | (unchanged) |

Dates go through one formatter set, `utils/time.utils.ts`: `formatDate` ("Apr 19,
2026"), `formatShortDate` ("Oct 11"), `formatDateTime` ("Apr 19, 2026, 6:59 AM"),
`formatWeekday` ("Mon"), all in `en-US`, plus the relative helpers (`formatTimeUntil`)
for future due dates. A `toLocaleDateString`/`toLocaleTimeString`/`dateStyle`/`timeStyle`
call outside that file fails `bun run check` (enforced, `date-formatting`): without it,
the same screen mixed "14 juil.", "19/04/2026" and English weekday labels depending on
the browser's locale.

## 8. Dictionary (`apps/gokan-dictionary`)

The dictionary speaks the same visual language as the app, in SCSS instead of Tailwind
(rules: AGENTS.md, Design rules; layout of the stylesheets: ARCHITECTURE.md).

- **Tokens**: the same values as the table in section 2, written once in
  `src/styles/app.scss` (`:root`, and a `prefers-color-scheme: dark` block: the dictionary
  follows the system theme and has no toggle). Geometry and type stacks are Sass variables
  in `_tokens.scss`, which emits no CSS; the font stacks reach the CSS once, as
  `--font-serif`/`--font-sans`/`--font-mincho`/`--font-gothic`.
- **Colour language**: as section 2. Accent is a link, an action, focus or the current
  item (the word a page is about inside its sentences, a grammar point's pattern, the
  current tab or page). A link in running text (a paragraph) is also underlined, so it
  never rests on colour alone; rows, tiles, tabs and chips are links by their shape, and a
  sentence's words carry a dotted underline. Chips (JLPT level, register, "Common word")
  are neutral; a chip that links (the word page's JLPT chip to its list) shows an accent
  border on hover and focus only.
- **Type**: Source Serif 4, weight 600, Latin subset only, self-hosted as the site's one
  web font, for page and section titles (sentence case, never uppercase letter-spaced).
  Body text is the system sans stack, Inter first when installed. Japanese uses system
  fonts and is always marked `lang="ja"` (prerender fails on Japanese-only text outside a
  `lang="ja"` element, and on a `jp`-class element without it): that attribute is also what sets it in the Japanese face, and what
  stops some devices drawing it with Chinese glyph shapes. Headwords and sentences are
  mincho, readings gothic. Nothing below 12px.
- **Chinese pages** (`/dictionary/zh-hans/...`, #170): `<html lang="zh-Hans">`, so every word of
  their chrome is Chinese to a browser and a screen reader, and draws a character Chinese and
  Japanese share in its Simplified Chinese form; the page's Japanese keeps `lang="ja"`, and
  with it the Japanese faces (the two forms of 直, 骨 or 今 differ). The Chinese UI face is a
  system stack, as the Japanese ones are, set on a Chinese page's `:root` by its locale
  stylesheet (`styles/locales/zh-hans.scss`): sans `Inter, "PingFang SC", "Hiragino Sans GB",
  "Microsoft YaHei", "Noto Sans CJK SC", "Source Han Sans SC", system-ui, sans-serif` (Inter
  for the Latin in it: JLPT, N5, numbers; then macOS and iOS, older macOS, Windows, Android
  and Linux), titles `"Source Serif 4", "Songti SC", "Noto Serif CJK SC", "Source Han Serif SC",
  SimSun, serif` (the Latin serif, then each system's Song face). No web font: a CJK face is
  megabytes, against the 40 KB the one Latin font has. English on a Chinese page (JMdict's
  meanings, an untranslated sentence, a textbook chip, a kanji's meaning or a grammar point's
  explanation in search) is marked `lang="en"`, and a grammar point's romaji `lang="ja-Latn"`
  (check:layout reads the zh-hans search panel for Latin text marked neither).
- **Language switcher**: on a page that has a counterpart in the other language (a word with no
  Chinese page has none), one small line above the breadcrumb at its end: the other page,
  named in its own language (English, 简体中文), a 44px tap target. Neutral text link, no flag:
  `secondary` at the breadcrumb's size, underlined only on hover (a Chinese breadcrumb's links
  are underlined at rest; the switcher, on a line of its own, is not).
- **Links to English from a Chinese page** (a kanji, a grammar point, the dataset, the app):
  marked for a reader as well as by `hreflang="en"`. In the header, a small tertiary 英文 beside
  the section's name (12px), and the same 英文 after the type chip of a search row that opens a
  kanji or a grammar point and beside the `/search/` page's count of each (`inEnglish`, the search catalog's); in a tile or a sentence, in the catalog's words (英文页面,
  汉字（英文）); under the Kanji used tiles, one line (汉字页面为英文). A Chinese breadcrumb's
  links are underlined: its steps are a word or two, so the trail reads as running text.
- **Shape**: 6px radius for cards, chips, tiles, inputs and buttons; the search field is
  the one pill. No shadow except the search panel. Spacing on the 8px scale. Page
  sections are a heading plus spacing, not boxes; a box is an object (a tile, a kanji).
  A glyph tile is a box only when it is a link (the `glyph-tiles` mixin: a kanji
  component with a page is boxed, 氵 is plain), as in the app.
- **Word page** (`pages/VocabPage.svelte`, #168): the app word page's shape, so the two read as
  one product. Header: the headword, its readings, the summary gloss, the JLPT chip (and "Also
  written"), then a facts row (`.entry-facts`, a small tertiary label over each value): How common
  (the four-bar meter, neutral like the app's `FrequencyMeter`, the band's name and "Top 300 words",
  `frequencyBand` and `frequencyTop` over `wordFrequencyRank`, shared with the app) and Textbooks
  (`textbookLessonsLabel`). No "Common word" chip: the band says it. Sections, in the app's names
  and order: **Dict** (Meanings, its first 3 and "Show all N meanings" in place, rare ones in their
  own disclosure; the app panel; Examples, 2 sentences; Forms, the dictionary's own, a verb's or an
  adjective's table right under Examples, so how the word conjugates sits beside how it is used;
  below 40rem a grid row's Plain and Polite stack under its label, each named and the full width,
  so a form stays on one line, and Japanese there breaks `line-break: strict`;
  Closest synonyms, up to 5 from the first
  meaning, never a ≠ pair, "For meaning 1 · ..." under them), **Sentences** (5, then "Show N more"),
  **Synonyms**, **Kanji**, **Related** (Made of, Used in, 5 rows each
  then "Show N more"). Synonyms are grouped by meaning (`synonymSections`, shared with the app, with
  no learner layer), each group titled "For meaning 2 · to pass, to hand", its rows word list rows
  whose gloss column holds the meanings the two words share (the app row's description, what the
  section search reads), then under it, in a `small`, the pair's label in the app's sign and words
  (= Interchangeable, ≈ Close in this sense, ≠ Not interchangeable; `pairCloseness`,
  `CLOSENESS_LABEL`), which the search does not read, marked with the page's lang (inside the
  row's `lang="ja"` link it would read as Japanese otherwise; prerender refuses a word row's
  English left unmarked there, `latinInJapaneseRows`): neutral, told apart by sign and word, never
  by colour. 2 groups of 3 rows show, then "Show N more meanings"; each
  synonym links to its page. The page ships at most 8 words a meaning and 32 in all
  (`lib/synonyms.ts`), and says how many it leaves out.
  - **From 1024px** (`$bp-detail`, the app's `lg`: check:conventions holds them equal): one full page,
    Dict (Forms in it), Sentences and Synonyms in the main column, Kanji and Related in the aside, each long
    section capped as above in a native `<details>` holding the rest of what the page ships.
  - **Below 1024px**: a tab row under the header (Dict, Sentences, Synonyms, Kanji, Related,
    each only when it has content), one section at a time, 44px tabs in a row that scrolls sideways
    inside itself; Dict has no hash, the others the app's (`#sentences`, `#synonyms`,
    `#kanji`, `#related`), so a link means the same in both. `check:layout` measures it at 320 and
    375px (every hash landing on its section alone, at the page top with the tab row in view: the
    script undoes the browser's fragment scroll, which Chrome repeats after load, until the
    reader's first input, on a fresh navigation only: a reload or Back keeps the scroll the browser
    restores, which `check:layout` reloads 取る#sentences scrolled down to see) and the full page at
    1280px. Dict's Examples carry their own source
    credit, as Sentences does: below 1024px each shows alone.
  - **Each sentence once, one furigana toggle** (from 1024px): Examples is Sentences' first 2, so
    the full page starts Sentences after them (those rows tab-only, `detail-preview`, neither
    searched nor counted there); a word with no sentence past them keeps them in Sentences, its
    Examples tab-only instead. Sentences stays one ordered list in tabs. Examples' furigana toggle
    is tab-only too, so the full page has Sentences' alone. `check:layout` holds both at 1024 and
    1280px on 取る.
  - **Detail tabs, shared** (`client/detailTabs.ts`, the `detail-tabs` mixin in `_tokens.scss`,
    the row drawn only by `pages/DetailTabs.svelte`, its label from the catalog, no row for one
    section: `check:conventions`, `one-detail-tabs`):
    shared by the word, kanji and grammar pages (#257). The HTML is
    the full page, every section in order with its heading; with no script a phone gets the stacked
    page. A few inline bytes in the head set `tabbed` on `<html>` before first paint, so the row is
    drawn from the start and, until the script runs, CSS shows only the hash's section (`:target`),
    else the default one (`data-default-panel`): nothing shifts. The script makes the row a
    `role="tablist"` (arrow keys, Home, End, the hash replaced as a tab is chosen) and reads the
    width off the stylesheet (`--detail-query`, from `$bp-detail`) through `matchMedia`, so crossing
    it switches back and forth. A word's Sentences, Synonyms and Related, a kanji's Words and a
    grammar point's Examples each get a search field (44px,
    16px text, a hidden label, a placeholder in `font-sans` short enough to show whole in the field
    at 320px ("English or Japanese": `check:layout` measures every one on a word, a kanji and a
    grammar page), per section since each names only the languages its rows are searched in: on a
    Chinese page Synonyms says English or Japanese, its rows' meanings being English) only when the section has more than a reader takes
    in at a glance, each page's threshold in its bullet: a word's sections past one page, as the
    app's `usePagedPanel` (more rows than it shows before "Show N more"); a kanji's Words past its
    first 30 rows, English reaching those 30 alone (the rest ship headword and reading only, the
  kanji page budget: their glosses would add about 27 KB raw to 一), which a static `meta` line under the
  field says ("English searches the first 30 words.", from the catalog), above the count line:
  a placeholder that long is cut off on a phone and goes once the reader types; a grammar point's Examples past 5 curated examples, or with any from the corpus
    (folded out of sight, nothing paged). A count
    line shows while filtering, with the app's matching
    (`readExploreQuery`, `matchesExploreQuery`, shared from `@gokan/dataset-schema`: English from the
    start of a word, Japanese anywhere, kana folded); the field stays hidden without the script.
- **Kanji page** (`pages/KanjiPage.svelte`, #257): the app kanji page's shape, through the word
  page's tab script and breakpoint. Header: the glyph, its meanings (`entry-gloss`), its readings
  labelled On and Kun (the okurigana in parentheses, `kunReadingLabel`; each reading whole on its
  line, the list breaking only after a 、, as the app's: `check:layout` on 一, 学 and 取 at 320 and
  375px), the JLPT chip ("Outside
  the JLPT lists" in its place when it has no level), then the facts row (`.entry-facts`, the
  `entry-facts` mixin, shared with the word page): How common (the four-bar meter and the band on
  the kanji scale, "Top 100 kanji", as the app's), School grade, Strokes, Radical. Sections, in the
  app's names and order: **Kanji** (the app panel; Components; Common words, the 5 most common and
  "All N words →" to Words, in tabs only; In kanji courses: each book, its step under it reading
  "Step 212" on every row, linked to the range page of that order holding it when the book has
  one, a linked step underlined at rest so it is not told from a plain one by colour alone
  (`check:layout`), each step a 44px band linked or not; one secondary line under the heading,
  shown only when a step is linked, says each linked step leads to the words you can read at that
  point, and the link's accessible name repeats it in visually hidden text, ": the words you can
  read at this step"; then Details folded under a divider line: readings in names, the Kangxi
  radical's number) and **Words** (`#words`: 30 rows with their gloss, the rest headword and
  reading only in "All N words"; searchable past the first 30, in Japanese across every row and in
  English across the 30 with a gloss, as the line under its field says). A kanji no word uses has no Words
  section and no tab row; its Kanji section keeps a Common words section, a heading with the
  section's gap and one line ("No word in this dictionary uses this kanji yet."), shown at every
  width, so no words reads as a fact, not a list that failed to show.
- **Grammar page** (`pages/GrammarPage.svelte`, #257): the app grammar page's sections in its
  order. Header as before: the title, its romaji, the JLPT and formality chips, the chapter.
  **Point** (Formation, the one boxed block; the short explanation as the lead, the long one in
  place under it, "Read the full explanation"; the app panel; When to use; 2 examples, curated
  first, then the corpus's for a point with none curated, and "All N examples →" to Examples, in
  tabs only; N counts every corpus example, as "Corpus examples (N)" does, not only the 25 shipped), **Examples** (`#examples`: every curated example, then the
  corpus's in "Corpus examples (N)", searchable when there are more than 5 or any from the corpus),
  **Related** (`#related`: Conjugation, Other forms, the family's points).
- **Kanji and grammar pages, both arrangements**: below 1024px the tab row (Kanji, Words; Point,
  Examples, Related; each only when it has content, no row when only the first has), one section at
  a time, the first tab with no hash; from 1024px, and with no script at any width, one full page,
  every section stacked in order. A first tab's preview of the next section (`.detail-preview`, the
  `detail-tabs` mixin) shows only in tabs: the full page never shows a preview above the section it
  previews. `check:layout` measures 一, 学, 取, n5-001 and n5-016 tabbed at 320 and 375px (every
  hash landing on its section alone, at the page top) and whole at 1024 and 1280px, and searches
  一's Words and n5-001's Examples by their first row's English.
- **Play buttons** (`pages/PlayButton.svelte`, #255): the app's `PlayButton` in the dictionary's
  terms. An accent icon button (a speaker, a stop square while it plays), no border or fill, 44px
  at every width with negative block margins so the line it ends keeps its height. A word's follows
  its reading in the header (a word learned in kana: its kanji-spelling note); a sentence's is a
  right-hand column at its first line, the sentence never wrapping under it (`.play-row`). Only
  items with a clip have one, never a disabled one, and none shows without script (the `playable`
  pre-paint class). Its name is the catalog's ("Play 取る", "Play sentence"; 播放…, 播放例句), in
  the page's language. A page with buttons credits the voice in its footer, one line, the credit in
  Japanese linked to the voice's terms. Rules: the `play-buttons` mixin, in the word and grammar
  sheets (`check:layout`: named, 44px, at the first line, at 320, 375 and 1280px).
- **App panel** (`pages/AppPanel.svelte`, #244): once per page, after what the reader came
  for, never above it: right after the header where the header holds it (a kanji's meanings and
  readings); on a word page after the Meanings section, so the definition comes first, on a
  phone most of all (`check:layout`); on the home page, a short section under the hero; on a
  grammar page after the Formation block and its lead line, so two accent-edged boxes never stack
  and Formation stays first. On the surface with a divider border and a
  3px accent left edge, the accent marking the action. One sentence in body text, then one
  button-styled link (accent fill, `accent-contrast` text, 44px tall), its label short enough
  for one line at 320px with a four-digit step ("Start after step 99"; `check:layout` measures
  it on an English and a Chinese word page). On a Chinese page a step's action carries no
  （英文）: its sentence says it, right after "Gokan" (Gokan（英文页面）). A Japanese word in the
  sentence never breaks across lines where it fits one, and one wider than the line wraps inside
  the panel rather than scrolling the page (an `inline-block` at `max-width: 100%`, never
  `nowrap`; `check:layout`, with a long headword). The panel stands 40px (`$space-5`) above what
  follows it on every page type, a section's gap, and on a word page 40px under Meanings too
  (`.entry-main > .app-panel`; elsewhere the header's own margin sets the gap above;
  `check:layout`, a word, kanji, order, range and grammar page). Never a popup, a dismiss
  button or a carousel. Its rules are the `app-panel` mixin (`_tokens.scss`), included by each
  page sheet that shows it: in `app.scss` they took the shared stylesheet past its budget of the time (10 KB raw).
- **Shared between page sheets**: a rule two page types use goes in `app.scss`, unless most
  pages would carry it for nothing (every page downloads `app.scss`, and it counts in every page's
  blocking stylesheets' budget); then it is a mixin in `_tokens.scss` (`glyph-tiles`, `entry-gloss`,
  `stacked-entries`, `app-panel`, `play-buttons`) included by each page sheet, so the source stays one copy.
- **Frame**: "Skip to content" is the first focusable element of every page. The header's
  inner container is the wide measure (960px) on every page, so it lines up with the entry
  pages. Wide screens: one row (logo, nav, search on the right). Phones (below 40rem): at
  most two rows, the logo shortened to 語感 beside the nav, then the search field; the home
  page's hero is its search field, so the header leaves its own out. Nav links, pager
  links, toggles, tiles, disclosure summaries and a link that is its row's one action (a
  kanji's book position, a range step's glyph) are at least 44px tall.
- **Lists**: a word list is three aligned columns, headword | reading | gloss (stacked
  on a phone and in the word page's aside); the reading shows only when it differs from
  the headword, and a word learned in kana is never listed by its kanji spelling. The gloss
  is the row's one span with a `lang` (English's `en`, a Chinese page's `zh-Hans`), which is
  how the stylesheet puts it in its column in the sans face, in either language, at no bytes
  per row; a Chinese gloss is cut at about 20 characters, at a 、 or ； when one falls inside
  (`shortWordTextSummary`). `check:layout` holds the column at 1280px and the own line on a
  phone. A long list shows its head and puts the rest in a `<details>` ("All 401 words"):
  collapsed, but every link stays in the HTML.
- **Romaji** (#278, English pages only): a reading in Hepburn (`romajiOf`, `kanaToHepburn`:
  勉強 benkyou, こんな konna), set in the UI sans face (Inter), `lang="ja-Latn"`, in the ink of the
  kana it spells (secondary), never accent: a fact about the word, not an action. In a word page's
  header it shares one baseline with the headword and the reading (its pitch accent and play button
  included), 24px apart, with no separator, and before the other readings ("· also ..."), which come
  last so the romaji reads as the primary reading's; the line wraps as a whole (`.entry-line`). In
  the Forms table it is each form's third line, under its kana, in the kana's `small` style,
  wrapping only between morae (`<wbr>` from `romajiParts`). A word whose
  romaji is shared gets one tertiary line closing its header, "Also read hashi: 箸 chopsticks, 端
  edge" (the romaji linking its romaji page, each word its own and named by its first gloss term,
  notes dropped, unless that names two words alike: then its first gloss whole, 取る's page naming
  撮る "to take (a photograph)", `alsoReadTerms`; three named, the rest counted). A
  **romaji page** (`pages/RomajiPage.svelte`) is a title ("hashi in Japanese"), one intro sentence,
  and word list rows most frequent first, the reading cell drawing the pitch accent and the note
  (level, frequency band, the pitch in words) inside the gloss's cell, the headword and reading
  centred on the two (`noteInGloss`, `.entry-list--note-in-gloss`); it links the word page's stylesheet,
  which draws the pitch accent. A reading the intro names (きねん or きんえん) never breaks across
  lines where it fits one, as in the app panel (the `whole-japanese` mixin, `check:layout` on
  `/romaji/kinen/`).
- **Furigana toggle**: "Hide furigana" / "Show furigana", in the section header of every
  page with sentences. It sets `furigana-hidden` on `<html>` and remembers the choice in
  `localStorage` (read in a try/catch, shown by default). It lives in the search script
  every page already loads, and stays hidden without JavaScript.
- **Motion**: transitions are 150ms ease-in-out and none under `prefers-reduced-motion`.
- **Budgets**, checked after every build by `scripts/check-build.ts`, which fails the
  build when one is exceeded (`src/lib/budgets.ts`), the same in every language (a Chinese
  word page is held to the word page's). Sizes are what a reader downloads: brotli, as CloudFront
  sends it (quality 5, which matched what it served within about 2% on every page type, #268),
  with the raw size beside it in the report.

  | Item | Budget (brotli) |
  | --- | --- |
  | Word page HTML, 90th percentile | 13 KB |
  | Kanji page HTML, the heaviest | 13 KB |
  | Grammar point page HTML, the heaviest | 13 KB |
  | Home page HTML | 13 KB |
  | `/grammar/` HTML, to the end of its first screen | 13 KB |
  | Each JLPT list page, to the end of its first screen | 13 KB |
  | Each kanji order page (hub, order, range of 100 steps), to the end of its first screen | 13 KB |
  | Romaji page HTML, the heaviest | 13 KB |
  | A page's blocking stylesheets together (`app.scss`, its page sheet, its locale's) | 14 KB |
  | Search script (every page), with its shared chunks | 7 KB |
  | Query engine (loaded on first focus) | 7 KB |
  | Detail tabs script (word, kanji and grammar pages), with its shared chunks | 5 KB |
  | Clip player script (pages with a play button) | 1 KB |
  | `search-core.json` | 415 KB |
  | Web fonts | one woff2, 40 KB as it is (compressed already) |
  | Svelte client runtime | none |

  **The 14 KB rule.** A new connection sends about 10 packets before it waits for an
  acknowledgement: RFC 6928 sets TCP's initial window to 10 segments, "(maximum 14600 B)", and
  RFC 9002 gives QUIC the same budget (14,720 bytes). What fits arrives in one round trip; past
  it, each further window costs another, which on a phone's latency is the cost worth guarding.
  The dictionary's CloudFront distribution sets no `http_version` (`apps/gokan-srs/terraform/main.tf`):
  HTTP/1.1 and HTTP/2 over TCP, so the 14,600-byte figure applies. It is a rule of thumb, not an
  edge: the response headers (about 0.5 KB) count against it, the TLS handshake comes first on a
  new HTTPS connection, a CDN may tune its window higher, and a reused connection (any page after
  the first) is not limited this way. So a page's HTML is held to 13 KB of brotli. Beyond the
  first screen, size matters much less: a long list page (the JLPT lists, the kanji order pages,
  `/grammar/`) is not split (its URLs, sitemap and pagination stay), and is held to the rule up
  to the end of its first screen at 375x812, counted as its HTML through its first N rows inside
  `<main>` (`FIRST_SCREEN_ROWS`: 5 grammar points, 10 words, 10 rows or tiles of an order page,
  above the 3, 7 and 7 measured on 2026-11-22). `check:layout` fails when those rows no longer
  reach that screen's end, on one page of every shape counted so (`/grammar/`, a JLPT list's first
  and numbered pages, every order's hub and a range page of each: `dictionaryListShapes`), so the
  count covers what a reader sees first.

  The stylesheets are a second round trip whatever their size: the browser asks for them once the
  HTML starts arriving, on the same connection, by which time the window has roughly doubled, so a
  page's blocking stylesheets are held together to 14 KB (3 to 5 KB measured), every set a page
  type links: `check-build` fails when a page type's sheet is linked by no page it measures. Inlining the shared
  stylesheet (2.5 KB brotli) would give one-round-trip first paint at the cost of those bytes on
  every page and its cache across pages: a trade-off to measure, not assume. The scripts and the
  search index load past the first screen: their budgets are regression guards, about 25% over
  what they measured on 2026-11-22, not design limits.

  Measured on 2026-11-22: word pages 4.1 KB at the 90th percentile (18.5 KB raw), the heaviest
  kanji page (人) 12.9 KB, the tightest by far (a kanji's Words section is what to trim first),
  the heaviest grammar point 8.1 KB, home 1.8 KB; the list pages' first screens 1.4 to 1.9 KB
  (their whole pages up to 27 KB). Until #268 the budgets counted raw bytes, a poor proxy: a 20 KB
  word page is about 4 KB on the wire, so ordinary features kept failing a limit far stricter than
  the rule behind it (the pitch accent, #176, took Chinese word pages to 20.2 of 20 KB raw). A
  budget is a decision about what a page costs a reader on a phone: raise one here, deliberately,
  never to make a build pass, and a change that spends a guard's headroom says what for (not
  mechanised: a reviewer compares `check-build`'s report before and after the change). A script is
  measured with the chunks it imports statically, each compressed on its own as it is served:
  since #168 the detail tabs script and the search engine share the kana folding (`romaji`), and
  the search script and the detail script the locale reading, each a chunk of its own. Page weight is one half of
  being found; the other, SEO at 100 on every page type, is held by the Lighthouse check
  (`scripts/check-lighthouse.ts`, in section 9).

## 9. Enforcement (`scripts/check-conventions.ts`)

- `design-tokens`: no default Tailwind palette colour, no numeric shade on a theme
  token, no raw colour value, no removed token (`muted`/`subtle`/`label-neutral`/
  `meaning-muted`/`quiz-*`) outside `index.css` / `app.scss`.
- `font-size-floor`: no `text-[Npx]` with N < 12 or `text-[Nrem]` with N < 0.75 in
  `apps/gokan-srs/src`; `em` stays allowed (furigana).
- `no-scale-transform`: no `hover:scale-*` or `active:scale-*`.
- `no-tracking-wide`: no `tracking-wide`, `tracking-wider` or `tracking-widest`.
- `date-formatting`: `toLocaleDateString`/`toLocaleTimeString`/`dateStyle`/`timeStyle`
  only in `utils/time.utils.ts`.
- `kun-reading`: a kun reading is rendered through `kunReadingLabel`, in both apps.
- `glyph-tile`: a boxed mincho glyph (`font-mincho text-2xl` with a border) only in
  `KanjiTile` (and the known-kanji grid's toggle buttons).
- `detail-breakpoint`: the dictionary's `$bp-detail` equals gokan-srs's `--breakpoint-lg`, the
  one width where every detail page turns from tabs into the full page.
- `detail-layout`: `grid-cols-12` only in `DetailHeader` and `DetailBody`, and every
  `*DetailScreen` uses both.
- `one-ruby`: a `<ruby>` in the app only in `components/Ruby.tsx`.
- `one-choice-list`: a quiz slot's options (`choices`) are walked only in
  `components/quiz/SlotChoices.tsx`.
- `one-sheet`: a sheet's panel (`rounded-t-md`) only in `components/ui/BottomSheet.tsx`.
- `one-lookup-card`: `createPortal` only in the lookup card (`components/lookup/useLookup.tsx`),
  `BottomSheet` and the quiz settings dialog: a word or kanji shown on hover or tap is the
  lookup card, never a second popover.

**Layout, in a browser** (`scripts/check-layout.ts`, `bun run check:layout`, run by CI in
`.github/workflows/ci-site.yml` on both production builds, built once for it and Lighthouse): at 320 and 375px, on the
app's onboarding and main routes and the dictionary's page types, no page scrolls
sideways, no text is below 12px (furigana in `rt` and SVG chart labels excepted), every
input is at least 16px (smaller makes iOS zoom), the dictionary's nav links, pager links,
toggles, tiles, disclosure summaries and single-action links are at least 44px tall, every
dictionary list row is plain (primary ink, no underline), and a word in a dictionary
sentence carries only its dotted border, never the running-text underline, and no word in an
app sentence (linked or studied) has side margin or padding (Japanese has no spaces between
words), no example sentence is ruled (a word page's and a grammar page's are spaced apart), a word
page's tabs are 44px tall on a phone, no
reading sits over kana (a marked fallback excepted), no ruby breaks across lines and no two
readings on a line touch (measured on their glyphs), no kanji reading (`KanjiReadings`, on a
word page's Kanji tab) breaks across lines, a sentence word hovered with a mouse at 1280px
keeps its hover while its lookup card opens, a due word's page has no Review now, and a sentence word tapped on a word
page opens its lookup card as a bottom sheet inside the viewport, its Close and its links (Open
word page) 44px, and a drill's way in (`DrillLink`, the button size `touch`, measured on a
chapter's "Drill the related points" and a grammar point header's "Drill against its siblings")
44px on a phone. A new page type or main route is added to its lists.

**Lighthouse, SEO at 100** (`scripts/check-lighthouse.ts`, `bun run check:lighthouse`, run by
CI in `.github/workflows/ci-site.yml` on both production builds): one representative page
per dictionary type and the SRS welcome page, plus the SRS hub and anime list reached with
onboarding seeded, on mobile and desktop. SEO must be 100 on every dictionary page and the SRS
welcome, failing the job below it, because a crawlable dictionary is the point. The dictionary
also holds accessibility and best practices at a floor taken from the first baseline and only
ever raised (both 1.00 today), and every SRS page (welcome, hub, anime list) holds
accessibility at 1.00 (#134). Every SRS run's network list is also checked: no dataset file
is downloaded twice in one page load, and the anime list asks for its own files before the
study flow's background loads. The hub and anime list are otherwise recorded: they are
image-heavy (AniList cover art) and measured to track that cost (#129). The local server
brotli-compresses text files as CloudFront does, so the bytes Lighthouse times are the bytes a
visitor downloads. Performance is recorded everywhere, not gated, since it still moves between
runs: the SRS pages take the median of three runs, the dictionary pages one. A new dictionary page type is added to the shared `dictionaryPages()` list
(`scripts/lib/builtSite.ts`), which `check-layout` measures too.

A red check here is never fixed by relaxing the rule; fix the code, or change this
document and the check together, deliberately, and say so in the PR.

**Before shipping UI**: read the sections of this document for what you touch, reuse the
components of section 6, and look at the result at 320px, 375px and desktop width, light
and dark. The checks catch what can be measured; whether a colour means the right thing,
or a box is an object, is still read by eye.
