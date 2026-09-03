# DOMAIN

The business rules, the data model, and the lifecycle of the core entity. Read this before
changing validation, schema, or anything that decides what a value *means*. For structure
see [ARCHITECTURE.md](ARCHITECTURE.md); for terminology see [GLOSSARY.md](GLOSSARY.md).

Delete this file if the project has no domain worth stating — a static site doesn't need
one. Keep it the moment a rule exists that isn't obvious from reading the code.

## Core entity

<!-- The one object everything revolves around, its identity format, and where it lives. -->

## Data model

| Field | Type | Notes |
| --- | --- | --- |
| … | … | … |

<!-- Note anything non-obvious about the storage shape: why a column is an array, why a
     blob is JSON rather than normalized, which fields are nullable on purpose. -->

## Lifecycle

<!-- The states the entity moves through, what triggers each transition, and the terminal
     states. Include the failure and timeout paths — those are the ones agents get wrong. -->

## Business rules (as implemented)

<!-- Every rule that a number depends on, written as a formula with its source of truth.
     "Weighted value = value × probability, fallback phase weight; framework agreements
     are €1. See server/enrich/flags.ts::computeWeighted."

     Two rules that generalize from the projects this template is drawn from:
     - Never fabricate a value. If it's derived or guessed, mark it (`source: 'inferred'`)
       and let the user override it.
     - Show "n/a" when an input is missing — never a plausible-looking zero. -->

## Validation

<!-- What is rejected, where, and with what message. Boundary validation only — don't
     re-validate the same value at three layers. -->

## Source data & normalization

<!-- Only if the project ingests external files or feeds. Which sheet/endpoint is
     authoritative, how identity is derived so it survives re-import, unit conventions
     (are amounts in thousands?), and the artefacts of the source format. This section
     earns its keep the first time a source file changes shape. -->

## Extending the domain

<!-- The exact checklist for the most common structural change — add a field, add a
     source, add a category. If it spans more than four files, make it a skill instead
     and link it here. -->
