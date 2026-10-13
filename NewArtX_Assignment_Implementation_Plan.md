# NewArtX Take-Home Assignment — 2-Hour AI Execution Plan

Assignment ID: `v#hdf38%44`

## Goal

Complete the smallest correct, runnable backend for the auction assignment within two hours. Use an AI coding agent (such as Cursor) to implement and test the project in the repository.

**Execution instruction:** Work autonomously from the assignment and this plan. Do not pause for routine clarification or ask the user to approve every step. Inspect the repository first, make reasonable choices consistent with the requirements, run the available checks, and report only blockers that genuinely prevent progress. Do not claim tests passed unless they were actually run.

**Code/comment style:** Keep code clean and self-explanatory. Avoid redundant comments, generic explanations, AI-related comments, and any statement in code or README about code being AI-generated. Add comments only where they explain a non-obvious decision. Do not fabricate results, test output, or implementation guarantees.

**Assignment integrity:** The assignment specifically asks that the required written design answers reflect the candidate's own thinking. The coding agent may prepare factual notes and a structure, but the candidate should review and express those explanations in their own words before submitting.

## 1. Stack

- Node.js 22
- TypeScript
- Express.js
- RethinkDB (required by the assignment)
- Jest + Supertest
- Docker + Docker Compose
- npm, Git, GitHub

Do not build a frontend, add authentication, or spend time on deployment, rate limiting, or infrastructure work; these are outside the stated scope.

## 2. Two-Hour Timebox

1. **0–15 minutes — Setup:** inspect the repository, set up Express/TypeScript, dependencies, Docker Compose, and required `package.json` field `"addition": 1`.
2. **15–35 minutes — Database:** configure RethinkDB, create `auctions` and `bids` tables, add a small reproducible seed example.
3. **35–75 minutes — Endpoint:** implement `POST /bid`, validation, closing-time rule, strictly-higher rule, current top-bid state, and predictable duplicate handling.
4. **75–100 minutes — Tests:** run API and database tests for success, invalid/lower/equal bid, closed auction, duplicate retry, and competing bids.
5. **100–120 minutes — Submission:** fix failures, verify Docker startup, write concise README, check assignment ID, and push to GitHub if credentials/access are available.

Prioritize a truthful, working implementation over a long feature list. If a feature cannot be made safe within the timebox, document the limitation accurately rather than pretending it is solved.

## 3. Required Endpoint

`POST /bid`

Required request fields:

```json
{
  "auction_id": "auction-123",
  "user_id": "user-456",
  "amount": 1200
}
```

An optional `idempotency_key` can be added if implemented consistently. Do not make it mandatory unless the README and API contract explain that choice.

### Rules

- Reject missing or invalid fields and non-positive/non-finite amounts.
- Reject unknown auctions.
- Accept a bid only when its amount is strictly greater than the current top bid.
- Treat the auction record as the canonical source for current highest amount and bidder.
- A bid is eligible only when the server evaluates it before `ends_at`; at `now >= ends_at`, reject it.
- A current highest bidder may place a new, strictly higher bid; equal or lower bids are rejected.
- Handle repeat requests predictably. If idempotency is implemented, the same key and same payload should return the original outcome, and the same key with a different payload should return a conflict.
- Handle competing bids without allowing stale reads to overwrite a newer highest bid.

## 4. Minimal Data Model

### `auctions`

- `id`
- `title` (optional)
- `status` (`active` / `closed`)
- `starting_price`
- `current_bid`
- `current_bidder_id`
- `ends_at` (UTC timestamp)
- `created_at`
- `updated_at`

### `bids`

- `id`
- `auction_id`
- `user_id`
- `amount`
- `created_at` (server timestamp)
- `idempotency_key` (optional)

The auction record stores the current top-bid state; the bids table stores bid history.

## 5. Concurrency and Consistency — Do Not Fake This

Do not assume RethinkDB offers relational-style multi-document transactions. Inspect the installed RethinkDB driver/version and use only guarantees it actually supports.

An in-memory per-auction lock can serialize requests inside a single Node.js process, but it does **not** protect multiple API replicas. Use a guarded/compare-and-update approach with conflict handling where supported, and ensure accepted bid history and the auction's top-bid state remain consistent. If multiple writes can partially succeed, implement a recovery strategy or document the limitation.

Add an integration test that submits competing bids and verifies the final top bid and accepted bid history. If the implementation cannot guarantee cross-process safety, state that limitation honestly in the README. Do not describe the system as fully concurrency-safe unless the implementation and tests support that claim.

## 6. Docker

Create:

- `Dockerfile`
- `docker-compose.yml` with `api` and `rethinkdb` services
- `.dockerignore`
- `.env.example`
- Database readiness/retry handling

Inside the API container, connect to the database through the Compose service name, e.g. `rethinkdb:28015`, not `localhost`.

Typical commands:

```bash
docker compose up --build -d
docker compose ps
docker compose logs -f api
docker compose down
```

Use a named volume for database persistence. Do not commit secrets or `.env`.

Warning: `docker compose down -v` deletes the Compose-managed database volume and its local data. Do not run it unless intentionally resetting local data.

## 7. Suggested Structure

Keep the project small; adapt to an existing starter repository rather than replacing it unnecessarily.

```text
src/
  app.ts
  server.ts
  routes/bid.routes.ts
  controllers/bid.controller.ts
  services/bid.service.ts
  db/rethinkdb.ts
  validators/bid.schema.ts
tests/
  bid.test.ts
Dockerfile
docker-compose.yml
.dockerignore
.env.example
package.json
README.md
```

Use a separate repository layer only if it improves clarity without consuming the timebox.

## 8. Minimal Test Checklist

- [ ] A valid higher bid is accepted.
- [ ] Lower and equal bids are rejected.
- [ ] Invalid/missing request fields are rejected.
- [ ] Unknown auction is rejected.
- [ ] Bid at or after `ends_at` is rejected.
- [ ] Current top bidder can raise their bid, but cannot repeat/lower it.
- [ ] Duplicate retry is handled predictably if idempotency is implemented.
- [ ] Simultaneous bids do not leave an incorrect current top bid.
- [ ] Auction state and accepted bid history are consistent.
- [ ] API and database start through Docker Compose.

Run tests and report the actual result. If Docker is unavailable, run what can be run and clearly state what remains unverified.

## 9. README and Submission

The README should contain:

- Prerequisites and Docker startup commands
- Environment variables from `.env.example`
- `POST /bid` request and response examples
- How to run tests
- Data model and design decisions
- Auction-close boundary policy
- Duplicate-request and same-highest-bidder policies
- Concurrency strategy and any real limitations
- Assignment ID: `v#hdf38%44`

Also include the required `package.json` key-value pair:

```json
"addition": 1
```

Push the repository to GitHub. If private, grant collaborator access to `thealphaversion`, as requested in the assignment. Do not claim a push or collaborator invitation succeeded unless it actually did.

## 10. Final Verification

Before finishing, confirm:

- [ ] `POST /bid` works against RethinkDB.
- [ ] `"addition": 1` is present in `package.json`.
- [ ] Docker Compose configuration is valid and starts the services.
- [ ] Tests have been run and their actual outcome is recorded.
- [ ] README contains `v#hdf38%44`.
- [ ] No unnecessary AI-related comments or generic boilerplate were added.
- [ ] No unsupported claims about concurrency safety or test success appear.
- [ ] The candidate has reviewed the design answers and rewritten them in their own words as required by the assignment.
