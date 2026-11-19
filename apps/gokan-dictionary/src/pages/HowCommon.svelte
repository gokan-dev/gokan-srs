<script lang="ts">
  import { FREQUENCY_BARS } from '@gokan/dataset-schema';

  /**
   * A detail header's How common fact (a word's, a kanji's), as the app's `FrequencyMeter`: four
   * neutral signal bars, the band's name, then its round reference ("Top 300 words"). The name says
   * it in words, so the bars are hidden from screen readers. Inside the header's `.entry-facts`.
   */
  interface Props {
    label: string;
    /** Bars lit, of FREQUENCY_BARS (frequencyBand). */
    bars: number;
    band: string;
    reference: string;
  }

  let { label, bars, band, reference }: Props = $props();
</script>

<div>
  <dt>{label}</dt>
  <dd>
    <span class="frequency-meter" aria-hidden="true">{#each Array.from({ length: FREQUENCY_BARS }, (_, bar) => bar) as bar (bar)}<span class:on={bar < bars}></span>{/each}</span>
    {band} · <span class="meta">{reference}</span>
  </dd>
</div>
