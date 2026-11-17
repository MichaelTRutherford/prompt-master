import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Rewrite } from '../types'

const isBusy = atom({ plugin: 'prompt-master', key: 'isBusy' } as const, false)
const last = atom({ plugin: 'prompt-master', key: 'last' } as const, null as Rewrite | null, {
  shape: 'rewrite-1',
})

// Positive rules plus one worked example: a bare "don't do X" list gets ignored,
// a demonstrated pair is followed.
const SYSTEM = `You rewrite a developer's rough prompt for Claude Code, an AI coding agent working in their repository.

Rules:
- Keep the author's intent, scope and every concrete detail: file names, paths, commands, error text, names, numbers.
- State the goal first, then the specifics, then what "done" looks like when the draft implies it.
- Fix spelling and grammar; turn vague words into the precise thing the author clearly meant.
- Add constraints only when the draft implies them. Where something is genuinely ambiguous, leave it for the agent to ask.
- Write in the author's voice, as a direct request ("Add…", "Fix…", "Find out why…").
- Match length to the task: one or two sentences for a small ask, a short bulleted list for a multi-part one.
- Reply with the rewritten prompt only, as plain text.`

const EXAMPLE_IN = `the export thing is broke when theres no tags, fix it and dont break the other stuff`
const EXAMPLE_OUT = `Fix the export so it works for bookmarks that have no tags — right now it fails on them. Find the root cause rather than special-casing around it, and make sure exports of tagged bookmarks still behave exactly as before.`

/** Removes wrapping a model sometimes adds despite the rules: fences, quotes, a label. */
const clean = (text: string) =>
  text
    .trim()
    .replace(/^```[a-z]*\n([\s\S]*?)\n```$/i, '$1')
    .replace(/^(rewritten prompt|prompt)\s*:\s*/i, '')
    .replace(/^"([\s\S]*)"$/, '$1')
    .trim()

async function rewrite($: EngineInterface, draft: string): Promise<string | null> {
  const reply = await $.model.complete({
    model: 'haiku',
    system: SYSTEM,
    prompt: `Rewrite this prompt.\n\n<example>\n<draft>${EXAMPLE_IN}</draft>\n<rewritten>${EXAMPLE_OUT}</rewritten>\n</example>\n\n<draft>${draft}</draft>\n\nReply with the rewritten prompt only.`,
    maxTokens: 2048,
    effort: 'low',
  })

  if (!reply.isAnswered) {
    $.ui.toast(`Prompt Master couldn't rewrite: ${reply.reason}`)
    return null
  }

  const text = clean(reply.text.replace(/<\/?rewritten>/g, ''))
  return text.length > 0 ? text : null
}

async function improve($: EngineInterface, draft: string) {
  if (draft.trim().length === 0) {
    $.ui.toast('Type a prompt first')
    return
  }
  if (await read($, isBusy)) {
    return
  }

  await update($, isBusy, () => true)
  try {
    const better = await rewrite($, draft)
    if (better === null) {
      return
    }
    // Set before filling: the fill raises prompt.change, which must see it.
    await update($, last, () => ({ original: draft, rewritten: better }))
    const filled = await $.prompt.fill({ text: better, mode: 'replace' })
    if (!filled.isFilled) {
      await update($, last, () => null)
      $.ui.toast("Prompt Master couldn't write to the prompt box")
    }
  } finally {
    await update($, isBusy, () => false)
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'pm',
      description: 'Rewrite a rough prompt into a better one (Prompt Master)',
    })
    return next(e)
  })

  // `/pm <rough prompt>` rewrites the text after the command into the box.
  on('command.run', { command: 'pm' }, async ($, e) => {
    void improve($, e.args)
    return { text: '' }
  })

  // The desktop composer raises no prompt.change, so the button never waits on
  // typing; these hooks only retire a stale Undo where the events do arrive.
  on('prompt.change', async ($, e, next) => {
    const rewrite = await read($, last)
    if (rewrite !== null && e.text !== rewrite.rewritten) {
      await update($, last, () => null)
    }
    return next(e)
  })

  // Fire-and-forget: a failure here must never stop the person's prompt sending.
  on('prompt.submit', ($, e, next) => {
    void update($, last, () => null).catch(() => undefined)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || e.props.isWorking) {
      return next(e)
    }

    const busy = await read($, isBusy)
    const rewrite: Rewrite | null = await read($, last)

    const { Box, Button } = $.ui.resolve(e)

    return (
      <Box gap={1}>
        <Button
          key="improve"
          label={busy ? '✨ Rewriting…' : '✨ Prompt Master'}
          variant="primary"
          onPress={async () => improve($, (await $.prompt.read()).text)}
        />
        {rewrite !== null && !busy && (
          <Button
            key="undo"
            label="Undo"
            dimColor
            onPress={async () => {
              await update($, last, () => null)
              // Only undo over the untouched rewrite: never clobber edits made since.
              if ((await $.prompt.read()).text === rewrite.rewritten) {
                await $.prompt.fill({ text: rewrite.original, mode: 'replace' })
              }
            }}
          />
        )}
      </Box>
    )
  })
}
