import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'prompt-master',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isCollapsed: false,
    isWorking: false,
    maxRows: 6,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 6 },
    view: {},
  },
} as const

// The harness raises prompt.change like the editor does; the public `$` type has no such call.
const typed = ($: unknown) => $ as { prompt: { change: (e: object) => Promise<unknown> } }

test('click rewrites the draft, Undo puts it back', async ($, on) => {
  let box = 'fix the bug thing'
  const fills: string[] = []

  on('prompt.read', () => ({ value: { text: box, cursor: box.length } }))
  on('model.complete', () => ({
    value: {
      isAnswered: true,
      text: '```\nFix the bug in the export.\n```',
      usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    },
  }))
  on('prompt.fill', async (_, e) => {
    box = e.text
    fills.push(e.text)
    await typed($).prompt.change({ text: box, cursor: box.length, origin: { kind: 'plugin', name: 'prompt-master' } })
    return { isFilled: true, text: box }
  })
  on('prompt.change', (_, e) => ({ text: e.text }))

  for (const surface of ['terminal', 'desktop'] as const) {
    box = 'fix the bug thing'
    fills.length = 0
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ key: 'improve' })).toBeDefined()

    await ui.press({ key: 'improve' })
    expect(fills).toEqual(['Fix the bug in the export.'])

    await ui.press({ key: 'undo' })
    expect(box).toBe('fix the bug thing')
    expect(await ui.find({ key: 'undo' })).toBeUndefined()
    await ui.unmount()
  }
})

test('the button shows with no typing events, and an empty box is left alone', async ($, on) => {
  const fills: string[] = []
  on('prompt.read', () => ({ value: { text: '  ', cursor: 0 } }))
  on('ui.toast', () => ({ value: undefined }))
  on('prompt.fill', (_, e) => {
    fills.push(e.text)
    return { isFilled: true, text: e.text }
  })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await ui.find({ key: 'improve' })).toBeDefined()
  await ui.press({ key: 'improve' })
  expect(fills).toEqual([])
  await ui.unmount()
})

test('hidden while Claude works', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  const ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, isWorking: true }, surface: 'desktop' })
  expect(await ui.find({ key: 'improve' })).toBeUndefined()
  await ui.unmount()
})
