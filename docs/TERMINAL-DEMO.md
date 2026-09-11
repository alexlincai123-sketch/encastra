# The terminal demo

The design of the animated terminal on the website, and the exact transcript it plays.

---

## What it is, stated unambiguously

**The terminal on the website is a replayed animation. It is not a terminal.**

Precisely:

- It **never evaluates anything.** No `eval`, no `new Function`, no dynamic import, no template
  that becomes code.
- It **never runs a command.** There is no interpreter behind it, on the page or on a server.
  Nothing a visitor does causes a process to start anywhere.
- It **never accepts visitor input into anything executable.** There is no prompt that takes a
  command. If a later version adds a control, it selects which pre-recorded transcript to play —
  an index into a fixed list, never a string that is interpreted.
- It **has no back end.** The transcript is a constant in the page. There is no request, no API,
  no session, and nothing to attack on the other side, because there is no other side.
- It **renders as text.** Lines are inserted as text content and styled by class. Nothing is
  assigned as HTML, so the transcript cannot introduce markup even though the transcript is ours
  and contains none.

The only thing it does is reveal characters of a fixed string over time.

## Why that constraint exists

This is not caution for its own sake. Encastra's entire proposition is that software you did not
write should not be able to reach things you did not permit. A website advertising that claim
with a box that executes whatever a visitor types would be refuting the claim in the act of
making it — and it would be the most attractive target on the property, because a real terminal
on a marketing site is a remote code execution vulnerability with a nice font.

There is also no upside to trade against. The purpose of the demo is to show what running a
workflow looks like. A recording does that perfectly. Nothing a visitor could type would teach
them more, and the honest version of "try it yourself" is the download link, where the real
runtime enforces real permissions.

[BETA-0.2-AUDIT](BETA-0.2-AUDIT.md) §4 records this as the one new risk the website phase
introduces, and as a **design constraint rather than a to-do**: it is not something to be added
later if there is time, it is a property the component must have to exist at all.

### What a reviewer should check

1. Search the web application for `eval`, `new Function`, `setTimeout` with a string argument,
   `innerHTML`, `dangerouslySetInnerHTML`. The terminal must appear in none of them.
2. Confirm the transcript is a static constant, not fetched.
3. Confirm no input element in the component is bound to anything but playback control.
4. Confirm the page's Content-Security-Policy forbids inline and remote script. If the terminal
   ever needed either, it would have stopped being an animation.

---

## What it shows, and why this transcript

The demo is one command, run twice. The first run **fails**, and that is the point.

Most product demonstrations show a thing succeeding. This one shows the product refusing to do
something, and then doing it once permission is given. That sequence is the entire argument in
about fifteen seconds:

- A component that ships with the product, written by the people who wrote the runtime, tried to
  write a file. It was refused, because nobody had allowed a folder.
- The refusal says exactly what happened and what to do about it.
- The rest of the workflow still ran. One refusal does not discard the work that succeeded.
- Adding one flag — naming **one step** and **one folder** — makes it work.

Somebody who watches that understands the permission model without being told about it. A demo of
a workflow simply succeeding would show a picture of boxes and prove nothing that a diagram could
not.

The transcript is taken from `examples/json-report`, which is a real example in the repository
that anybody can run themselves. It is a four-step workflow: read a file, parse it as JSON, write
it out again, then show a notification.

---

## The transcript

**Status: specified, and to be verified against a real capture before the site ships.** The lines
below are built from the CLI's actual printing code and the actual example in
`examples/json-report`, not invented — but they were written by reading that code rather than by
running the binary. Before this goes on a public page somebody must run the two commands and
paste what comes back.

**If the CLI's output format changes, this must be re-captured rather than edited by hand** — a
recording that no longer matches what the product prints is a lie that is very hard to notice.
The transcript quoted in the repository `README` is an example of exactly that: it predates Read
File gaining its `name` output and no longer shows every line the command prints.

Two acts. `⏸` marks a deliberate pause; it is not part of the output.

### Act one — refused

```console
$ cd examples/json-report
$ encastra run graph.json --input read.file=./data.json

ok   read  (encastra.file.read@1.0.0) 0ms
       -> name: text (9 characters)
       -> text: text (62 characters)
ok   parse  (encastra.data.json@1.0.0) 0ms
       -> json: json (3 fields)
FAIL write  (encastra.file.write@1.0.0) 0ms
       denied: This component tried to use fs.write and was not allowed: no folder has been
       allowed for this node.
       Grant this component access to a folder, then run again.
       1 capability call(s) refused
skip notify  (encastra.system.notify@1.0.0)
       because "write" did not finish

Finished with 1 failure(s). The rest of the graph still ran. in 0ms
```

⏸ — hold here. This is the frame that does the work, and it needs long enough to be read.

### Act two — allowed

```console
$ encastra run graph.json --input read.file=./data.json --allow-write write=./out

ok   read  (encastra.file.read@1.0.0) 0ms
       -> name: text (9 characters)
       -> text: text (62 characters)
ok   parse  (encastra.data.json@1.0.0) 0ms
       -> json: json (3 fields)
ok   write  (encastra.file.write@1.0.0) 1ms
       -> file: file #2
       -> saved: true
ok   notify  (encastra.system.notify@1.0.0) 0ms
       -> message: text (4 characters)

Finished. in 1ms
```

⏸ — hold, then loop back to act one.

### Notes on fidelity

- The handle number in `file #2` is the one detail most likely to differ from the capture. Handles
  are assigned per run and the number is real rather than decorative, so whatever the real run
  prints is what goes here.
- The blank line before the first result line and before the closing summary are both produced by
  the CLI. Do not tidy them away.
- `read` emits its ports in the order the journal holds them, which is alphabetical: `name` before
  `text`.
- `notify` outputs four characters because the message it received was the word `true` — the
  `saved` output of the previous step, converted from a boolean to text automatically. That is a
  small, true illustration of an implicit conversion, and it is worth not editing out even though
  it looks odd.
- The command is written as `encastra` rather than `cargo run -p encastra-cli --`. The real
  invocation from a source checkout is the latter; the shorter form is what an installed binary
  is called, and the transcript is showing the product rather than the build system.

---

## Presentation

**Typing, not scrolling.** The command types out at a readable speed; output appears in whole
lines, because that is how a real terminal behaves and because animating output character by
character makes people wait for information they can already almost read.

**Colour carries meaning and is never the only thing that does.** `ok`, `FAIL` and `skip` are
words before they are colours, so the transcript survives being read by somebody who cannot
distinguish them and by anybody who copies it as text.

**It loops.** Two acts, then back to the beginning. Somebody arriving mid-cycle sees the refusal
within one loop, which is why the pause after act one is the longest beat in the animation.

**It respects `prefers-reduced-motion`.** With reduced motion requested, the transcript is shown
complete and static rather than typed. The information is the point; the animation is packaging.

**It is text to a screen reader.** The terminal is a region with an accessible name saying what it
is — a recorded demonstration — and its content is readable. Announcing each character as it
arrives would be unusable, so the finished transcript is what is exposed.

**It is selectable and copyable**, and what you copy is the transcript, without the prompt
characters where that can be arranged. Somebody who wants to try the real thing should not have to
retype it.

**It never claims to be live.** Nothing near it says "try it" or shows a cursor waiting for input.
A caption identifying it as a recording costs nothing and keeps the page honest.

---

## What it must never become

Written down because the pressure to change it will come from a reasonable place — somebody will
observe that visitors would engage more with a box they could type into, and they will be right.

- Not a real terminal, in a sandbox, on a server, "just for the demo". That is the vulnerability
  described above with extra steps.
- Not WebAssembly-in-the-page running the actual runtime. It would be technically possible and
  genuinely impressive, and it would mean visitor input reaching an execution engine on a page
  that is meant to be inert. If that is ever wanted, it is a separate product decision with a
  separate threat model, not an enhancement to this component.
- Not a transcript assembled from fragments chosen by a query string. The moment what is displayed
  depends on the URL, the page has an input and this document's first section stops being true.

If any of those is ever built, this file is wrong and must be rewritten rather than quietly
left standing.
