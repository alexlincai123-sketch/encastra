import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * One version, and a gate that notices when it stops being one.
 *
 * The number lives in six files because npm insists on a copy per package and Tauri insists on
 * its own. They agreed before this test existed only because they had always been edited
 * together — nothing enforced it. The first release where somebody misses one ships an
 * installer whose filename disagrees with its own About screen, which is exactly the kind of
 * thing nobody notices until a user reports it.
 *
 * `Cargo.toml` is the source of truth because it is the one the binary reports: Settings reads
 * `CARGO_PKG_VERSION` from the build rather than from anything typed into the interface.
 *
 * `python scripts/version.py --sync` fixes a failure here.
 */

const ROOT = join(__dirname, '..');

function read(relative: string): string {
  return readFileSync(join(ROOT, relative), 'utf-8');
}

/** The version from `[workspace.package]`, not from a dependency that happens to look alike. */
function cargoWorkspaceVersion(): string {
  const cargo = read('Cargo.toml');
  const section = cargo.match(/\[workspace\.package\]([\s\S]*?)(?=\n\[|$)/);
  expect(section, 'Cargo.toml should have a [workspace.package] section').toBeTruthy();
  const version = section?.[1].match(/^\s*version\s*=\s*"([^"]+)"/m);
  expect(version, '[workspace.package] should declare a version').toBeTruthy();
  return version?.[1] as string;
}

const MUST_AGREE = [
  'package.json',
  'apps/desktop/package.json',
  'apps/web/package.json',
  'packages/protocol/package.json',
  'packages/ui/package.json',
  'apps/desktop/src-tauri/tauri.conf.json',
];

describe('the version is declared once', () => {
  const expected = cargoWorkspaceVersion();

  it('looks like a version', () => {
    expect(expected).toMatch(/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/);
  });

  it('the website constant agrees with Cargo.toml', () => {
    // A seventh declaration, and one that escaped this test when it was first written: the site
    // needs the version at render time, and importing a package.json into the bundle is a
    // build-config decision nobody should have to make to print a number. It is covered here
    // because a declaration the enforcement does not know about is not enforced — which is
    // exactly how it came to be showing 0.2 while everything else said 0.3.
    const site = read('apps/web/src/config/site.ts');
    const found = site.match(/export\s+const\s+VERSION\s*(?::[^=]+)?=\s*['"]([^'"]+)['"]/);
    expect(found, 'site.ts should declare a VERSION constant').toBeTruthy();
    expect(found?.[1], 'run python scripts/version.py --sync').toBe(expected);
  });

  for (const file of MUST_AGREE) {
    it(`${file} agrees with Cargo.toml`, () => {
      let raw: string;
      try {
        raw = read(file);
      } catch {
        // A package that does not exist yet cannot disagree. The ones that do exist must.
        return;
      }
      const found = (JSON.parse(raw) as { version?: string }).version;
      expect(found, `${file} should declare a version`).toBeDefined();
      expect(found, `${file} disagrees; run python scripts/version.py --sync`).toBe(expected);
    });
  }
});
