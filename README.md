# Prompt Master

A Claude Code mod that rewrites your rough prompt into a clearer, sharper one before you send it.

Type a draft, click **✨ Prompt Master** in the row above the message box, and the rewrite replaces your draft so you can check it before sending. **Undo** puts your original back. You can also type `/pm <rough prompt>`.

The rewrite runs on Haiku, keeps every concrete detail you wrote (file names, paths, errors), and puts the goal first.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install prompt-master --marketplace MichaelTRutherford/prompt-master
```

Answer `y` to add the marketplace, then pick a scope (user scope gives every session the mod).

In the Claude desktop app: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `MichaelTRutherford/prompt-master`, then **Add plugin**.

Needs Claude Code 2.1.325 or newer (`claude update`).
