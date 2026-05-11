Run TypeScript type checking across the entire project without emitting files.

```bash
cd "/Users/apple/phucsang app/QU-N-TR-C-A-H-NG" && npx tsc --noEmit
```

Expected: no output (0 errors). Always run this after making TypeScript changes before reporting a task as done.

If errors are found, fix them in order — often one root cause triggers many downstream errors.
