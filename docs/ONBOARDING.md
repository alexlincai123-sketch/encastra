# First run

The design of what happens the first time somebody opens Encastra.

This is a design document rather than a description of shipped behaviour: onboarding is part of
the 0.2 work and is being built as this is written. What is fixed here is the *shape* and the
constraints it has to satisfy. Where the built thing differs, the built thing wins and this is
updated.

---

## The problem

A new person opens the application and sees a canvas. They do not know what a component is, what
a port is, why a connection might be refused, or why anything would ask them for permission.
Nothing on the screen tells them, and the documentation is somewhere they will not look.

Stated in [BETA-0.2-AUDIT](BETA-0.2-AUDIT.md) §3.2: *nothing teaches the product.* That is the
gap. This is the design that closes it.

---

## What it has to achieve

Exactly one thing: **the person ends their first session having run something and understood what
came out.**

Not "has seen the features". Not "has created an account", which does not exist. Not "has read the
principles". Somebody who has watched a file they chose turn into a file they can find, and
understands roughly why the application asked them a question along the way, has the whole model.
Everything else can be learned when it is needed.

Four ideas are worth carrying, in this order of importance:

1. A workflow is blocks joined by lines, and the lines say what feeds what.
2. Blocks only fit together when their types agree, and the editor stops you rather than letting
   you fail later.
3. A block can only reach what you allow it to reach, and you are asked per step.
4. You press run, and you can see what happened.

Anything in the first-run experience that does not serve one of those four is decoration.

---

## The constraints

**One to three minutes.** Long enough to run something, short enough that nobody resents it. If
it cannot be done in three minutes it is teaching too much; the tutorial in
[TUTORIALS](TUTORIALS.md) exists for people who want more, and that is a deliberate handoff.

**Skippable at every point, in one action, with no penalty.** Not "skip and we will ask again
tomorrow". Skip means skipped: the person lands on Home and everything the onboarding would have
offered is still reachable from there. Somebody who has used this class of tool before knows what
a node graph is, and detaining them teaches them the product does not respect their time. The skip
control is visible from the first frame — a skip you have to hunt for is a dark pattern with a
polite name.

**It never blocks anything.** No modal that must be dismissed before the application will
function, no gate in front of the canvas.

**It is offered once and can be found again.** It does not reappear on the second launch — an
application that re-teaches itself is an application that thinks you are not learning. It stays
available from Home, because somebody who skipped on day one may want it on day three.

**It teaches with the real thing.** No mock canvas, no simulated permission dialog, no screenshot
of a run. The person uses the actual editor with actual components, and the run at the end is a
real run through the real engine with a real permission prompt. A tour with a fake dialog would be
teaching people to trust a dialog that had not been tested against the truth, which is precisely
the habit this product cannot afford to create.

**It is completable from the keyboard**, like everything else — see [UX](UX.md) §7.

---

## The shape

### Frame one: a choice, not a tour

The first screen says what Encastra is in one short paragraph — it runs jobs on your own machine,
assembled from parts rather than written — and offers three doors. Skip is visible alongside them,
not hidden underneath.

**"Build your first workflow"** — the guided path. Three or four steps, a real result. This is the
default and the one that should look most inviting, because it is the one that works for somebody
who knows nothing.

**"Look at a working example"** — opens one of the demo workflows already assembled, with a short
explanation of what each block is doing. For the person who would rather read something complete
than assemble something from nothing. It is a genuinely different learning style, not a lesser
one, and both demos arrive with their folders empty for the same reason they always do: a demo
that quietly wrote into a folder nobody chose would be doing the exact thing the product exists to
prevent. Filling those in is the first thing the explanation asks for, which teaches the
permission model by having them do it rather than by telling them about it.

**"I have used something like this before"** — skips to Home, with a single line naming the one
thing that is genuinely unusual here: that each step is granted permissions individually and they
last one run. That sentence is the highest-value thing an experienced person can be told, because
it is the thing their experience will not have prepared them for.

### The guided path

Watch Folder → Resize Image → Save File. The same workflow as the tutorial and the same one the
project's own checkpoint test uses, because if it ever stops working a test fails before a person
meets it.

It is guided, not automated. The person performs each action; the application says what to do and
why in one sentence each, and gets out of the way. Watching a workflow assemble itself teaches
nothing.

**1. Place the first block.** The palette highlights Watch Folder. *"A trigger starts your
workflow. This one starts it whenever a file appears in a folder."* — the word *trigger* is
introduced by pointing at one rather than by defining it.

**2. Choose a folder to watch.** A real folder picker. The person picks or creates one.

**3. Place the next two and connect them.** Resize Image, then Save File, joined by two lines.
*"A line means: when this finishes, hand the result to that."* One sentence, once, at the moment
the person draws the first line. This is also where the type system teaches itself for free —
ports show what they carry, and the connection succeeds because the types fit. It does not need a
lecture; if the person later tries something that does not fit, the refusal explains itself
([UX](UX.md) §3).

**4. Answer the permission questions.** The real prompts, in the inspector. *"Nothing can touch
your files until you say so — and you are asked per step, for one folder."* Two answers: the
watcher may read that folder, Save File may write into the other one.

This is the moment the product makes its actual argument, and it works because the person has
context: they know what the block does, they chose the folder, and the prompt tells them what it
will not be able to reach. A permission request understood is worth more than any amount of
copy about security.

**5. Run it.** *"Drop a photo into the folder you are watching."*

The blocks light up. A smaller file appears in the other folder. Done.

### The ending

A short close that does three things and stops: says what just happened in two sentences, points
at where the result is, and names one next step — the full tutorial, or the component catalogue.
No confetti, no checklist of features not yet seen, no prompt to do anything else. The person has
what they came for.

---

## What it must not do

- **Not a modal tour with an overlay and numbered bubbles.** Those are read as an obstacle and
  dismissed, and dismissing them is the habit they teach.
- **Not a video.** It cannot be paused in the middle to try the thing, which is the only way
  anybody learns an editor.
- **Not a checklist of features.** "You have completed 3 of 8 steps" makes the product a task.
- **Not a request for anything.** There is no account, no email, no telemetry consent, no
  newsletter. There is nothing to ask for, and asking anyway would be the first thing the person
  learned about the product's priorities.
- **Not a simulation.** Real editor, real components, real permission prompt, real run.
- **Not an explanation of the architecture.** Handles, the broker, the type table and the journal
  are genuinely interesting and none of them belong in the first three minutes. They are in
  [CONCEPTS](CONCEPTS.md) for the person who wants them.

---

## How to tell whether it worked

Testable claims, so this can be checked rather than admired:

1. Somebody who has never seen the product runs a workflow within three minutes of first launch.
2. Asked afterwards what a connection means, they say something close to "it passes the result
   along".
3. Asked why they were shown a permission prompt, they say something close to "so that step could
   write into the folder I picked" — the *scope*, not just "for security".
4. Somebody who chooses to skip reaches Home in one action and is not asked again.
5. The whole path is completable without a mouse.

If 3 fails, the permission prompts are not saying enough — see [UX](UX.md) §4. If 1 fails, the
guided path is teaching too much.
