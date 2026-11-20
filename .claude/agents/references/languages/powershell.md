
## Review Priorities

### CRITICAL — Security

- **Command built by string concatenation or `Invoke-Expression`**: use `& $exe @args` with an argument array,
  never a joined string. Validate input before it reaches the filesystem, registry or a shell.
- **`Start-Process -ArgumentList` with a path that contains a space**: array elements are joined with a plain
  space and an element containing a space is **not** auto-quoted, so the path is silently split. Pre-quote the
  element. A trailing backslash right before a closing quote (`"C:\dir\"`) escapes the quote: strip it.
- **Nested `powershell -Command "..."` from cmd.exe**: quotes do not survive. Use a companion `.ps1` with `-File`.
- **Secrets**: hardcoded tokens, `ConvertTo-SecureString -AsPlainText`, secrets echoed to the console or a log.
- **High-blast-radius OS change** (registry autorun, IFEO, service): must be opt-in, tagged as ours,
  reversible, and driven from a curated catalog, never from a user-supplied name.
- **Path traversal**: a path built from input without resolving it and checking it stays under the root.
- **Download then execute**, or `-ExecutionPolicy Bypass` without a stated reason.

### CRITICAL — Error Handling

- **No `$ErrorActionPreference = 'Stop'`** at the top of a script that changes anything.
- **`-ErrorAction SilentlyContinue` hiding a real failure.** A non-terminating error still sets a failing exit
  code in some hosts; to make a failure truly non-fatal, promote it with `-ErrorAction Stop` inside `try/catch`.
- **Native command exit code not checked**: test `$LASTEXITCODE` after every native command.
- **Empty `catch {}`**, or a catch that returns nothing and hides the cause.

### HIGH — Encoding and file writes

- **A non-ASCII character in a string literal needs a UTF-8 BOM** when the script runs under Windows
  PowerShell 5.1 (`-File`); without it the parser reports a missing terminator far from the real cause.
  Comments are immune. Keep the BOM when replacing a script wholesale.
- **A script that writes a tracked file** should write a temp file in the same folder, then rename it over the
  target, retrying briefly on `EPERM` / `EBUSY` (security tools and sync clients hold files open). Use
  `File.Replace` (`File.Move`'s overwrite overload does not exist on 5.1) and pass `[NullString]::Value`, not
  `$null`, as the backup path.
- **Anything written into a file a human also edits** needs a fenced block (`<!-- name-begin -->` and
  `<!-- name-end -->`). If the fence is missing, duplicated or unpaired, skip and report; never rewrite on a guess.

### HIGH — Code Quality

- **Naming**: `PascalCase` script names, no dashes and no spaces; the double-click launcher keeps its own
  spaced name. Functions use approved verbs.
- **Aliases in a script** (`ls`, `%`, `?`, `gci`): spell the cmdlet out.
- **Destructive operations** without `[CmdletBinding(SupportsShouldProcess)]` and a `-WhatIf` path.
- **No parameter validation** (`[ValidateNotNullOrEmpty()]`, `[ValidateSet()]`) on input that reaches a path or command.
- **PowerShell 7 only syntax** (`&&`, `||`, `ForEach-Object -Parallel`, ternary) in a script that a 5.1 launcher
  runs: check which host launches it.
- **`Write-Host` for data** the caller needs: output objects with `Write-Output`.
- **No `Set-StrictMode`** in a non-trivial script.

### MEDIUM — Performance

- **`+=` on an array or string in a loop**: use a `List[T]` or `StringBuilder`.
- **`Get-ChildItem -Recurse` over `node_modules`, `.git` or `bin`/`obj`**: exclude them.
- **Whole-file reads for line filtering**: `Get-Content` without `-ReadCount`, or a regex over a huge string.
- **Serial network or git round-trips** that could run together (`ForEach-Object -Parallel` on 7 only).

## Diagnostic Commands

```powershell
Invoke-ScriptAnalyzer -Path . -Recurse   # if PSScriptAnalyzer is installed
pwsh -NoProfile -File .\script.ps1 -WhatIf
```
