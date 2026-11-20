# Prompt Templates Reference

Supporting templates for `/prompt`. The primary shapes (the Claude Code Task Brief and the Claude chat/API
XML prompt) live in `write.md`; breaking down, adapting and splitting a pasted prompt are the `fix`, `adapt`
and `plan` modes. This file holds the less-frequent shapes. Read only the one the task needs.

## Table of Contents

| Template | Best for |
|---|---|
| [A — RTF](#template-a--rtf) | Simple one-shot chat requests |
| [E — Chain of Thought](#template-e--chain-of-thought) | Logic, math, debugging, multi-factor analysis |
| [F — Few-Shot](#template-f--few-shot) | Format-sensitive or pattern-replication output |
| [G — File-Scope](#template-g--file-scope) | A narrow single-file edit in Claude Code |

---

## Template A — RTF

*Role, Task, Format. Use for fast one-shot chat requests where the ask is clear and simple —
don't reach for XML sectioning here.*

```
Role: [One sentence defining who Claude is for this task]
Task: [Precise verb + what to produce]
Format: [Exact output format and length]
```

**Example:**
```
Role: You are a senior technical writer.
Task: Write a one-paragraph description of what a REST API is.
Format: Plain prose, 3 sentences maximum, no jargon, suitable for a non-technical audience.
```

---

## Template E — Chain of Thought

*Logic-heavy tasks, math, debugging, multi-factor analysis where Claude should reason before
committing to an answer. Claude's thinking is adaptive by default — this template is for when
you want the reasoning shown in the output, not to induce reasoning that wasn't going to happen.*

```
[Task statement]

Before answering, think through this carefully:
<thinking>
1. What is the actual problem being asked?
2. What constraints must the solution respect?
3. What are the possible approaches?
4. Which approach is best and why?
</thinking>

Give your final answer in <answer> tags only.
```

**Use for:** debugging where the cause isn't obvious, comparing two technical approaches, any
calculation, analysis where a wrong first impression is likely.

**Don't use for:** simple tasks where the answer is already clear (pure overhead), or creative
tasks (the scaffolding kills natural voice).

---

## Template F — Few-Shot

*Use when the output format is easier to show than describe. Examples outperform written
instructions for format-sensitive tasks.*

```
[Task instruction]

Here are examples of the exact format needed:

<examples>
  <example>
    <input>[example input 1]</input>
    <output>[example output 1]</output>
  </example>
  <example>
    <input>[example input 2]</input>
    <output>[example output 2]</output>
  </example>
</examples>

Now apply this exact pattern to: [actual input]
```

**Rules:**
- 2 to 5 examples is the sweet spot — more rarely helps and wastes tokens.
- Examples must include edge cases, not just easy cases.
- XML tags around examples parse reliably.
- If the same formatting correction has been re-prompted twice, switch to few-shot instead of
  rewriting the instruction a third time.

---

## Template G — File-Scope

*Use for a narrow single-file edit — the Claude Code equivalent of what other IDE tools call a
scoped edit. The most common failure mode is touching the wrong file or breaking adjacent logic;
this template prevents both by naming the boundary explicitly.*

```
File: [exact/path/to/file.ext]
Function/Component: [exact name]

Current Behavior:
[What this code does right now — be specific]

Desired Change:
[What it should do after the edit — be specific]

Scope:
Only modify [function / component / section].
Do NOT touch: [everything to leave unchanged]

Constraints:
- Language/framework: [specify version]
- Do not add a dependency not already in [package.json / requirements.txt / .csproj]
- Preserve existing [type signatures / API contracts / variable names]

Done When:
[Exact condition that confirms the change worked]
```

For anything touching more than one file or needing stop conditions, use the Task Brief in
`write.md` instead — File-Scope is for the single-file case only.
