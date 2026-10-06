// The svelte and vite/client types come from tsconfig.json's `types`.
declare module '*.svelte' {
  import type { Component } from 'svelte'
  const component: Component<Record<string, unknown>>
  export default component
}
