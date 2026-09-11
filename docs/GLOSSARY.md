# Glossary

The official words. The application, the website, the documentation, the tutorials and the
error messages all use these and no synonyms.

This exists because the alternative is what usually happens: the canvas calls something a
*node*, the palette calls it a *block*, the website calls it a *module*, and the documentation
calls it a *component*. Each is defensible on its own and together they teach a person that
there are four things when there is one. Consistency here is worth more than any individual word
being the best possible choice.

---

## The ten words

### Component
A single piece of software that does one thing — resize an image, read a file, make a request.
It declares what it takes, what it produces, and what it needs to reach. Twenty-one ship with
the application.

**Not**: block, module, node, plugin, extension, step. *(A **step** is what a component becomes
once it is on a canvas; see below. In running prose about a specific workflow, "step" is the
right word. In the abstract, it is "component".)*

### Port
A named place on a component where a value goes in or comes out. Every port has a type.

**Not**: socket, pin, slot, input/output (as nouns), handle, connector. *("Handle" means
something else entirely in this codebase — the runtime's opaque reference to a file.)*

### Connection
The join between one component's output port and another's input port. The editor allows it only
when the type rules do, which is why a connection is a statement about compatibility rather than
just a line.

**Not**: wire, edge, link, arrow, pipe. *(`edge` survives inside the graph code because that is
the term of art for a directed graph, and React Flow's API uses it. It never reaches a person.)*

### Workflow
A set of components connected together, which runs. What somebody builds.

**Not**: pipeline, flow, graph, chain, automation. *(`graph` survives inside the runtime and the
protocol for the same reason `edge` does.)*

### Project
A saved workflow, with its history, as an `.encastra` file. What somebody opens and keeps.

**Not**: document, file, workspace, board, canvas. *(The **canvas** is the surface a workflow is
drawn on, not the thing being saved.)*

### Step
One component placed in one workflow. The same component can be two steps in the same workflow,
configured differently.

Use "step" when talking about a particular workflow — "the first step", "select a step". Use
"component" when talking about the thing in general.

### Runtime
The engine that executes a workflow. Local, on the person's own machine, and the same engine
whether it is driven by the application or by the command line.

**Not**: engine, executor, backend, server, kernel. *(There is no server. Never imply one.)*

### Permission
What a person has allowed one step to reach, for one run — a folder, a host. Granted by
answering, never inherited, never remembered between sessions.

**Not**: access, grant, right, scope, privilege. *(`grant` is the internal name for the record;
a person is asked for a **permission**.)*

### Capability
What a component *declares* it needs, in its manifest, before anybody is asked anything. The
distinction from permission is the whole security model and is worth keeping sharp:

> A **capability** is a request. A **permission** is an answer.

A component that never declared `fs.write` cannot be granted it, whatever a person does.

**Not**: permission (they are different), feature, ability.

### Execution
One run of one workflow, from start to finish, producing a journal of what each step did.

**Not**: job, task, invocation, session. *(A **session** is a workflow left watching for events,
which may contain many executions.)*

---

## Two more that matter

### Trigger
A component that *starts* a workflow when something happens, rather than being a step inside it.
Watch Folder and Timer. A trigger sits at the beginning and has outputs but no inputs.

### Journal
The record a run leaves: every step, its status, how long it took, every permission it asked for
and whether it was allowed. It holds **summaries, never file contents**.

**Not**: log, history, trace, audit. *(A **log** is a line a component chose to write, and the
journal contains those among other things.)*

---

## How to use this

When writing anything a person will read — interface text, an error, a tutorial, a page on the
website — use these words with these meanings. When a sentence wants a synonym for variety,
resist it: variety in vocabulary is a cost paid by the reader, not the writer.

When the internal name genuinely differs — `edge`, `graph`, `grant`, `handle` — that is fine and
deliberate. The rule is that the internal name must not surface in anything a person reads.
