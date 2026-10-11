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
   modal, an item in a grid of objects). Page sections are a heading plus spacing.
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
| Answer correct | `feedback-correct` | answer results only: quiz feedback, session ticker, review history, answer charts | anything else |
| Answer wrong, error, warning, destructive | `error` / `feedback-incorrect` | wrong answers, errors, warnings, destructive actions | decoration |
| Metadata | neutral (`divider` border + `secondary` text) | JLPT level, part of speech, register, status chips | |

Rules that follow from the table:

- Text in `text-accent` is always a link or an action. A plain-text or chip usage of
  accent is a bug: fix the colour, not the rule.
- Correct and incorrect answers use the feedback pair everywhere answers are counted
  (hub week chart, daily activity, review history), always with a second cue (position,
  label, tooltip), never colour alone.
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
| `--error` / `--feedback-incorrect` | `#8A3A2E` | `#E0796D` |
| `--feedback-correct` | `#2F6B4F` | `#6FBF95` |

`--secondary` and `--tertiary` are deliberately NOT the old accent blue: that collision
(`--secondary` used to equal `--accent`) is why plain text used to read as a link
everywhere. `--mastery-reading/meaning/production` derive from `--accent` via
`color-mix`, so the mastery ladder always follows the accent hue.

Removed: `--muted`, `--subtle`, `--label-neutral`, `--meaning-muted`, and the six
`--quiz-*` tokens. A removed token used in a class (`text-muted`, `bg-quiz-cloze`...)
fails `bun run check` (`check-conventions.ts`, rule `design-tokens`) rather than quietly
resolving to nothing. Map an old usage to `primary` (glosses, body copy that was
`meaning-muted`) or `tertiary` (everything else that was `muted`/`subtle`/`label-neutral`).

## 3. Typography

**Fonts** (loaded in `main.tsx`): Inter (400/500/600) and Noto Sans JP (400/500) from
Google Fonts, plus Source Serif 4 and Noto Serif JP. Sawarabi Gothic is gone (it has no
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
`text-[0.6em]`, `text-[0.45em]`). Enforced (`font-size-floor`). No uppercase
letter-spaced labels: `tracking-wide`/`wider`/`widest` are gone everywhere, including the
logo (enforced, `no-tracking-wide`); use `type-label` instead. Weights in use: 400, 500,
600 only.

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
  `active:scale-*` anywhere (enforced, `no-scale-transform`).

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
  `text-3xl md:text-4xl` for a grammar point), readings/romaji, neutral chips, an actions
  area on the right.
- **Desktop/tablet nav** (`md`+): logo, text links Study / Vocabulary / Grammar /
  Listening / Stats / Kanji, then search and Settings. Active link: ink text, 2px accent
  underline; inactive: secondary text, ink on hover.
- **Mobile nav** (below `md`): a top bar (logo, "Gokan", search icon) and a fixed bottom
  tab bar (Study, Vocabulary, Grammar, Stats, More).
- **Session focus mode** (`/quiz`, `/grammar`): no nav links, no bottom tab bar, no
  search field - just the logo (links to the hub), a search icon, and an "End session"
  ghost button.
- Footer ("About Gokan SRS", "Dictionary") on every non-session page on desktop; in the
  mobile More sheet.

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

## 8. Enforcement (`scripts/check-conventions.ts`)

- `design-tokens`: no default Tailwind palette colour, no numeric shade on a theme
  token, no raw colour value, no removed token (`muted`/`subtle`/`label-neutral`/
  `meaning-muted`/`quiz-*`) outside `index.css` / `app.scss`.
- `font-size-floor`: no `text-[Npx]` with N < 12 or `text-[Nrem]` with N < 0.75 in
  `apps/gokan-srs/src`; `em` stays allowed (furigana).
- `no-scale-transform`: no `hover:scale-*` or `active:scale-*`.
- `no-tracking-wide`: no `tracking-wide`, `tracking-wider` or `tracking-widest`.
- `date-formatting`: `toLocaleDateString`/`toLocaleTimeString`/`dateStyle`/`timeStyle`
  only in `utils/time.utils.ts`.

A red check here is never fixed by relaxing the rule; fix the code, or change this
document and the check together, deliberately, and say so in the PR.
