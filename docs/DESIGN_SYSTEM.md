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
   details" / "Dataset details" `Disclosure`.
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
  Japanese UI text (`font-gothic`).
- `--font-serif`: `"Source Serif 4", Georgia, serif` - page and section titles, the logo.
- `--font-mincho`: `"Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", "MS PMincho",
  serif` - Japanese display (headwords, sentences). `font-serif` has no CJK glyphs; never
  use it for Japanese text.

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
| `type-meta` | sans, `text-xs` (12px), `tertiary` | counts, dates, captions |
| `type-label` | sans 500, `text-sm`, `secondary`, sentence case | field labels (replaces every uppercase tracked label) |
| `jp-display` | mincho, `text-6xl` / `md:text-7xl`, `primary` | the headword of a detail page |
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
  Every routed page uses it except the quiz sessions and onboarding.
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
  headword; below `lg` they follow the readings. The actions hold only the status or,
  before the item is studied, the one primary "Learn this ..." button. The status is one
  line, the next review after the `StatusDot` label ("● Learning · Due now"), and never
  repeats the status word: a mastered item with nothing scheduled shows only
  "● Mastered" (`statusReviewPhrase`). The kanji header keeps Known / Not known. No mastery rings: those, with their values, are only in "Your
  progress".
- **`DetailBody`**: the body under every `DetailHeader`. From `lg` the same 12-column grid,
  `main` (8: the subject's content, meanings first) and `side` (4: the learner's data,
  related items, the details `Disclosure`); below `lg`, one column in reading order
  (`stacked` when it interleaves the two). The 12-column grid exists only in these two
  components (enforced, `detail-layout`).
- **Kanji page**: the header is the glyph, its readings labelled On and Kun, and neutral
  chips (JLPT, and the kanji's number in the learner's own method, "RTK #346"). Main:
  Meanings, then the words using it. Side: Components (with "8 strokes · Radical 子") and
  Dictionary details (school grade, newspaper rank, name readings, every book's number).
- **Readings**: on in katakana, kun in hiragana with the okurigana in parentheses, まな(ぶ),
  through `kunReadingLabel` in both apps (enforced, `kun-reading`). Parentheses, not a
  colour: every colour already means something (section 2). A reading beside its headword is
  `secondary`, its On/Kun label a field label.
- **Session cards**: every card of a study session (each exercise, both intro cards, the
  chapter review, the kanji unlock) is drawn in `QuizCardFrame`, which owns one width
  (`w-full max-w-2xl`, on the animated wrapper too) and one padding, so a card's size
  never depends on what it contains.
- **Settings**: Account, Appearance (theme), Review pacing, AI answer
  checking, Activity settings, Danger zone. Activity settings holds one collapsed
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
- Footer ("About Gokan SRS", "Dictionary") on every non-session page on desktop; in the
  mobile More sheet; `/about` before setup shows it at every width (`alwaysVisible`).

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
  onboarding). Selected: accent border, `bg-accent/10`, a check icon top-right, ink text.
- **`FilterToggle`** (`ui/FilterToggle.tsx`): the multi-select pill style (list filters,
  genre pills, grammar browse toggles). Selected: accent border, accent text,
  `bg-accent/10`.
- **`ListRow`** (`ui/ListRow.tsx`): a clickable row, always a `<Link>`, never a `div`
  with `onClick`. Hover `bg-surface-hover`, focus-visible accent ring, optional trailing
  slot.
- **`Disclosure`** (`ui/Disclosure.tsx`): a collapsible section (chevron button,
  `aria-expanded`), collapsed by default. Used for dataset/dictionary details, review
  history, rare senses, long explanations.
- **`StackedBarChart`** (`ui/StackedBarChart.tsx`): the one bar chart (the hub week
  chart, the review forecast, daily activity). Bars share a bottom baseline (see
  `utils/stackedBarChart.utils.ts` for why `flex-col-reverse` + `justify-end` does not
  do this); a y-axis shows the max value and a midline; every bar is a focusable button
  that shows its values on hover, focus and tap; x labels are never truncated.
- **`TabNav`**: route tabs (active: ink text, 2px accent underline). Used by the Grammar
  home.
- **`KanjiTile`** (`KanjiTile.tsx`): one glyph, a word's kanji or a kanji's components. A
  box (surface, divider border, accent on hover and focus) only when it links to the glyph's
  page; a glyph with no page (氵) is drawn plain at the same size, so nothing unclickable
  looks clickable (principle 7). Optional caption ("Known"). Every boxed glyph is one
  (enforced, `glyph-tile`); the known-kanji grid's toggles are the one other, and they are
  buttons. The dictionary's equivalent is the `glyph-tiles` mixin.
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
- **Shape**: 6px radius for cards, chips, tiles, inputs and buttons; the search field is
  the one pill. No shadow except the search panel. Spacing on the 8px scale. Page
  sections are a heading plus spacing, not boxes; a box is an object (a tile, a kanji).
  A glyph tile is a box only when it is a link (the `glyph-tiles` mixin: a kanji
  component with a page is boxed, 氵 is plain), as in the app.
- **Kanji page**: the glyph, its meanings (`entry-gloss`), its readings labelled On and Kun
  (the okurigana in parentheses, `kunReadingLabel`), the JLPT chip, then one meta line that
  names the level only when there is no chip. Sections: Components, Words, In kanji courses
  (each book's number, linking to the range page of that order holding it), then the name
  readings behind a `<details>`.
- **Shared between page sheets**: a rule two page types use goes in `app.scss`, unless that
  breaks its budget; then it is a mixin in `_tokens.scss` (`glyph-tiles`, `entry-gloss`,
  `stacked-entries`) included by each page sheet, so the source stays one copy.
- **Frame**: "Skip to content" is the first focusable element of every page. The header's
  inner container is the wide measure (960px) on every page, so it lines up with the entry
  pages. Wide screens: one row (logo, nav, search on the right). Phones (below 40rem): at
  most two rows, the logo shortened to 語感 beside the nav, then the search field; the home
  page's hero is its search field, so the header leaves its own out. Nav links, pager
  links, toggles, tiles and disclosure summaries are at least 44px tall.
- **Lists**: a word list is three aligned columns, headword | reading | gloss (stacked
  on a phone and in the word page's aside); the reading shows only when it differs from
  the headword, and a word learned in kana is never listed by its kanji spelling. A long
  list shows its head and puts the rest in a `<details>` ("All 401 words"): collapsed, but
  every link stays in the HTML.
- **Furigana toggle**: "Hide furigana" / "Show furigana", in the section header of every
  page with sentences. It sets `furigana-hidden` on `<html>` and remembers the choice in
  `localStorage` (read in a try/catch, shown by default). It lives in the search script
  every page already loads, and stays hidden without JavaScript.
- **Motion**: transitions are 150ms ease-in-out and none under `prefers-reduced-motion`.
- **Budgets**, checked after every build by `scripts/check-build.ts`, which fails the
  build when one is exceeded (`src/lib/budgets.ts`):

  | Item | Budget |
  | --- | --- |
  | Word page HTML, 90th percentile | 20 KB |
  | Kanji page HTML, the heaviest | 80 KB |
  | `/grammar/` HTML | 150 KB |
  | Each JLPT list page | 150 KB |
  | Each kanji order page (hub, order, range of 100 steps) | 150 KB |
  | Shared stylesheet (`app.scss`) | 10 KB |
  | Search script (every page) | 10 KB |
  | Query engine (loaded on first focus) | 10 KB |
  | `search-core.json`, gzipped | 300 KB |
  | Web fonts | one woff2, 40 KB |
  | Svelte client runtime | none |

  A budget is a decision about what a page costs a reader on a phone: raise one here,
  deliberately, never to make a build pass. The shared stylesheet is the tightest: a rule
  used by one page type belongs in that page's stylesheet anyway. Page weight is one half of
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
- `detail-layout`: `grid-cols-12` only in `DetailHeader` and `DetailBody`, and every
  `*DetailScreen` uses both.
- `one-ruby`: a `<ruby>` in the app only in `components/Ruby.tsx`.

**Layout, in a browser** (`scripts/check-layout.ts`, `bun run check:layout`, run by CI in
`.github/workflows/ci-layout.yml` on both production builds): at 320 and 375px, on the
app's onboarding and main routes and the dictionary's page types, no page scrolls
sideways, no text is below 12px (furigana in `rt` and SVG chart labels excepted), every
input is at least 16px (smaller makes iOS zoom), the dictionary's nav links, pager links,
toggles, tiles and disclosure summaries are at least 44px tall, and a word in a dictionary
sentence carries only its dotted border, never the running-text underline, and no word in an
app sentence (linked or studied) has a side margin (Japanese has no spaces between words), no
reading sits over kana (a marked fallback excepted), no ruby breaks across lines and no two
readings on a line touch (measured on their glyphs). A new page type or main route is added
to its lists.

**Lighthouse, SEO at 100** (`scripts/check-lighthouse.ts`, `bun run check:lighthouse`, run by
CI in `.github/workflows/ci-lighthouse.yml` on both production builds): one representative page
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
