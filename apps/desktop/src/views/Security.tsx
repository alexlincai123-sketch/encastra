/**
 * What this machine has agreed to.
 *
 * The point of a screen like this is not to reassure. It is to make the permission model
 * legible: what is installed, what each thing can reach, what it was actually allowed in the
 * workflow that is open, and what the product does **not** protect against.
 */

import { ipc } from '../ipc';
import { useEditor } from '../store';

const REACH: Record<string, string> = {
  'fs.read': 'Read files',
  'fs.write': 'Write files',
  'net.http': 'Use the network',
  'system.notify': 'Show notifications',
  'system.clipboard': 'Use the clipboard',
};

export function Security() {
  const manifests = useEditor((s) => s.manifests);
  const nodes = useEditor((s) => s.nodes);
  const grants = useEditor((s) => s.grants);
  const about = useEditor((s) => s.about);

  const all = Object.values(manifests);
  const thirdParty = all.filter((m) => m.kind !== 'core');

  return (
    <main className="view view--security">
      <header className="view__header">
        <h1>Security</h1>
        <p>
          Components cannot reach your files, your network or your clipboard unless a manifest
          declares it and you allow it. Permissions are granted per run, and every request — allowed
          or refused — is recorded where you can read it.
        </p>
      </header>

      <section className="panel-block">
        <h2>Installed components</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Component</th>
              <th>Version</th>
              <th>Origin</th>
              <th>Can reach</th>
            </tr>
          </thead>
          <tbody>
            {all
              .sort((a, b) => a.id.localeCompare(b.id))
              .map((manifest) => {
                const reach = manifest.capabilities.filter((c) => c.scope !== 'input-handles');
                return (
                  <tr key={`${manifest.id}@${manifest.version}`}>
                    <td>
                      <strong>{manifest.name}</strong>
                      <br />
                      <code className="table__id">{manifest.id}</code>
                    </td>
                    <td>{manifest.version}</td>
                    <td>
                      <span className="badge badge--ok">built in</span>
                    </td>
                    <td>
                      {reach.length === 0 ? (
                        <span className="table__none">nothing</span>
                      ) : (
                        reach.map((c) => (
                          <span className="table__reach" key={c.kind} title={c.reason}>
                            {REACH[c.kind] ?? c.kind}
                          </span>
                        ))
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>

        {thirdParty.length === 0 ? (
          <p className="home__note">
            Nothing here came from outside this application. Third-party components would run in a
            WebAssembly sandbox with no ambient authority; that sandbox is designed and documented
            but <strong>not built</strong>, so installing them is not possible yet.
          </p>
        ) : null}
      </section>

      <section className="panel-block">
        <h2>Allowed in the open workflow</h2>
        {grants.length === 0 ? (
          <p className="empty">
            Nothing has been allowed. A workflow that needs a folder will ask before it runs.
          </p>
        ) : (
          <ul className="grants">
            {grants.map((grant) => {
              const node = nodes.find((n) => n.id === grant.node);
              const manifest = node ? manifests[node.data.componentRef] : undefined;
              return (
                <li key={`${grant.node}-${grant.kind}`}>
                  <strong>{manifest?.name ?? grant.node}</strong>
                  <span className="grants__what">{REACH[grant.kind] ?? grant.kind}</span>
                  {grant.folder ? <code>{grant.folder}</code> : null}
                  {grant.hosts?.length ? <code>{grant.hosts.join(', ')}</code> : null}
                </li>
              );
            })}
          </ul>
        )}
        <p className="home__note">
          These last for this session. Closing the application forgets them, so a workflow you have
          not looked at in a month cannot still be writing somewhere.
        </p>
      </section>

      <section className="panel-block">
        <h2>Privacy</h2>
        <dl className="kv kv--wide">
          <dt>Telemetry</dt>
          <dd>None. Nothing is collected and nothing is sent.</dd>
          <dt>Crash reports</dt>
          <dd>None.</dd>
          <dt>Accounts</dt>
          <dd>None. There is no sign-in and no server.</dd>
          <dt>Your files</dt>
          <dd>Never leave this machine unless a workflow you built sends them somewhere.</dd>
          <dt>Run journals</dt>
          <dd>
            Record sizes and shapes, never file contents. A journal is written to disk and shown on
            screen, so it is not somewhere your data should end up.
          </dd>
        </dl>
      </section>

      <section className="panel-block">
        <h2>What this does not protect against</h2>
        <ul className="limits">
          <li>
            A component you allow broad access to can misuse it. The dialog can make that informed;
            it cannot make it impossible.
          </li>
          <li>
            Built-in components run as ordinary native code. They are constrained by the permission
            broker, but a bug in one is a bug in the trusted base.
          </li>
          <li>
            This build has had no external security audit. That is a prerequisite for distributing
            components written by other people, not for running your own workflows.
          </li>
          <li>
            {ipc.live
              ? 'Nothing here is signed yet, so this build cannot prove it has not been altered.'
              : 'This is a browser preview with no runtime attached.'}
          </li>
        </ul>
      </section>

      {about ? (
        <p className="home__note">
          Runtime {about.runtime} · protocol schema {about.protocolSchema} · project schema{' '}
          {about.projectSchema}
        </p>
      ) : null}
    </main>
  );
}
