<script lang="ts">
  import { audioUrl, type AudioRef } from '@gokan/dataset-schema';
  import type { PageVoice } from '../lib/pageProps';
  import { pageLocale } from './pageLocale';

  /**
   * Plays a word's reading or a sentence read aloud (client/player.ts): a real button, never a
   * link, so a crawler sees no new URL. Its URL is built here, at render, so the script fetches
   * nothing before a press. An item without a clip has no button, never a disabled one. Its icon
   * is drawn by the stylesheet (`.play`).
   *
   * Every byte here repeats once per sentence, on pages held to a size budget (lib/budgets.ts), so
   * it writes nothing the page already implies: no `type` (no form holds it), no `aria-pressed`
   * (the player sets it as it starts, and without the player the button is hidden), and `lang`
   * only inside Japanese text, where its name would otherwise inherit `ja`.
   */
  interface Props {
    audio: AudioRef | undefined;
    voice: PageVoice;
    /** Its accessible name, in the page's language: "Play 食べる", "Play sentence". */
    label: string;
    /** It sits inside a `lang="ja"` element, so it names the page's language itself. */
    inJapanese?: boolean;
  }

  let { audio, voice, label, inJapanese = false }: Props = $props();
  const { lang } = pageLocale();
</script>

{#if audio && voice}<button class="play" data-clip={audioUrl(audio.clip, voice.extension)} aria-label={label} lang={inJapanese ? lang : undefined}></button>{/if}
