# Contributing

Thank you for looking. Encastra is maintained by one person, so the honest expectation is that
replies take days, not hours.

## Reporting

- **Bugs:** open an issue with the bug template — what you did, what happened, what you expected,
  and the version shown in Settings.
- **Security problems:** never in a public issue. Use
  [private vulnerability reporting](https://github.com/alexlincai123-sketch/encastra/security/advisories/new);
  see [SECURITY](SECURITY.md).

## Changes

Open an issue before a large change, so we can agree on it before you spend the time. For any
pull request, the tree must pass the same gate CI runs:

```bash
npm ci && npm run lint && npm run typecheck && npm run test
cargo fmt --all --check
cargo clippy --workspace --all-targets --locked -- -D warnings
cargo test --workspace --locked
python scripts/generated_check.py
python -m unittest discover -s scripts/tests
```

Rules that are not negotiable here: no AI in the runtime; connection rules live only in
`packages/protocol/data/type-graph.json` (never regenerate the conformance matrix to make a test
pass); never commit secrets; never claim something the code does not do.

Encastra is distributed under the [PolyForm Noncommercial License 1.0.0](LICENSE). Before a
contribution is merged, the maintainer may ask you to confirm the terms under which you offer it.
