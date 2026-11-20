# docs — do the docs still tell the truth?

Lens: `docs` (1 agent per shard, `review-reader`).

## Before the agent

`run prep` runs `names` and `doclinks` and addresses both to the `docs` lens. What they are:

1. `names <scope>`: files renamed, moved or deleted in the scope, each with the places that still cite the old
   name (it searches the whole repo). Add by hand any renamed function, environment variable, command or
   script you see in the diff, since the helper cannot see those, and give the reviewer the list to grep.
2. `doclinks`: relative links and anchors in the markdown that point nowhere, and `npm run` targets that are
   not scripts.
3. List the docs that claim something about the changed area (README, `CLAUDE.md`, `.claude/*.md`, comments)
   and pass them.
4. On `--all`, shard by document set (root docs, one project's `.claude/`, each README) rather than by module,
   because the evidence is the code each doc describes.

## Report emphasis

Each finding pairs the doc line with the code line that contradicts it. Critical is a doc that would make an
agent or person do the wrong thing. A claim that could not be checked is not a finding. Note where one fact
lives in two places and which file should own it.

## Next

`/code quality` if a doc and the code disagree and the code is the thing that is wrong.
