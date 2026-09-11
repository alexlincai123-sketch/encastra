//! The capability broker: the only code in the runtime that touches OS authority.
//!
//! Every capability call from every component goes through here, including first-party ones
//! (ADR-0002). A core component that did not declare `fs.read` cannot open a file, because it
//! asks the broker and the broker refuses. That costs a little and buys three things:
//!
//! 1. the permission dialog cannot lie, because what it says is what this enforces;
//! 2. the debugger's "capabilities used" panel is complete, not "complete except built-ins";
//! 3. there is no second, weaker path to forget about. A control some code can bypass is not
//!    a control.
//!
//! Handles are the other half. A component never supplies a path — it supplies a handle
//! number, and the broker decides whether that node was ever given that handle
//! (ADR-0004). Path traversal is not blocked here; it is unrepresentable.

use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};

use crate::graph::NodeId;
use crate::journal::{CapabilityCall, NodeError, now_ms};
use crate::value::{Handle, HandleKind};
use encastra_protocol::manifest::{ComponentManifest, SCOPE_INPUT_HANDLES};

/// What a grant is limited to.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum GrantScope {
    /// Only what the graph wired to this node's ports. Needs no decision from the user,
    /// because it adds nothing they have not already expressed by drawing an edge.
    InputHandles,
    /// A directory the user chose. Nothing outside it, symlinks resolved.
    Directory(PathBuf),
    /// Hosts the user allowed. An empty list is not "all hosts" — it is no hosts.
    HttpHosts(Vec<String>),
    /// A plain yes, for a capability with nothing to parameterise — showing a notification,
    /// for instance. Still a decision the user made; it is simply not scoped to a resource.
    Allowed,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Grant {
    pub kind: String,
    pub scope: GrantScope,
}

/// What each node is allowed to do in this run.
#[derive(Debug, Clone, Default)]
pub struct GrantSet {
    per_node: BTreeMap<NodeId, Vec<Grant>>,
}

impl GrantSet {
    pub fn new() -> Self {
        Self::default()
    }

    /// Admits the capabilities a manifest declares with an `input-handles` scope, and only
    /// those.
    ///
    /// Anything wider is deliberately *not* admitted here: it needs [`grant`](Self::grant),
    /// which the application calls after the user has actually said yes. A manifest asking for
    /// something does not make it granted — that is the entire point of declaring it.
    pub fn allow_declared_input_handles(&mut self, node: &NodeId, manifest: &ComponentManifest) {
        let declared: Vec<Grant> = manifest
            .capabilities
            .iter()
            .filter(|c| c.scope == SCOPE_INPUT_HANDLES)
            .map(|c| Grant {
                kind: c.kind.clone(),
                scope: GrantScope::InputHandles,
            })
            .collect();
        if !declared.is_empty() {
            self.per_node
                .entry(node.clone())
                .or_default()
                .extend(declared);
        }
    }

    /// Records a decision the user made.
    pub fn grant(&mut self, node: &NodeId, kind: &str, scope: GrantScope) {
        self.per_node.entry(node.clone()).or_default().push(Grant {
            kind: kind.to_owned(),
            scope,
        });
    }

    fn grants_for<'a>(&'a self, node: &NodeId, kind: &str) -> impl Iterator<Item = &'a Grant> {
        let kind = kind.to_owned();
        self.per_node
            .get(node)
            .map(|v| v.as_slice())
            .unwrap_or(&[])
            .iter()
            .filter(move |g| g.kind == kind)
    }

    fn has(&self, node: &NodeId, kind: &str) -> bool {
        self.grants_for(node, kind).next().is_some()
    }
}

/// One file found in a folder listing.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DirEntry {
    /// The file's name, with no directory.
    pub name: String,
    /// Host-side. A trigger passes this straight back to the broker rather than reading it.
    pub path: PathBuf,
    pub size: u64,
    pub modified_ms: u64,
}

struct HandleEntry {
    kind: HandleKind,
    /// Host-side only. This never crosses into a component, in any form.
    path: PathBuf,
    /// The file's name, with no directory.
    ///
    /// A component may read this. It is the minimum needed for a workflow to name its output
    /// after its input — a watcher cannot ask a person for a filename per file — and it reveals
    /// nothing about *where* the file is, which is the part that matters.
    display_name: String,
}

pub struct Broker {
    grants: GrantSet,
    handles: BTreeMap<u64, HandleEntry>,
    next_handle: u64,
    /// Scratch space owned by this run. Components write here without needing a user decision:
    /// it is the host's storage, not the user's filesystem.
    run_dir: PathBuf,
    /// Which handles each node was actually given. The executor fills this in as it delivers
    /// inputs, so a component can only reach what the graph wired to it.
    reachable: BTreeMap<NodeId, BTreeSet<u64>>,
    calls: BTreeMap<NodeId, Vec<CapabilityCall>>,
}

impl Broker {
    pub fn new(run_dir: PathBuf, grants: GrantSet) -> std::io::Result<Self> {
        std::fs::create_dir_all(&run_dir)?;
        Ok(Broker {
            grants,
            handles: BTreeMap::new(),
            next_handle: 1,
            run_dir,
            reachable: BTreeMap::new(),
            calls: BTreeMap::new(),
        })
    }

    // -- host-side, never reachable from a component -------------------------------------

    /// Brings a file the user chose into the run. Called by the application, not by a
    /// component: this is the only way a path ever becomes a handle.
    pub fn import_file(&mut self, path: PathBuf, kind: HandleKind) -> Handle {
        let id = self.next_handle;
        self.next_handle += 1;
        let display_name = path
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_else(|| format!("file-{id}"));
        self.handles.insert(
            id,
            HandleEntry {
                kind,
                path,
                display_name,
            },
        );
        Handle { id, kind }
    }

    /// The name of the file behind a handle, with no directory. `None` if the handle is gone.
    pub fn display_name(&self, handle: Handle) -> Option<&str> {
        self.handles
            .get(&handle.id)
            .map(|e| e.display_name.as_str())
    }

    /// Lets `node` open `handle`, because the graph wired it to one of that node's inputs.
    pub fn make_reachable(&mut self, node: &NodeId, handle: Handle) {
        self.reachable
            .entry(node.clone())
            .or_default()
            .insert(handle.id);
    }

    /// Host-side resolution, for saving results and for tests. Not exposed to components.
    pub fn path_of(&self, handle: Handle) -> Option<&Path> {
        self.handles.get(&handle.id).map(|e| e.path.as_path())
    }

    pub fn take_calls(&mut self, node: &NodeId) -> Vec<CapabilityCall> {
        self.calls.remove(node).unwrap_or_default()
    }

    /// Reads an artifact the host itself owns.
    ///
    /// **Host-only. Not reachable from a component** — it is not exposed on `NodeContext`.
    /// Conversions on an edge are performed by the runtime, not by the node that receives the
    /// value, so requiring the *receiving* component to hold `fs.read` would be wrong in both
    /// directions: it would refuse legitimate conversions, and it would teach components to ask
    /// for a capability they do not need.
    ///
    /// This grants a component nothing. The result is written into another host-owned handle,
    /// and reading *that* still requires the component to have declared `fs.read` and to have
    /// been given the handle by the graph.
    pub fn host_read(&self, handle: Handle) -> Result<Vec<u8>, NodeError> {
        let Some(entry) = self.handles.get(&handle.id) else {
            return Err(NodeError::new(
                "missing-handle",
                "That value is no longer available.",
            ));
        };
        std::fs::read(&entry.path).map_err(|e| {
            NodeError::new(
                "read-failed",
                format!("Could not read the file ({}).", e.kind()),
            )
        })
    }

    /// Records that the host has verified an artifact's content and it is more specific than
    /// its handle claimed — a `file` that decodes as an image becomes an `image`.
    ///
    /// **Host-only.** A component cannot relabel a handle; `open_input` refuses a kind that
    /// disagrees with the host's record. This is the one place that record changes, and it
    /// changes only after the content has actually been checked.
    pub fn reclassify(&mut self, handle: Handle, kind: HandleKind) -> Handle {
        if let Some(entry) = self.handles.get_mut(&handle.id) {
            entry.kind = kind;
        }
        Handle {
            id: handle.id,
            kind,
        }
    }

    // -- the component-facing surface -----------------------------------------------------

    /// Reads what the graph connected to this node.
    ///
    /// Two independent checks, and both must pass: the node declared `fs.read`, and the graph
    /// actually gave it this handle. Neither implies the other.
    pub fn open_input(&mut self, node: &NodeId, handle: Handle) -> Result<Vec<u8>, NodeError> {
        let detail = format!("{} #{}", handle.kind.type_name(), handle.id);

        if !self.grants.has(node, "fs.read") {
            return Err(self.deny(
                node,
                "fs.read",
                detail,
                "this component did not declare that it reads files",
            ));
        }

        if !self
            .reachable
            .get(node)
            .is_some_and(|set| set.contains(&handle.id))
        {
            return Err(self.deny(
                node,
                "fs.read",
                detail,
                "nothing in the graph connected that to this node",
            ));
        }

        let Some(entry) = self.handles.get(&handle.id) else {
            return Err(self.deny(node, "fs.read", detail, "that handle does not exist"));
        };

        // A `Handle` is a plain value, so a component can construct one with whatever `kind`
        // it likes. That grants no new authority — reachability is checked above — but it
        // would let a component claim a text file is an image and confuse whatever it hands
        // the result to. The host's record of the kind is the one that counts.
        if entry.kind != handle.kind {
            let actual = entry.kind;
            return Err(self.deny(
                node,
                "fs.read",
                detail,
                &format!(
                    "that handle is of kind {}, not {}",
                    actual.type_name(),
                    handle.kind.type_name()
                ),
            ));
        }

        let path = entry.path.clone();
        match std::fs::read(&path) {
            Ok(bytes) => {
                self.allow(node, "fs.read", detail);
                Ok(bytes)
            }
            Err(e) => {
                // The error carries the OS message but never the path: a journal entry is
                // rendered on screen, and a person showing somebody a failed run should not be
                // showing them their directory layout.
                self.allow(node, "fs.read", detail);
                Err(NodeError::new(
                    "read-failed",
                    format!("Could not read the connected file ({}).", e.kind()),
                ))
            }
        }
    }

    /// Creates somewhere for this node to put a result.
    ///
    /// Needs no user decision: it lands in the run's own scratch directory, which is host
    /// storage. It becomes a file the user can see only when something later saves it, and
    /// that step does need a decision.
    pub fn create_output(
        &mut self,
        node: &NodeId,
        kind: HandleKind,
        suggested_name: &str,
    ) -> Result<Handle, NodeError> {
        let id = self.next_handle;
        let safe = sanitise_filename(suggested_name);
        let path = self.run_dir.join(format!("{id}-{safe}"));

        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| {
                NodeError::new(
                    "write-failed",
                    format!("Could not prepare scratch space ({}).", e.kind()),
                )
            })?;
        }

        self.next_handle += 1;
        self.handles.insert(
            id,
            HandleEntry {
                kind,
                path,
                display_name: safe.clone(),
            },
        );
        // A node can always read back what it just produced.
        self.reachable.entry(node.clone()).or_default().insert(id);
        self.allow(
            node,
            "fs.write",
            format!("scratch {} #{id}", kind.type_name()),
        );
        Ok(Handle { id, kind })
    }

    pub fn write_output(
        &mut self,
        node: &NodeId,
        handle: Handle,
        bytes: &[u8],
    ) -> Result<(), NodeError> {
        let Some(entry) = self.handles.get(&handle.id) else {
            return Err(self.deny(
                node,
                "fs.write",
                format!("#{}", handle.id),
                "that handle does not exist",
            ));
        };
        if !self
            .reachable
            .get(node)
            .is_some_and(|s| s.contains(&handle.id))
        {
            return Err(self.deny(
                node,
                "fs.write",
                format!("#{}", handle.id),
                "this node does not own that handle",
            ));
        }
        let path = entry.path.clone();
        std::fs::write(&path, bytes).map_err(|e| {
            NodeError::new(
                "write-failed",
                format!("Could not write the result ({}).", e.kind()),
            )
        })?;
        Ok(())
    }

    /// Copies a result out of scratch and into a directory the user chose.
    ///
    /// This is where `fs.write` stops being free. The destination must be inside a granted
    /// directory *after* symlinks are resolved — checking the string before resolution is how
    /// traversal bugs happen.
    pub fn save_to(
        &mut self,
        node: &NodeId,
        handle: Handle,
        directory: &Path,
        filename: &str,
    ) -> Result<PathBuf, NodeError> {
        let detail = format!("{} → {}", handle.id, sanitise_filename(filename));

        let granted = self.writable_roots(node);

        if granted.is_empty() {
            return Err(self
                .deny(
                    node,
                    "fs.write",
                    detail,
                    "no folder has been allowed for this node",
                )
                .with_hint("Grant this component access to a folder, then run again."));
        }

        let Some(source) = self.handles.get(&handle.id).map(|e| e.path.clone()) else {
            return Err(self.deny(node, "fs.write", detail, "that handle does not exist"));
        };

        let destination = directory.join(sanitise_filename(filename));
        let resolved_dir = match resolve_existing_dir(directory) {
            Some(d) => d,
            None => {
                return Err(self.deny(node, "fs.write", detail, "that folder does not exist"));
            }
        };

        if !granted
            .iter()
            .any(|allowed| resolved_dir.starts_with(allowed))
        {
            return Err(self
                .deny(
                    node,
                    "fs.write",
                    detail,
                    "that folder is outside what was allowed",
                )
                .with_hint(
                    "The folder you granted, or one inside it, is the only place this can write.",
                ));
        }

        std::fs::copy(&source, &destination).map_err(|e| {
            NodeError::new(
                "write-failed",
                format!("Could not save the result ({}).", e.kind()),
            )
        })?;
        self.allow(node, "fs.write", detail);
        Ok(destination)
    }

    /// Moves a result into a folder the user chose, removing the original.
    ///
    /// A move needs `fs.write` covering **both** ends. Copying into an allowed folder and then
    /// deleting from somewhere that was never allowed would be a deletion the user did not
    /// agree to, which is the more dangerous half of the operation.
    pub fn move_to(
        &mut self,
        node: &NodeId,
        handle: Handle,
        directory: &Path,
        filename: &str,
    ) -> Result<PathBuf, NodeError> {
        let Some(source) = self.handles.get(&handle.id).map(|e| e.path.clone()) else {
            return Err(self.deny(
                node,
                "fs.write",
                format!("#{}", handle.id),
                "that handle does not exist",
            ));
        };

        let Some(source_dir) = source.parent().and_then(resolve_existing_dir) else {
            return Err(self.deny(
                node,
                "fs.write",
                format!("#{}", handle.id),
                "the original is not somewhere this can be removed from",
            ));
        };

        if !self
            .writable_roots(node)
            .iter()
            .any(|root| source_dir.starts_with(root))
        {
            return Err(self
                .deny(
                    node,
                    "fs.write",
                    format!("#{}", handle.id),
                    "the folder the file is being moved out of has not been allowed",
                )
                .with_hint("A move deletes the original, so both folders need permission."));
        }

        let destination = self.save_to(node, handle, directory, filename)?;

        // The copy succeeded, so the file exists in both places. If the removal fails the
        // result is a copy rather than a move — reported, not silently accepted.
        std::fs::remove_file(&source).map_err(|e| {
            NodeError::new(
                "move-incomplete",
                format!("The file was copied but the original could not be removed ({}).", e.kind()),
            )
            .with_hint("The destination now has a copy. Remove the original yourself if you meant to move it.")
        })?;

        self.allow(node, "fs.write", format!("moved #{}", handle.id));
        Ok(destination)
    }

    /// Every directory this node may write into, resolved.
    fn writable_roots(&self, node: &NodeId) -> Vec<PathBuf> {
        self.grants
            .grants_for(node, "fs.write")
            .filter_map(|g| match &g.scope {
                GrantScope::Directory(d) => resolve_existing_dir(d),
                _ => None,
            })
            .collect()
    }

    /// Every directory this node may read from, resolved.
    fn readable_roots(&self, node: &NodeId) -> Vec<PathBuf> {
        self.grants
            .grants_for(node, "fs.read")
            .filter_map(|g| match &g.scope {
                GrantScope::Directory(d) => resolve_existing_dir(d),
                _ => None,
            })
            .collect()
    }

    /// Lists a folder the user allowed this node to read.
    ///
    /// Files only, one level deep, sorted. A watcher that descended into subfolders would be
    /// reading places the person granting the folder may not have pictured, and recursion is a
    /// separate decision that deserves its own answer.
    ///
    /// Size and modification time come back with the listing so that a caller never has to
    /// reach for `std::fs` itself. Every filesystem access in the product goes through this
    /// type; a convenience that let one caller skip it would make the audit trail a fiction.
    pub fn list_dir(
        &mut self,
        node: &NodeId,
        directory: &Path,
    ) -> Result<Vec<DirEntry>, NodeError> {
        let detail = directory
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_else(|| "folder".to_owned());

        let Some(resolved) = resolve_existing_dir(directory) else {
            return Err(self
                .deny(node, "fs.read", detail, "that folder does not exist")
                .with_hint("Check the folder on this node."));
        };

        if !self
            .readable_roots(node)
            .iter()
            .any(|root| resolved.starts_with(root))
        {
            return Err(self
                .deny(node, "fs.read", detail, "that folder has not been allowed")
                .with_hint("Allow this component to watch the folder, then start again."));
        }

        let entries = std::fs::read_dir(&resolved).map_err(|e| {
            NodeError::new(
                "read-failed",
                format!("Could not read the folder ({}).", e.kind()),
            )
        })?;

        let mut files: Vec<DirEntry> = entries
            .filter_map(|entry| entry.ok())
            .filter(|entry| entry.file_type().is_ok_and(|t| t.is_file()))
            .filter_map(|entry| {
                let metadata = entry.metadata().ok()?;
                Some(DirEntry {
                    name: entry.file_name().to_string_lossy().into_owned(),
                    path: entry.path(),
                    size: metadata.len(),
                    modified_ms: metadata
                        .modified()
                        .ok()
                        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                        .map(|d| d.as_millis() as u64)
                        .unwrap_or(0),
                })
            })
            .collect();
        files.sort_by(|a, b| a.path.cmp(&b.path));

        self.allow(node, "fs.read", format!("listed {}", files.len()));
        Ok(files)
    }

    /// Brings a file into the run, having checked that the node was allowed to read it.
    ///
    /// [`import_file`](Self::import_file) is the unguarded version, and is for the application
    /// handing over a file a person picked in a dialog. This one is for a component or trigger
    /// that found the file itself, where the folder grant is what makes it legitimate.
    pub fn import_guarded(
        &mut self,
        node: &NodeId,
        path: &Path,
        kind: HandleKind,
    ) -> Result<Handle, NodeError> {
        let name = path
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_else(|| "file".to_owned());

        let Some(parent) = path.parent().and_then(resolve_existing_dir) else {
            return Err(self.deny(
                node,
                "fs.read",
                name,
                "that file is not in a readable folder",
            ));
        };

        if !self
            .readable_roots(node)
            .iter()
            .any(|root| parent.starts_with(root))
        {
            return Err(self.deny(node, "fs.read", name, "that folder has not been allowed"));
        }

        let handle = self.import_file(path.to_path_buf(), kind);
        self.allow(node, "fs.read", format!("opened {}", handle.id));
        Ok(handle)
    }

    /// Hosts this node may reach. An empty result means none, which is also what an
    /// unconfigured allowlist means — "not configured" is never "everything".
    pub fn allowed_hosts(&self, node: &NodeId) -> Vec<String> {
        self.grants
            .grants_for(node, "net.http")
            .flat_map(|g| match &g.scope {
                GrantScope::HttpHosts(hosts) => hosts.clone(),
                _ => Vec::new(),
            })
            .collect()
    }

    pub fn check_http(&mut self, node: &NodeId, host: &str) -> Result<(), NodeError> {
        let allowed = self.allowed_hosts(node);
        if allowed.iter().any(|h| h == host) {
            self.allow(node, "net.http", host.to_owned());
            Ok(())
        } else {
            Err(self
                .deny(
                    node,
                    "net.http",
                    host.to_owned(),
                    "that host has not been allowed",
                )
                .with_hint("Allow this component to reach that host, then run again."))
        }
    }

    /// Whether a node holds a capability at all, for a component that wants to degrade rather
    /// than fail — reading the clipboard when allowed and skipping it when not.
    pub fn has_capability(&self, node: &NodeId, kind: &str) -> bool {
        self.grants.has(node, kind)
    }

    pub fn use_clipboard(&mut self, node: &NodeId, detail: &str) -> Result<(), NodeError> {
        if !self.grants.has(node, "system.clipboard") {
            return Err(self.deny(
                node,
                "system.clipboard",
                detail.to_owned(),
                "this component did not declare that it uses the clipboard",
            ));
        }
        self.allow(node, "system.clipboard", detail.to_owned());
        Ok(())
    }

    pub fn notify(&mut self, node: &NodeId, title: &str) -> Result<(), NodeError> {
        if !self.grants.has(node, "system.notify") {
            return Err(self.deny(
                node,
                "system.notify",
                title.to_owned(),
                "this component did not declare that it shows notifications",
            ));
        }
        self.allow(node, "system.notify", title.to_owned());
        Ok(())
    }

    // -- journal ---------------------------------------------------------------------------

    fn allow(&mut self, node: &NodeId, kind: &str, detail: impl Into<String>) {
        self.calls
            .entry(node.clone())
            .or_default()
            .push(CapabilityCall {
                at_ms: now_ms(),
                kind: kind.to_owned(),
                detail: detail.into(),
                allowed: true,
                denied_because: None,
            });
    }

    /// Records the denial *and* builds the error, so there is no path where a refusal happens
    /// without being written down.
    fn deny(
        &mut self,
        node: &NodeId,
        kind: &str,
        detail: impl Into<String>,
        because: &str,
    ) -> NodeError {
        let detail = detail.into();
        self.calls
            .entry(node.clone())
            .or_default()
            .push(CapabilityCall {
                at_ms: now_ms(),
                kind: kind.to_owned(),
                detail: detail.clone(),
                allowed: false,
                denied_because: Some(because.to_owned()),
            });
        NodeError::new(
            "denied",
            format!("This component tried to use {kind} and was not allowed: {because}."),
        )
    }
}

/// Strips everything that could make a filename mean somewhere else.
fn sanitise_filename(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .filter(|c| c.is_alphanumeric() || matches!(c, '.' | '-' | '_' | ' '))
        .collect();
    let trimmed = cleaned.trim().trim_start_matches('.').trim();
    if trimmed.is_empty() {
        "output".to_owned()
    } else {
        trimmed.chars().take(120).collect()
    }
}

/// Canonicalises a directory, resolving symlinks. Containment is checked on the result, never
/// on the string that was passed in.
fn resolve_existing_dir(path: &Path) -> Option<PathBuf> {
    std::fs::canonicalize(path).ok().filter(|p| p.is_dir())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn manifest_declaring(kind: &str, scope: &str) -> ComponentManifest {
        ComponentManifest::parse(
            &serde_json::json!({
                "schema": 1, "id": "test.reader", "version": "1.0.0", "name": "Reader",
                "runtime": ">=0.1.0", "kind": "core",
                "ports": { "inputs": { "in": { "type": "file" } }, "outputs": { "out": { "type": "file" } } },
                "capabilities": [{ "kind": kind, "scope": scope, "reason": "Because the test says so." }]
            })
            .to_string(),
        )
        .unwrap()
    }

    struct Fixture {
        broker: Broker,
        node: NodeId,
        _dir: tempdir::TempDir,
        source: PathBuf,
    }

    fn fixture(declares_read: bool) -> Fixture {
        let dir = tempdir::TempDir::new();
        let source = dir.path().join("input.txt");
        std::fs::write(&source, b"hello").unwrap();

        let node = NodeId("n".into());
        let mut grants = GrantSet::new();
        if declares_read {
            grants.allow_declared_input_handles(
                &node,
                &manifest_declaring("fs.read", SCOPE_INPUT_HANDLES),
            );
        }
        let broker = Broker::new(dir.path().join("run"), grants).unwrap();
        Fixture {
            broker,
            node,
            _dir: dir,
            source,
        }
    }

    #[test]
    fn reads_what_the_graph_connected() {
        let mut f = fixture(true);
        let handle = f.broker.import_file(f.source.clone(), HandleKind::File);
        f.broker.make_reachable(&f.node, handle);

        assert_eq!(f.broker.open_input(&f.node, handle).unwrap(), b"hello");
        let calls = f.broker.take_calls(&f.node);
        assert_eq!(calls.len(), 1);
        assert!(calls[0].allowed);
    }

    #[test]
    fn refuses_a_handle_the_graph_never_gave_this_node() {
        // The whole point of handles: guessing a number reaches nothing.
        let mut f = fixture(true);
        let handle = f.broker.import_file(f.source.clone(), HandleKind::File);
        // No make_reachable.
        let err = f.broker.open_input(&f.node, handle).unwrap_err();
        assert_eq!(err.code, "denied");
        assert!(err.message.contains("connected"), "{}", err.message);

        let forged = Handle {
            id: 9999,
            kind: HandleKind::File,
        };
        assert!(f.broker.open_input(&f.node, forged).is_err());
    }

    #[test]
    fn a_component_that_did_not_declare_fs_read_cannot_read_even_a_connected_file() {
        // Tier A goes through the same gate as everyone else (ADR-0002).
        let mut f = fixture(false);
        let handle = f.broker.import_file(f.source.clone(), HandleKind::File);
        f.broker.make_reachable(&f.node, handle);

        let err = f.broker.open_input(&f.node, handle).unwrap_err();
        assert_eq!(err.code, "denied");
        assert!(err.message.contains("did not declare"), "{}", err.message);
    }

    #[test]
    fn a_component_cannot_relabel_a_handle_to_something_it_is_not() {
        // Handle is a plain value; a component can build one with any `kind`. The host's
        // record wins, so a text file cannot be passed off as an image.
        let mut f = fixture(true);
        let real = f.broker.import_file(f.source.clone(), HandleKind::File);
        f.broker.make_reachable(&f.node, real);

        let relabelled = Handle {
            id: real.id,
            kind: HandleKind::Image,
        };
        let err = f.broker.open_input(&f.node, relabelled).unwrap_err();
        assert_eq!(err.code, "denied");
        assert!(
            err.message.contains("kind file, not image"),
            "{}",
            err.message
        );
    }

    #[test]
    fn only_the_host_can_reclassify_a_handle_and_only_after_checking() {
        let mut f = fixture(true);
        let handle = f.broker.import_file(f.source.clone(), HandleKind::File);
        f.broker.make_reachable(&f.node, handle);

        // The host verifies content and promotes the kind; the component then sees an image.
        let promoted = f.broker.reclassify(handle, HandleKind::Image);
        assert_eq!(promoted.kind, HandleKind::Image);
        assert!(f.broker.open_input(&f.node, promoted).is_ok());

        // And the old label no longer works, because the host's record is the truth.
        assert!(f.broker.open_input(&f.node, handle).is_err());
    }

    #[test]
    fn host_read_is_not_a_back_door_into_a_component() {
        // It reads, but it hands nothing to anybody: the component still needs its own grant
        // and its own reachable handle to see anything.
        let mut f = fixture(false);
        let handle = f.broker.import_file(f.source.clone(), HandleKind::File);
        assert_eq!(f.broker.host_read(handle).unwrap(), b"hello");
        assert!(f.broker.open_input(&f.node, handle).is_err());
    }

    #[test]
    fn every_denial_is_written_down() {
        let mut f = fixture(false);
        let handle = f.broker.import_file(f.source.clone(), HandleKind::File);
        f.broker.make_reachable(&f.node, handle);
        let _ = f.broker.open_input(&f.node, handle);

        let calls = f.broker.take_calls(&f.node);
        assert_eq!(
            calls.len(),
            1,
            "a refusal must never be the call that goes unlogged"
        );
        assert!(!calls[0].allowed);
        assert!(calls[0].denied_because.is_some());
    }

    #[test]
    fn writing_outside_the_granted_folder_is_refused() {
        let dir = tempdir::TempDir::new();
        let allowed = dir.path().join("allowed");
        let elsewhere = dir.path().join("elsewhere");
        std::fs::create_dir_all(&allowed).unwrap();
        std::fs::create_dir_all(&elsewhere).unwrap();

        let node = NodeId("n".into());
        let mut grants = GrantSet::new();
        grants.grant(&node, "fs.write", GrantScope::Directory(allowed.clone()));
        let mut broker = Broker::new(dir.path().join("run"), grants).unwrap();

        let out = broker
            .create_output(&node, HandleKind::File, "result.txt")
            .unwrap();
        broker.write_output(&node, out, b"data").unwrap();

        assert!(broker.save_to(&node, out, &allowed, "result.txt").is_ok());

        let err = broker
            .save_to(&node, out, &elsewhere, "result.txt")
            .unwrap_err();
        assert_eq!(err.code, "denied");
        assert!(err.message.contains("outside"), "{}", err.message);
    }

    #[test]
    fn dot_dot_cannot_climb_out_of_a_granted_folder() {
        let dir = tempdir::TempDir::new();
        let allowed = dir.path().join("allowed");
        std::fs::create_dir_all(allowed.join("inner")).unwrap();

        let node = NodeId("n".into());
        let mut grants = GrantSet::new();
        grants.grant(
            &node,
            "fs.write",
            GrantScope::Directory(allowed.join("inner")),
        );
        let mut broker = Broker::new(dir.path().join("run"), grants).unwrap();
        let out = broker
            .create_output(&node, HandleKind::File, "x.txt")
            .unwrap();
        broker.write_output(&node, out, b"data").unwrap();

        // ".." resolves during canonicalisation, so containment is decided on the real path.
        let escape = allowed.join("inner").join("..");
        let err = broker.save_to(&node, out, &escape, "x.txt").unwrap_err();
        assert_eq!(err.code, "denied");
    }

    #[test]
    fn a_move_needs_permission_for_the_folder_it_deletes_from() {
        let dir = tempdir::TempDir::new();
        let inbox = dir.path().join("inbox");
        let sorted = dir.path().join("sorted");
        std::fs::create_dir_all(&inbox).unwrap();
        std::fs::create_dir_all(&sorted).unwrap();
        let original = inbox.join("photo.png");
        std::fs::write(&original, b"pretend image").unwrap();

        let node = NodeId("n".into());
        let mut grants = GrantSet::new();
        // Destination allowed, source not.
        grants.grant(&node, "fs.write", GrantScope::Directory(sorted.clone()));
        let mut broker = Broker::new(dir.path().join("run"), grants).unwrap();
        let handle = broker.import_file(original.clone(), HandleKind::File);

        let err = broker
            .move_to(&node, handle, &sorted, "photo.png")
            .unwrap_err();
        assert_eq!(err.code, "denied");
        assert!(err.message.contains("moved out of"), "{}", err.message);
        assert!(
            original.exists(),
            "nothing may be deleted without permission"
        );
    }

    #[test]
    fn a_move_with_both_folders_allowed_actually_moves() {
        let dir = tempdir::TempDir::new();
        let inbox = dir.path().join("inbox");
        let sorted = dir.path().join("sorted");
        std::fs::create_dir_all(&inbox).unwrap();
        std::fs::create_dir_all(&sorted).unwrap();
        let original = inbox.join("photo.png");
        std::fs::write(&original, b"pretend image").unwrap();

        let node = NodeId("n".into());
        let mut grants = GrantSet::new();
        grants.grant(&node, "fs.write", GrantScope::Directory(inbox.clone()));
        grants.grant(&node, "fs.write", GrantScope::Directory(sorted.clone()));
        let mut broker = Broker::new(dir.path().join("run"), grants).unwrap();
        let handle = broker.import_file(original.clone(), HandleKind::File);

        let moved = broker.move_to(&node, handle, &sorted, "photo.png").unwrap();
        assert!(moved.exists());
        assert!(!original.exists(), "a move leaves nothing behind");
    }

    #[test]
    fn a_filename_cannot_smuggle_a_path() {
        assert_eq!(sanitise_filename("../../etc/passwd"), "etcpasswd");
        assert_eq!(
            sanitise_filename("C:\\Windows\\system32\\x"),
            "CWindowssystem32x"
        );
        assert_eq!(sanitise_filename(""), "output");
        assert_eq!(sanitise_filename("..."), "output");
        assert_eq!(sanitise_filename("report.csv"), "report.csv");
    }

    #[test]
    fn an_empty_host_allowlist_means_no_hosts_not_all_hosts() {
        let dir = tempdir::TempDir::new();
        let node = NodeId("n".into());
        let mut grants = GrantSet::new();
        grants.grant(&node, "net.http", GrantScope::HttpHosts(vec![]));
        let mut broker = Broker::new(dir.path().join("run"), grants).unwrap();

        assert!(broker.check_http(&node, "example.com").is_err());
    }

    /// A minimal temporary directory that cleans up after itself, so the test suite does not
    /// take a dependency for eight lines of code.
    mod tempdir {
        use std::path::{Path, PathBuf};
        use std::sync::atomic::{AtomicU64, Ordering};

        static COUNTER: AtomicU64 = AtomicU64::new(0);

        pub struct TempDir(PathBuf);

        impl TempDir {
            #[allow(clippy::new_without_default)]
            pub fn new() -> Self {
                let n = COUNTER.fetch_add(1, Ordering::Relaxed);
                let path =
                    std::env::temp_dir().join(format!("encastra-test-{}-{n}", std::process::id()));
                std::fs::create_dir_all(&path).expect("temp dir");
                TempDir(path)
            }

            pub fn path(&self) -> &Path {
                &self.0
            }
        }

        impl Drop for TempDir {
            fn drop(&mut self) {
                let _ = std::fs::remove_dir_all(&self.0);
            }
        }
    }
}
