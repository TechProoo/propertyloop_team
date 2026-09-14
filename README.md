# PropertyLoop — Team Portal

Internal staff portal for the September 2026 organisational structure. React 19
+ Vite + Tailwind 4, matching the public site's brand tokens.

```bash
npm run dev      # http://localhost:5175
npm run build    # tsc -b && vite build
npm run lint
```

## Everything here is real

Every collection is read from the API and every change is written back to it.
There is no sample data left in this repo — if a number looks wrong, it is
wrong in the database, not invented here.

Sign-in is real authentication against a staff account, and the permissions the
portal enforces are the same ones the server issues, so what a screen offers and what the API allows cannot drift apart.

### Writes are optimistic

A change lands on screen immediately and the request follows it. That keeps the
portal quick on a Lagos connection, and it is why the store surfaces an error
banner: when a write fails, the screen has already moved, so something has to
say it did not stick. Failing writes reload the affected data from the server
rather than trying to reverse one change — by the time a request fails the
local state may have moved on, and the server's version is the only one that is
definitely true.

## Two things must land in the API before real logins

**1. Staff roles and permissions.** The backend `Role` enum is
`BUYER | AGENT | VENDOR | ADMIN` — there is no staff concept — and every handler
in `AdminController` runs the same check:

```ts
if (role !== Role.ADMIN) throw new ForbiddenException(...)
```

Giving these nine people staff accounts today means nine identical, total
logins: suspend any user, change any listing's status, approve withdrawals,
resolve escrow disputes, read KYC documents. [`src/lib/permissions.ts`](src/lib/permissions.ts)
describes the intended per-position access. It shapes this UI only — **a hidden
button is not an enforced rule**. The backend half is a `StaffProfile` table
(`userId`, `staffRole`, `permissions String[]`) replacing `checkAdminAccess`.

**2. Sourcing attribution on listings.** `Listing` has `agentId` — who owns the
listing — but no record of which staff member *brought it in*. So "Ola listed 14
properties this month" cannot be verified from the product database. The
`sourcedById` field used throughout the Properties screen is the field to add.

## What is a copy and what is not

Anything the product database already owns is **mirrored, not duplicated** —
`ListingStatus`, `LeadStatus`, `LeadSource` and `DocumentType` use values
identical to the Prisma schema, because Postgres stays the authority on what is
actually published. If "published" means something different here than on
propertyloop.ng, the number is fiction.

Anything with **no** backend model lives here for real, and that is the gap this
portal fills:

| Screen | Backing |
| --- | --- |
| Deals & mandates | **No Prisma model** — developers, advertisers, facility-management and building-finishing clients are not modelled anywhere |
| Properties | Mirrors `Listing` (+ the missing `sourcedById`) |
| Leads | Mirrors `Lead` |
| Content & shoots | **No Prisma model** — the video production line |
| Operations | Reads `KycSubmission`, `WithdrawalRequest`, `Report`, `JobDisputeMessage` |
| Threads | Maps onto `Conversation` / `Message`, plus an `isInternal` flag |
| Messages | Same tables — `ConversationParticipant.lastReadAt` already carries the read state |
| Daily log | **No Prisma model** |
| Targets / Team | **No Prisma model** |

## What can be created, and what cannot

Four things can be created in the portal, and the list is deliberate
([`src/components/forms.tsx`](src/components/forms.tsx)):

| Create | Why here |
| --- | --- |
| **Property** | Developer inventory arrives as a spreadsheet and a folder of photos, not through the public add-listing flow |
| **Offline lead** | Calls, walk-ins and referrals leave no trace otherwise |
| **Deal** | No backend model exists at all — this is the only record of it |
| **Internal task** | Work the platform does not know about |
| **Shoot** | The Ambassador's production line — 25–30 videos a month has to start somewhere |
| **Content piece** | Marketing's calendar |
| **Target** | Set and edit the monthly numbers (`MANAGE_TARGETS`) |
| **Staff position** | Add, edit and deactivate people (`MANAGE_STAFF`) |

**KYC reviews, payouts, reports, disputes and listing reviews cannot be created
by hand.** Those rows are projections of `KycSubmission`, `WithdrawalRequest`,
`Report` and `JobDisputeMessage`. A hand-made one would be a task with nothing
behind it that somebody could mark resolved without any money moving or any
document being checked. `DERIVED_OPS_KINDS` in `types.ts` names them; only
`TASK` is hand-created, and it is labelled `manual` in the queue.

Each form does double duty — pass `existing` and it edits that record instead
of creating one, so a field added to the create form can never go missing from
the edit form. A pencil icon on every property row, deal card, lead and task
opens it.

Three rules the forms enforce:

- A new property is filed `PENDING_REVIEW` with documents marked **received but
  unverified**, so it cannot walk through the publish gate in one step. Even
  with all four documents and twenty photos it still reads "4 documents
  unverified".
- `sourcedById` is taken from who is signed in, never chosen from a dropdown —
  that is what makes the acquisition figure a fact rather than a claim.
- Website leads are not offerable. Only `PHONE`, `REFERRAL`, `EMAIL` and
  `OTHER` appear, because `LISTING_PAGE` and `AGENT_PROFILE` rows are written
  by the platform; typing one in would duplicate the record and start the
  response clock from when somebody got round to it. A logged offline lead
  starts `CONTACTED` with the SLA clock stopped, since the conversation has
  already happened. (Editing an existing lead keeps whatever source it has,
  so saving a note cannot silently rewrite where it came from.)
- Un-ticking a document on edit **clears its verification too**, and putting it
  back does not restore it — someone has to check it again. The `verified` flag
  is always recomputed from the documents, so the edit path and
  `toggleDocVerified` cannot disagree.

## Deleting shows its consequences first

Records reference each other by id, so a delete is never local. Rather than
forbidding it or corrupting the data silently, `deleteImpact()` counts what
else changes and the danger zone spells it out before a second, deliberate
click:

> 2 leads will no longer be linked to a property · 1 shoot will lose its
> property link · 1 thread pinned to it will be deleted

Every delete cascades in the same update — referencing ids are cleared and
pinned threads go with the record — so nothing is ever left pointing at
something that no longer exists. A **published** listing cannot be deleted at
all; it has to be paused first, because removing what the public site is
serving should not be one click inside an edit dialog.

## Daily logs pair writing with evidence

Each person files one entry per calendar day — what they did, what is blocking
them, what is next. Beside it the portal shows `dayActivity()`: properties
submitted, deals advanced, leads contacted, shoots prepped, counted from the
records for that same day.

That pairing is the whole design. A written log on its own measures how
diligently somebody reports. Read next to what the records hold, it becomes
reviewable — and where the two disagree, that gap is the conversation worth
having. A day with no recorded activity is not automatically a bad day;
meetings, calls and travel leave no trace in a database, which is exactly why
the written entry still matters.

Managers (`VIEW_ALL_LOGS` — MD/CEO and GM) get a team view for any day, showing
who has not filed and surfacing blockers first. Weekends are excluded from the
missed-day count.

## Staff are deactivated, never deleted

A staff id is stamped on every property, deal, lead, log and message that
person touched, so removing them would orphan all of it. Deactivating keeps the
history readable, and the org document's idea of a vacant position maps onto it
exactly. A deactivated position cannot be signed into and disappears from every
assignment dropdown — except on a record already assigned to them, so editing
it does not silently reassign the work (`assignableStaff`).

Revenue figures are held behind `VIEW_REVENUE`: naira targets read "hidden" and
deal values drop out of the pipeline board for roles without it, so the
scorecard is still readable without exposing the company's money to everyone
who can see a progress bar.

## Messages vs Threads

Two different things, deliberately kept apart:

- **Messages** — ordinary conversation. One all-staff group everybody belongs
  to, plus one-to-one with any colleague, created on demand. Unread counts are
  per person, from `lastReadAt`.
- **Threads** — discussion pinned to a specific property, deal, lead or shoot,
  so the reasoning survives next to the record it was about.

Every property row, deal card, lead and shoot carries a **Discuss** button
([`DiscussButton.tsx`](src/components/DiscussButton.tsx)) showing the count of
open threads on it. They all link to one URL shape,
`/threads?subject=KIND:ID` — the Threads screen filters to that record and
opens the composer already attached to it when nothing exists yet. One shape
means a Discuss button drops onto any future record screen with no new
plumbing.

Anything that changes a record's state belongs on that record's thread. Chatter
belongs in Messages.

## Threads are not a team chat

Deliberately. WhatsApp is better at chat and everyone is already there — keep
"where are you" in WhatsApp. What belongs here is the reasoning that has to stay
next to a record: why a listing was held, what was agreed on a mandate.
`Conversation` already carries an optional `listingId`, so this maps onto the
existing messaging tables.

One trap when wiring it up: `MessagesService.listConversations(userId)` returns
**every** conversation a user participates in, unfiltered. Without an
`isInternal` flag and a filter, staff threads will appear in the customer inbox.

## Two contradictions carried over from the org document

Both are surfaced in the UI rather than smoothed over, because the portal cannot
resolve them — people have to.

- **150–200 qualified leads/month at 25% conversion = 37–50 closed deals**,
  against a target of 8–12 mandates. Both cannot be true. Qualification is
  therefore one explicit shared flag: budget confirmed, timeline stated, and a
  specific property or service named. All three, or it is an enquiry.
- **Nobody owns platform operations.** Seven commercial positions, and none
  assigned to KYC review, user reports, feed moderation, escrow disputes, or
  withdrawals — which are a person manually transferring money out. The
  Operations screen shows the unassigned count on purpose.

## Look and feel

One hue per area of the business, defined once in
[`src/lib/accent.ts`](src/lib/accent.ts) and carried from the sidebar icon
through to the page header and its stat tiles:

| Hue | Area |
| --- | --- |
| Green | Inventory — properties, published listings |
| Gold | Money — deals, mandates, targets |
| Blue | Demand — leads, the team |
| Violet | Content — shoots, daily logs |
| Rose | Anything wrong — operations, unassigned work, overdue |
| Teal | Conversation — threads and messages |

Colour carries meaning rather than decoration: a screen is recognisable before
you read its title, and `tone` on a `Stat` always overrides the section hue so a
bad number reads red wherever it appears.

Avatars take a stable colour hashed from the staff id, so the same person is the
same colour in every list. Motion is short (~0.34s) and plays once per mount —
`.pl-rise` for entrances, `.pl-stagger` for grids — and everything collapses to
nothing under `prefers-reduced-motion`.

## Structure

```
src/
├── lib/
│   ├── types.ts          domain types; schema mirrors marked in comments
│   ├── accent.ts         the colour system — one hue per business area
│   ├── permissions.ts    per-position access (UI-only until the API catches up)
│   ├── store.tsx         StoreProvider; optimistic writes over the API
│   ├── storeContext.ts   context + useStore / useCurrentUser
│   ├── metrics.ts        every displayed number is derived here, never stored
│   └── format.ts         naira, dates, initials
├── api/
│   ├── dto.ts            what the API actually sends
│   ├── map.ts            wire shape → domain shape; the only module knowing both
│   └── collections.ts    one module per collection, returning domain types
├── components/           Layout (permission-aware nav) + ui primitives
└── pages/                one file per screen
```

The seam held: wiring all twelve collections to the API changed `store.tsx` and
added `src/api/`, without touching a single screen. Where the API names things
differently — a property is a `listing`, a log's date is its `day`, threads are
keyed by user id rather than staff id — `map.ts` reconciles it, so no component
has to know.

## Deployment

Its own Netlify site on `team.propertyloop.ng`, separate from the public
website so a bad deploy here cannot take propertyloop.ng down. `netlify.toml`
carries the build settings, so nothing needs clicking in the Netlify UI:

| | |
|---|---|
| Build command | `npm run build` (`tsc -b && vite build` — typecheck included) |
| Publish directory | `dist` |
| Node | 20 |

`public/_redirects` sends every path to `index.html` with a 200 so React
Router owns the URL — without it a refresh on `/deals` is a Netlify 404.
`public/_headers` adds the security set plus `X-Robots-Tag: noindex, nofollow`:
the staff portal must not be findable in search.

`VITE_API_URL` comes from `.env.production` at build time. It is a public URL
and is baked into the bundle — never put a secret in a `VITE_` variable.

Two things to know before the first deploy:

- **CORS.** The backend allowlists `team.propertyloop.ng`. A deploy preview
  runs on a `*.netlify.app` origin that is not on that list, so sign-in there
  fails until the origin is added to `CORS_EXTRA_ORIGINS` on the API.
- **The refresh cookie is cross-site.** The portal and the API sit on different
  domains, so the session depends on `SameSite=None; Secure` — which only works
  over HTTPS. Netlify serves HTTPS everywhere, so this holds in production, but
  it is why the portal cannot be tested against a plain-HTTP backend.
