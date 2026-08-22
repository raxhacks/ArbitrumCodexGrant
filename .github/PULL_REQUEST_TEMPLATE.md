## What this changes

<!-- One or two sentences. Link the issue this closes, if any. -->

## Type of change

- [ ] New snippet
- [ ] Fix to an existing snippet
- [ ] Backend / API
- [ ] Frontend
- [ ] Documentation

## Verification

<!-- How you know this works. For snippets, paste the console output of a successful run. -->

```
```

## Checklist

- [ ] `npm run check` and `npm test` pass in `codex-backend`
- [ ] `npm run lint` and `npm run build` pass in `codex-frontend` (if the frontend changed)
- [ ] Documentation updated where the change affects it

### For snippet contributions

- [ ] Both `_ethers.js` and `_web3.js` variants included, with comparable output
- [ ] Filenames follow `NNN_PascalCaseName_<variant>.js` and use the next free number
- [ ] No private keys, mnemonics, API keys, or funded addresses committed
- [ ] Terminates on its own; watchers bounded by `MAX_EVENTS` / `MAX_DURATION_MS`
- [ ] Anything that spends funds defaults to a dry run
- [ ] Only `ethers`, `web3`, and the Node standard library are used
- [ ] `SNIPPET_META` entry added in `codex-backend/src/snippets/categories.ts`
- [ ] Ran successfully through `POST /api/run` against a locally running backend
