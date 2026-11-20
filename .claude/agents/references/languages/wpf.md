
## Review Priorities

### CRITICAL — Security

- **Process started from a concatenated string**: use `ProcessStartInfo.ArgumentList` (an argument array),
  never a joined `Arguments` string built from input.
- **Elevation**: a manifest that requests `requireAdministrator` needs a stated reason, and the app must have
  a fully unelevated test suite. Never launch an elevated app from a test or an agent.
- **Registry and service changes**: opt-in, tagged as ours, never clobber a foreign value, fully reversible,
  driven from a curated catalog and never from a user-supplied name.
- **File paths built from input** without resolving them and checking they stay under the intended root.
- **`BinaryFormatter`**, or deserialization of untrusted data with type names enabled.
- **WebView2 navigation** to unvalidated URLs; secrets or tokens stored in plain settings or logged.

### CRITICAL — Threading

- **Blocking the UI thread**: `.Result`, `.Wait()` or `.GetAwaiter().GetResult()` on a UI-thread path
  deadlocks. Use `await`.
- **`async void`** anywhere except an event handler.
- **UI objects touched off the UI thread** (`Dispatcher` missing), including an `ObservableCollection` changed
  from a background thread.
- **Fire-and-forget `Task`** whose exception is never observed.
- **Long work in a constructor or in `OnStartup`** before the first window shows.

### HIGH — Binding and MVVM

- **`INotifyPropertyChanged` not raised** for a property, or not raised for dependent properties.
- **Binding errors** (wrong path, missing `DataContext`): they fail silently. Check the trace output.
- **`ICommand.CanExecute` that never refreshes**; commands that do heavy work synchronously.
- **Business logic in code-behind**, or `DataContext` assigned in several places.

### HIGH — Leaks and lifetime

- **Event handlers never unsubscribed**, especially on static events or long-lived publishers.
- **A `DispatcherTimer` that is never stopped**; a window that is closed but still referenced.
- **Bindings to a non-`INotifyPropertyChanged` property** (a known leak path).
- **Large images** loaded without `DecodePixelWidth` / `CacheOption=OnLoad`.

### HIGH — Theming and accessibility

- **A colour, size or radius written in a view** instead of coming from the `ResourceDictionary`. A hex value
  appears once, in the token file. Use `DynamicResource` where the theme can switch.
- **High contrast**: hard-coded colours where a `SystemColors` key belongs.
- **Icon-only controls without `AutomationProperties.Name`**; no visible `FocusVisualStyle`; a tab order that
  does not follow the visual order; clipping at 125%, 150% and 200% scaling or at the minimum window size.

### MEDIUM — Performance

- **Lists that are not virtualised** (`VirtualizingStackPanel`; an `ItemsControl` inside a `StackPanel` or a
  `ScrollViewer` defeats it).
- **Brushes and geometries not frozen** (`Freeze()`); `DropShadowEffect` or blur on large or animated areas.
- **Deep layout nesting**, or a `Grid` where a lighter panel would do.
- **Work on the UI thread** that could be batched or moved off it; `Dispatcher.Invoke` inside a loop.

### MEDIUM — Build (this machine)

- Debug builds set `<UseAppHost>false</UseAppHost>` and the launcher runs `dotnet <App>.dll`: a freshly built
  apphost `.exe` is blocked by the managed-machine policy. Release publish is unaffected.

## Diagnostic Commands

```bash
dotnet build
dotnet test --no-build
dotnet format --verify-no-changes
```
