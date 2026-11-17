/** The draft before a rewrite and what replaced it, so Undo can put it back. */
export type Rewrite = { original: string; rewritten: string }

declare module 'claude-code' {
  interface PluginState {
    'prompt-master': {
      isBusy: boolean
      last: Shaped<Rewrite | null>
    }
  }
}
