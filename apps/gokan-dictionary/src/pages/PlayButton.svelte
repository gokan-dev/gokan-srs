<script lang="ts">
  import { audioUrl, type AudioRef } from '@gokan/dataset-schema';
  import type { PageVoice } from '../lib/pageProps';
  import { pageLocale } from './pageLocale';

  /**
   * Plays a word's reading or a sentence read aloud (client/player.ts): a real button, never a
   * link, so a crawler sees no new URL. Its URL is built here, at render, so the script fetches
   * nothing before a press. An item without a clip has no button, never a disabled one. Its name
   * is in the page's language (`lang`), its icon drawn by the stylesheet (`.play`).
   */
  interface Props {
    audio: AudioRef | undefined;
    voice: PageVoice;
    /** Its accessible name: "Play 食べる", "Play sentence". */
    label: string;
  }

  let { audio, voice, label }: Props = $props();
  const { lang } = pageLocale();
</script>

{#if audio && voice}<button type="button" class="play" data-clip={audioUrl(audio.clip, voice.extension)} aria-label={label} aria-pressed="false" {lang}></button>{/if}
