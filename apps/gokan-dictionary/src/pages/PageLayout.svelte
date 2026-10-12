<script module lang="ts">
  /** One breadcrumb step after "Dictionary". The last step is the current page and has no link. */
  export interface Crumb {
    label: string;
    href?: string;
    /** Japanese text, marked lang="ja". */
    jp?: boolean;
  }
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { Section } from '../lib/types';
  import { homePath } from '../lib/urls';
  import SiteHeader from './SiteHeader.svelte';
  import SiteFooter from './SiteFooter.svelte';

  /**
   * The frame every page shares: skip link, site header, the content container with its
   * breadcrumb, and the footer. Pages supply only their trail and content, so the breadcrumb
   * format and page chrome cannot drift between page types.
   */
  interface Props {
    /** Breadcrumb after "Dictionary". Omitted on the home page, which has none. */
    trail?: Crumb[];
    section?: Section;
    /** The wide measure (entry pages, tables); text pages keep the reading measure. */
    wide?: boolean;
    /** False on the home page, whose hero is the search field: one search field on screen. */
    headerSearch?: boolean;
    children: Snippet;
  }

  let { trail, section, wide = false, headerSearch = true, children }: Props = $props();
</script>

<a class="skip-link" href="#content">Skip to content</a>

<SiteHeader {section} search={headerSearch} />

<main id="content" tabindex="-1">
  <div class="container" class:container--wide={wide}>
    {#if trail}
      <!-- One line on purpose: no template whitespace between items; .breadcrumb-sep's margin spaces them. -->
      <nav class="breadcrumb" aria-label="Breadcrumb"><a href={homePath()}>Dictionary</a>{#each trail as crumb (crumb.label)}<span class="breadcrumb-sep" aria-hidden="true">/</span>{#if crumb.href}<a href={crumb.href} lang={crumb.jp ? 'ja' : undefined}>{crumb.label}</a>{:else}<span aria-current="page" lang={crumb.jp ? 'ja' : undefined}>{crumb.label}</span>{/if}{/each}</nav>
    {/if}

    {@render children()}
  </div>
</main>

<SiteFooter />
