# Domain: Desktop apps, services and local IPC

Adapted from `cloudflare/security-audit-skill` (MIT, Copyright (c) 2025-2026 Cloudflare, Inc.): its desktop/mobile/IPC
file plus the loader search-order class from its memory-safety file, rewritten for Windows and .NET. Lines marked
(base) are additions not in that source. Loaded only when the brief's `## security` section names `desktop-ipc`.

**Load when:** the project is a desktop app, a Windows service or background guard, an elevated launcher or
helper, an updater or installer, a WebView host, a custom URI scheme or file association, or anything that talks
over a named pipe, a local socket or a loopback listener to another process. A plain loopback web tool is already
covered by the base's hard checks (loopback bind, `Host`/`Origin` rejection); load this file for it only if a
separate privileged process sits behind the listener.

## Discipline

- Say who the attacker is: another OS user, another process under the same user, a sandboxed child, a downloaded
  document, or a web page that can reach loopback. Self-harm inside one account with one authority is not a boundary.
- A path, process name, image name or a "sender" field is not peer authentication. Count OS peer identity, code
  identity, handles and ACLs.
- The service or helper must authorise each operation and the final resource *after* parsing. A trusted UI in front
  of it does not make its arguments trusted.
- ACLs, signing, UAC, entitlement-like manifests and the SmartScreen/ASR prompts are real controls when visible
  and pinned. The final installed ACL or the merged manifest may not be in the repo: that is `needs-validation`.
- This base's hard check applies first: a registry/IFEO/service change that is not opt-in, tagged as ours,
  reversible and driven by a curated catalog is Critical (root `CLAUDE.md` § Security defaults).

## Classes

**IPC peer authentication gap**: a named pipe, local socket, COM/RPC endpoint or loopback listener serves a method
without checking who connected. .NET shape: `new NamedPipeServerStream(...)` with no `PipeSecurity` /
`NamedPipeServerStreamAcl.Create`, or an ACL granting `Everyone`/`Users` write; `PipeOptions.CurrentUserOnly`
missing where the service is per-user. Proof: a lower-trust process can connect *and* a meaningful method sits
behind it.

**Claimed principal vs channel identity**: the connection belongs to one user or app but a request field selects
another user, profile, path or capability. Bind each method and resource to the peer's identity
(`RunAsClient`, `GetNamedPipeClientProcessId`), not to a caller-declared id.

**Privileged helper as confused deputy**: a service or elevated helper (SYSTEM, admin) lets a low-privilege caller
pick a file, registry key, service, command line or setting. Proof: the helper re-validates the normalised target
against a curated allowlist; a path "starts with" check is not that (see Substring/Unanchored Allowlist in the
core classes). (base) ThinkTwice's guard and Computer Cleaner's actions are the shape to read for.

**Install, update and repair path trust**: an elevated process reads or executes from a folder a lower-trust user
can write: `%ProgramData%\<app>` inheriting `Users:Modify`, an unquoted service `ImagePath` with spaces, a manifest
or script fetched after authorisation, a repair step that follows a user-writable symlink or junction. Bind
authorisation to immutable content and a safe destination.

**Library and executable search order** (from its memory-safety file): a privileged process loads a DLL, plugin or
helper from a path a lower-trust principal can write, or resolves a bare name through the working directory or
`PATH`. .NET shapes: `Process.Start("powershell")` / `"cmd"` by bare name from an elevated service,
`Assembly.LoadFrom(relative)`, `LoadLibrary("x.dll")` / `DllImport` without a safe search flag, a writable folder
ahead of `System32` in an elevated `PATH`. Do NOT flag a user loading their own plugin into their own process.

**File TOCTOU and ownership**: check a path, then follow a replacement, symlink, junction or case/short-name change
during a privileged read or write. Use handles opened once and verify the final path/owner. Parse only after the
file is open.

**Credential-store and local-secret mismatch**: DPAPI scope `LocalMachine` for a per-user secret, a token or config
under `%ProgramData%` readable by other users, secrets in a backup, log or clipboard. Do NOT flag plaintext readable
only by the same intended account; name the less-privileged reader and the credential's power.

**Unsafe deserialization at a message boundary** (base): `BinaryFormatter`, `NetDataContractSerializer`,
`SoapFormatter`, `LosFormatter`, Newtonsoft `TypeNameHandling` other than `None`, `JavaScriptSerializer` with a type
resolver, MessagePack typeless mode, applied to bytes from a pipe, socket, file or document. Schema validation
proves shape, not provenance.

**Protocol handler, deep link and file-open authority**: a URI scheme registered under `HKCU\Software\Classes`, a
file association or a share/open verb that triggers a privileged or state-changing action without current-user
intent, content-type check and a bound, one-time target. Review URI normalisation, duplicate query fields and replay.

**WebView and native bridge**: remote or attacker-influenced content can reach `AddHostObjectToScript`,
`WebMessageReceived` or a custom scheme intended for packaged content. Validate origin at call time and after every
navigation, redirect, subframe and error page; an initial-load check is not enough. A generic bridge that takes a
file path or command is over-broad.

**Claimed elevation vs actual action** (base): a UAC/consent prompt or confirmation dialog describes one action
and the elevated code runs another, or an elevated launcher passes user-controlled arguments through an unquoted
`-ArgumentList` (the trap documented in root `CLAUDE.md` § Windows dev-machine hygiene).

## Moves

- Enumerate every process, service, pipe, listener, URI scheme, file association, WebView origin and helper. Record
  its OS identity, runtime privilege, who can call it and what it can do.
- Read the final packaging inputs: `app.manifest` (`requestedExecutionLevel`), installer rules, service
  registration, ACL creation. A declaration in source can be overwritten downstream.
- Test only with dummy profiles and non-sensitive fixtures; never launch an elevated build to check it (root
  `CLAUDE.md` § Testing philosophy). Stop at the minimum observable boundary result.

## Gate

1. Name the attacker's starting capability, the OS or app principal crossed, the entry channel, the accepted
   argument and the unauthorised operation or disclosure.
2. Cite the peer-authentication or ACL control that applies. Installed ACLs, signing and merged manifests that the
   repo cannot show are `needs-validation` with the exact observation (e.g. "icacls of `%ProgramData%\<app>`").
3. Webview: cite both the origin control and the privileged sink. IPC: cite peer auth *and* per-resource
   authorisation. Helper: cite the final normalised destination.
4. Critical for a traced low-to-high privilege path (service or elevated code acting for a lower-trust caller);
   Important for a narrower reach or an uncommon precondition; same-account same-authority is not a finding.
