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

## Releases (maintainer)

`main` only changes through a pull request whose required checks are green. A release is never
built on a laptop; the full procedure, with what each step proves, is
[docs/RELEASE.md § Producing a build](docs/RELEASE.md#producing-a-build). In short:

```bash
python scripts/version.py --set <version>          # the only place a version is changed
git push origin HEAD:rc/<name>                      # candidate.yml builds copy A and copy B
python scripts/release_fetch.py --run <run id>
python scripts/release_manifest.py --allow-unsigned # pre-release; then commit docs/RELEASE.md + site.ts
python scripts/release_check.py --evidence-vm <clean VM evidence dir>   # must say BETA_READY
git tag -a v<version> -m "Encastra <version>" && git push origin v<version>
gh workflow run release.yml --ref v<version> -f allow_unsigned=true -f publish=true
```

Tags are immutable and published bytes are never replaced: a fix is a new version.

## Licence

Encastra is distributed under the [PolyForm Noncommercial License 1.0.0](LICENSE). For a commercial
licence or any business enquiry, write to alexcaioficial123@gmail.com. Before a
contribution is merged, the maintainer may ask you to confirm the terms under which you offer it.
