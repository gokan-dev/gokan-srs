<script lang="ts">
  import { WORD_TYPE_LABEL, type ConjugationTable } from '../lib/grammarConjugations';
  import { grammarIndexPath, grammarPath } from '../lib/urls';
  import PageLayout from './PageLayout.svelte';
  import GrammarTabs from './GrammarTabs.svelte';

  interface Props {
    tables: ConjugationTable[];
    formCount: number;
  }

  let { tables, formCount }: Props = $props();
</script>

<PageLayout trail={[{ label: 'Grammar', href: grammarIndexPath() }, { label: 'Conjugations' }]} section="grammar" wide>
  <div class="page-intro">
    <h1>Conjugation reference</h1>
    <p>
      {formCount} forms of verbs and adjectives, from the <span lang="ja">て</span>-form to the causative-passive. Each
      pattern links to its point, with a full table of examples.
    </p>
  </div>

  <GrammarTabs current="conjugations" />

  {#each tables as table (table.wordType)}
    <section class="section">
      <h2>{WORD_TYPE_LABEL[table.wordType]}</h2>
      <div class="table-scroll">
        <table class="conjugation-reference">
          <thead>
            <tr><th scope="col">Form</th><th scope="col">Pattern</th><th scope="col">Example</th><th scope="col">Level</th></tr>
          </thead>
          <tbody>
            {#each table.rows as row (row.id)}
              <tr>
                <th scope="row">{row.formLabel}</th>
                <td><a href={grammarPath(row.id)} lang="ja">{row.pattern}</a></td>
                <td lang="ja">{#if row.example}{row.example.lemma} → {row.example.target}{/if}</td>
                <td>N{row.jlptLevel}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>
  {/each}
</PageLayout>
