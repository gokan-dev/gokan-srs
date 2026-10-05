<script module lang="ts">
  /** One breadcrumb step after "Dictionary". The last step is the current page and has no link. */
  export interface Crumb {
    label: string;
    href?: string;
    /** Japanese text, set in the Japanese font. */
    jp?: boolean;
  }
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { homePath } from '../lib/urls';
  import SiteHeader from './SiteHeader.svelte';
  import SiteFooter from './SiteFooter.svelte';

  /**
   * The frame every page shares: site header, the content container with its breadcrumb,
   * and the footer. Pages supply only their trail and content, so the breadcrumb format
   * and page chrome cannot drift between page types.
   */
  interface Props {
    /** Breadcrumb after "Dictionary". Omitted on the home page, which has none. */
    trail?: Crumb[];
    /** The two-column container used by entry pages. */
    wide?: boolean;
    children: Snippet;
  }

  let { trail, wide = false, children }: Props = $props();
</script>

<SiteHeader />

<main>
  <div class="container" class:container--wide={wide}>
    {#if trail}
      <!-- One line on purpose: no template whitespace between items; .breadcrumb-sep's margin spaces them. -->
      <p class="breadcrumb"><a href={homePath()}>Dictionary</a>{#each trail as crumb (crumb.label)}<span class="breadcrumb-sep">/</span>{#if crumb.href}<a href={crumb.href} class:jp={crumb.jp}>{crumb.label}</a>{:else}<span class:jp={crumb.jp}>{crumb.label}</span>{/if}{/each}</p>
    {/if}

    {@render children()}
  </div>
</main>

<SiteFooter />
