# Interface principles

What the interface is supposed to do, and why. These are written as principles with their
reasoning so that they can be **checked against** — each one is phrased to be arguable. If a
screen breaks one of these, the screen is wrong, or the principle needs changing on purpose and
in writing.

The problem this document exists to solve was stated in [BETA-0.2-AUDIT](BETA-0.2-AUDIT.md) §3.5
more bluntly than anything here: *the interface does not explain itself.* A working engine with
an interface attached is not a product. These are the rules that turn the second into the first.

---

## 1. The interface must explain itself

**The principle.** Somebody who has never used this before should be able to work out what a
thing is by looking at it, without documentation, a tour, or a video.

**Why.** The product's entire claim is that assembling software from parts is easier than writing
it. An interface that needs a manual has disproved the claim before anybody has tried it. And the
documentation you are reading is not a substitute: most people will never open it. It is a
backstop for the person who wants more, not the primary channel.

**What it means in practice.** Every component states what it does in a sentence, on the block,
in the palette and in the catalogue — the same sentence, so nothing is a surprise later. Every
port carries its type visibly, because the type is what determines whether a connection is
possible and hiding it makes the rules feel arbitrary. Every setting has a label a person would
recognise rather than the name of the field in the data.

**How to check it.** Sit somebody in front of the product who has not seen it, and ask them what
a block does before they click anything. If they have to click to find out, the block is not
explaining itself.

---

## 2. Empty states teach; they do not merely state

**The principle.** A screen with nothing in it is the best teaching opportunity the product ever
gets, and it must be used for that. "Nothing here yet" is forbidden.

**Why.** An empty state is, by definition, a moment when somebody does not know what to do next —
otherwise they would have done it. Telling them the screen is empty describes something they can
already see. It spends the most valuable moment in the product saying nothing.

**What it means in practice.** An empty canvas says what a workflow is and offers the first
action. An empty component list explains what a component is. A run panel with no run explains
what pressing run will do. Where a demo exists, an empty state is a good place to offer it,
because reading a working example is faster than assembling a first one.

**How to check it.** Cover the heading and read only the body text. If it would be equally true
of any empty screen in any application, rewrite it.

---

## 3. A refusal always says why

**The principle.** Whenever the product declines to do something — a connection that will not
draw, a step that will not run, a permission that was not granted — it says what was refused, why,
and what would change the answer.

**Why.** This product refuses things more often than most, on purpose: types that do not fit,
permissions that were not given. That is the design working. But a refusal without a reason is
indistinguishable from a bug, and somebody who cannot tell the difference will conclude the
product is broken. Every silent refusal spends trust that the refusal was supposed to earn.

There is no excuse available, either. In every case the product **knows** the reason precisely —
the type rules are in a table it just consulted, the broker built the error and the reason in the
same function. The information exists; not showing it is a choice.

**What it means in practice.** A connection that is refused says which types were involved and
why they do not fit — and, when there is one, what would make it work. A step refused a permission
names the permission, says what was not allowed, and says to grant it and run again. A run that
partly succeeded says which step failed and which steps were skipped as a result, with the reason
each was skipped.

**How to check it.** Provoke each refusal deliberately and read what appears. If it does not
contain a *why* and a *next step*, it fails. The worst case in the product has been a refused
connection, where the editor simply did not complete the drag and said nothing at all.

---

## 4. A permission says what is not granted, as well as what is

**The principle.** When the product asks for a permission it states what the component will be
able to reach **and what it will not**. The second half is not optional.

**Why.** "Allow this to write files?" is not a question anybody can answer well, because it
sounds unbounded. The truth is much narrower — one step, one folder, one run — and the narrowness
is the entire reassurance. Withholding it makes the product sound more dangerous than it is, and
trains people to click yes without reading, which is the failure mode the whole model exists to
avoid.

A permission dialog is also a promise. It is only worth reading if what it says is what is
enforced, which is why every component goes through the same gate with no faster path for being
first-party: so the dialog cannot lie.

**What it means in practice.** The reason is a sentence written for the person deciding, not the
identifier of the capability. Several of the built-in reasons are already written this way and
are worth using as the model — *"Saves the file into the folder you pick. It cannot write
anywhere else."* names the limit in its second sentence. The scope is shown next to the button:
the actual folder, the actual address. Where a permission cannot be scoped, the button is
disabled until it can be, because a grant with nothing attached is an unbounded grant and the
product should not offer one.

It also means saying that the grant lasts one run, and that nothing is remembered — which is
currently true and is a real cost, not only a reassurance.

**How to check it.** Read every permission prompt aloud. If it does not contain the word *only*,
or *cannot*, or a named folder or address, it has told half the story.

---

## 5. A run is visible while it is happening

**The principle.** While a workflow is running, the product continuously shows that it is running,
what it is doing now, and what it has done.

**Why.** A local runtime doing real work on real files is the moment somebody decides whether to
trust it. Silence during that moment is read as "nothing is happening" or "it has hung", and both
conclusions end with the application being closed. Progress is also the fastest debugging tool
there is: watching which step everything stops at tells you more than any error message.

This needs saying because it is easy to under-build. Node states quietly updating is not the same
as somebody being able to see that a run is under way, how long each step took, and how many runs
a watcher has performed.

**What it means in practice.** The state of each step changes as it happens, distinguishably —
waiting, running, finished, failed, skipped. Timing is shown in a unit a person reads rather than
a number they decode. A workflow that is *watching* rather than running says so, and shows how
many times it has fired. When a run ends, the record of what happened stays available instead of
disappearing at the moment somebody wants to look at it.

**How to check it.** Start a run and look away from the toolbar. If nothing on the screen tells
you a run is in progress, it fails.

---

## 6. Nothing in the interface promises something that does not exist

**The principle.** No menu item, button, tab or screen refers to a feature that is not built. No
"coming soon", no disabled item hinting at a future, no placeholder for a marketplace.

**Why.** The first navigation item that opens an empty page teaches somebody that parts of this
application are decoration — and having learned it, they will wonder which other parts are. It
costs more trust than the feature would have earned. The sidebar has five items rather than ten
for exactly this reason: Marketplace and Community are absent because they do not exist.

**What it means in practice.** Absence over a placeholder, every time. Where something genuinely
matters to a person's decision — that components cannot be installed, that nothing is signed,
that no permission is remembered — it is stated as a plain fact in a place they will meet it,
rather than implied by a greyed-out button.

**How to check it.** Click everything. Anything that leads nowhere is a defect.

---

## 7. Every control is reachable from the keyboard

**The principle.** Anything that can be done with a mouse can be done without one, and where the
focus currently sits is always visible.

**Why.** This is a correctness requirement, not a polish item. A step that cannot be selected
cannot be configured, because its folder, its settings and its permission prompt all live in the
inspector — which means somebody who cannot use a mouse cannot use the product at all. That is
not a rough edge; it is an exclusion.

**Where this stands.** It has been the most serious defect in the build. Focus moved through the
sidebar, the toolbar and the palette and then wrapped, never visiting the blocks on the canvas.
It was named the first item of work in 0.2 for that reason — ahead of the website and ahead of
anything that would be more visible — and [BETA-0.2](BETA-0.2.md) is where its status is
recorded.

**What it means in practice.** Nodes can be reached, selected and moved between by keyboard, and
so can the wires between them: `C` starts a connection from the selected step and the arrow keys
offer only the ports the type rules would actually accept, while `E` steps through the connections
a step already has so that one can be deleted — a canvas that could be walked but never wired was
a keyboard path that stopped one step short of the product. The canvas carries the roles and labels
that let assistive software describe it, and says what it is holding as that changes. Icon-only
controls have accessible names, and a step's run state is told by a shape as well as a colour.
Focus is always visible, never trapped in a region with no way out, and the shortcuts that exist
are discoverable rather than folklore.

**How to check it.** Unplug the mouse. Build the first tutorial. Anywhere you get stuck is a
defect, and it is worth more than whatever else was planned that week.

---

## 8. The product tells you what it does not protect you against

**The principle.** The security limitations are stated in the product, not only in a document
somebody would have to find.

**Why.** A product whose central claim is safety is exactly the product that must not overstate
it. The claim here is specific and defensible — permissions are enforced against every component,
files travel as handles, refusals are recorded — and it is bounded: nothing is signed, no
third-party sandbox exists, there is no time or memory limit on a step, and none of it has been
externally audited. Saying so is what makes the parts that *are* true believable. A screen that
only reassures is marketing, and people can tell.

**What it means in practice.** The Security screen shows what is installed, what each thing can
reach, what the open workflow was actually allowed — and, on the same screen, what the product
does not defend against. Not in a footnote, and not behind a link.

**How to check it.** Read the Security screen as somebody sceptical. If it contains nothing that a
competitor would quote against it, it is not being honest.

---

## What these principles cost

Worth stating, so they are not treated as free.

Explaining refusals means writing a message for every refusal path, including the ones that
should rarely happen. Permission prompts written as sentences means each new capability needs
wording before it can ship, and a test enforces that the wording is a real sentence. Refusing to
show unbuilt features means the application looks smaller than the roadmap. Keyboard parity on a
canvas is genuine work with no visible payoff for most users.

All four are worth it, for one reason: this product asks people to let software they did not write
touch their files. Every one of these principles is a way of earning that, and an interface that
skips them is asking for trust it has not done anything to deserve.
