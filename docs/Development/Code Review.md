---
sidebar_position: 3
---

## Code Review

Code review is not about finding bugs. It's about **knowledge sharing, maintaining standards, and catching problems before production**. Done well, it raises the entire team's bar. Done poorly, it's a bottleneck that kills velocity.

* * *

Why Code Review Matters
========================

*   **Defect prevention** — bugs caught pre-merge cost 10x less than bugs caught post-deploy
*   **Knowledge sharing** — everyone understands more of the codebase
*   **Consistency** — enforces team standards and architecture decisions
*   **Mentoring** — junior devs grow faster with structured feedback
*   **Bus factor** — no code is owned by only one person

* * *

What to Look For
=================

A checklist for reviewers — in priority order.

### 1. Correctness

Does the code do what it's supposed to do?

```js
// Bug: off-by-one error
for (let i = 0; i <= arr.length; i++) { // should be < not <=
  process(arr[i]);
}

// Bug: async not awaited — error is swallowed
function saveOrder(order) {
  db.orders.insert(order); // missing await — caller gets no error
  return { success: true };
}

// Bug: race condition — two requests can create duplicate records
async function createUserIfNotExists(email) {
  const existing = await db.users.findOne({ email });
  if (!existing) {
    await db.users.create({ email }); // another request may have inserted between these two lines
  }
}
```

### 2. Security

Is the code introducing vulnerabilities?

```js
// SQL Injection — never interpolate user input
const query = `SELECT * FROM users WHERE id = ${req.params.id}`; // BAD
const query = 'SELECT * FROM users WHERE id = $1';                // GOOD

// XSS — never inject unsanitized HTML
element.innerHTML = userInput;           // BAD
element.textContent = userInput;         // GOOD

// Sensitive data in logs
logger.info('Processing payment', { card: req.body.cardNumber }); // BAD — PII in logs
logger.info('Processing payment', { userId: req.body.userId });   // GOOD

// Unvalidated redirect
res.redirect(req.query.returnUrl); // BAD — open redirect attack
```

### 3. Edge cases and error handling

What happens when things go wrong?

```js
// No null check
const city = user.address.city; // throws if address is null

// Swallowed error
try {
  await paymentService.charge(order);
} catch (e) {
  // silently fails — order marked complete but payment never taken
}

// No handling for empty array
const firstItem = items[0].price; // throws if items is empty
```

### 4. Performance

Will this scale?

```js
// N+1 query — 1 query for orders + 1 per order for user
const orders = await db.orders.findAll();
for (const order of orders) {
  order.user = await db.users.findById(order.userId); // N queries!
}

// Fix: eager load
const orders = await db.orders.findAll({ include: ['user'] });

// Unbounded query — returns all rows
const allLogs = await db.logs.findAll(); // could be millions of rows

// Fix: always paginate or limit
const logs = await db.logs.findAll({ limit: 100, offset });
```

### 5. Readability and naming

Is the intent clear?

```js
// Bad naming
const d = new Date();
const u = await getU(id);
function proc(x) { ... }

// Good naming
const createdAt = new Date();
const user = await getUserById(id);
function processPaymentRefund(payment) { ... }

// Magic numbers
if (status === 3) { ... }         // What is 3?
if (status === ORDER_STATUS.PAID) { ... } // Clear
```

### 6. Design and architecture

Is this the right abstraction?

*   Does this class have more than one responsibility?
*   Is this business logic leaking into the controller?
*   Is this duplicating code that already exists elsewhere?
*   Is this the right pattern for this problem?
*   Will this be testable?

### 7. Tests

Are tests adequate?

*   Does the PR include tests for new behavior?
*   Are edge cases and error paths tested?
*   Are tests actually testing behavior, not implementation?
*   Would a test catch a regression if this code changed?

* * *

How to Give Feedback
=====================

The **tone** of a code review matters as much as the content.

### Use prefixes to set expectations

```
[blocking] This will cause data loss if the DB transaction fails here.
           We need to wrap this in a transaction.

[suggestion] Consider extracting this into a separate function —
             it would make the logic easier to follow and test.

[nit] Minor: variable name could be more descriptive.
      `retryCount` is clearer than `n`.

[question] Why are we using a raw query here instead of the ORM?
           Is there a performance reason I'm missing?

[praise] Really clean approach here — much simpler than what we had before.
```

This tells the author immediately whether they must act or can use their judgment.

### Be specific, not vague

```
# Bad feedback — no actionable information
"This is messy."
"I don't like this approach."
"Needs improvement."

# Good feedback — specific, actionable, explains why
"[blocking] This function is doing 3 different things: validation,
transformation, and persistence. Split it into separate functions
so each can be tested independently and the flow is easier to follow."
```

### Suggest, don't dictate (for non-blocking)

```
# Dictating — creates friction
"Change this to use a Map."

# Suggesting — starts a conversation
"[suggestion] A Map might be cleaner here since we're doing frequent
lookups by key. What do you think?"
```

### Acknowledge good work

```
"[praise] Love that you added the retry logic here — that's exactly
the kind of defensive coding we should be doing for external calls."
```

A review that only has criticism is demoralizing. Call out what's done well.

* * *

PR Size — The Most Important Variable
=======================================

The single biggest factor in review quality is **PR size**.

| PR Size | Review Time | Defects Found |
|---|---|---|
| < 50 lines | ~10 min | High |
| 50–200 lines | ~30 min | Good |
| 200–400 lines | ~60 min | Moderate |
| > 400 lines | Rubber-stamped | Low |

Large PRs get rubber-stamped. Reviewers get fatigued and start skimming.

### Strategies for keeping PRs small

1. **Split by layer** — separate DB migration, service logic, API layer, tests
2. **Feature flags** — merge incomplete features hidden behind a flag
3. **Refactor first, then change** — two separate PRs: one that moves code (no behavior change), one that changes it
4. **Don't mix concerns** — a bug fix PR shouldn't also refactor unrelated code

```
# Bad — one giant PR
feat: add order cancellation (600 lines, 12 files changed)

# Good — split into logical units
refactor: extract order state machine into separate class
feat: add CANCELLED state to order state machine
feat: add POST /orders/:id/cancel endpoint
test: add cancellation flow integration tests
```

* * *

Review Turnaround Time
=======================

Reviews should be done **within 24 hours**, ideally within a few hours.

Waiting for review is the biggest waste in software development. A developer blocked waiting for review loses context, picks up other work, and then has to context-switch back.

**Team norms to enforce:**
- Reviews are first-priority work in the morning
- Use Slack/notification to request review — don't rely on email
- Authors can ping after 24h if no response
- Don't leave a PR open over a weekend without a comment

* * *

Responding to Review Feedback
===============================

As the PR author:

```
# For every comment — respond with one of:
✅ Done — I made the change
💬 Discussed — I pushed back with reasoning
🚫 Won't fix — explained why (with justification)
```

Don't just silently make changes. Acknowledge feedback. If you disagree:

```
"[disagree] I'd prefer to keep this as a single function for now since
splitting it would require significant refactoring of the tests. I've
added a comment explaining the three phases. Happy to refactor in a
follow-up if the team agrees it's worth it."
```

* * *

What NOT to review
===================

Don't argue about things that can be automated:

*   Formatting — let Prettier handle it
*   Import order — let ESLint handle it
*   Semicolons — let ESLint handle it

If you're leaving comments about formatting, set up a linter.

```json
// .eslintrc
{
  "extends": ["eslint:recommended"],
  "rules": {
    "no-console": "warn",
    "no-unused-vars": "error"
  }
}
```

```json
// .prettierrc
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5"
}
```

Automate the mechanical stuff so reviewers can focus on logic, design, and correctness.

* * *

Self-Review Checklist
======================

Before requesting a review, ask yourself:

```
□ Have I read my own diff top-to-bottom?
□ Does the PR description clearly explain what and why?
□ Are there any TODOs or debug logs left in the code?
□ Have I removed any commented-out code?
□ Does the code handle null, empty, and error cases?
□ Did I add or update tests?
□ Does this introduce any breaking changes?
□ Is there any sensitive data (keys, passwords) accidentally committed?
□ Does CI pass locally before pushing?
```

* * *

Code Review Anti-Patterns
==========================

| Anti-pattern | Problem | Fix |
|---|---|---|
| **Rubber-stamping** | LGTM without reading | Enforce minimum review time, block self-merge |
| **Bikeshedding** | Arguing about style, not logic | Automate style, have a style guide |
| **Holding hostage** | Blocking on opinions, not issues | Distinguish blocking vs suggestion |
| **Too large PRs** | Reviewers give up | Keep PRs under 400 lines |
| **Review bombing** | 50 comments on a single PR | Discuss major issues async first |
| **No context** | PR with no description | Require PR template |
| **Slow turnaround** | PRs wait 3+ days | Make reviews first-priority morning work |

* * *

Interview definition (short answer)
=====================================

> "Code review's primary purpose is knowledge sharing and catching design issues, not style enforcement (which should be automated). Effective reviews are timely, specific, categorized by severity, and focused on correctness, security, and design — not personal preference."
