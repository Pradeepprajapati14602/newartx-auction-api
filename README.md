NewArtX Auction Bidding API

Assignment ID: v#hdf38%44

A REST API for placing bids on auctions, built with Node.js, TypeScript, Express, and RethinkDB.

Requirements

Node.js 22

Docker and Docker Compose v2

Run with Docker

cp .env.example .env
docker compose up --build -d
docker compose ps

Check the API logs:

docker compose logs -f api

Stop the services:

docker compose down

Auction data is stored in a named Docker volume. Running docker compose down -v also deletes that volume and its data.

Configuration

The API uses the following environment variables:

PORT — API port; defaults to 3000.

RETHINKDB_HOST — Database host; defaults to localhost. Docker Compose sets it to rethinkdb inside the API container.

RETHINKDB_PORT — RethinkDB driver port; defaults to 28015.

RETHINKDB_DB — Database name; defaults to auction.

For local development without Docker, start RethinkDB separately, copy .env.example to .env, set RETHINKDB_HOST=localhost, and run:

npm install
npm run dev

API

POST /bid

Places a bid on an auction.

Request body:

{
  "auction_id": "sample-auction-001",
  "user_id": "user-42",
  "amount": 750,
  "idempotency_key": "optional-client-generated-uuid"
}

auction_id, user_id, and amount are required. amount must be a positive, finite number. idempotency_key is optional.

Successful response — 201 Created:

{
  "success": true,
  "bid_id": "a1b2c3d4-...",
  "current_bid": 750,
  "current_bidder_id": "user-42"
}

A repeated request with the same idempotency key and payload may return the original outcome when the existing bid is found. Reusing a key with a different payload returns a conflict.

Common error responses:

400 — Invalid request.

404 — Auction not found.

409 — Auction closed, auction ended, or idempotency key conflict.

422 — Bid is not higher than the current bid.

500 — Unexpected server error.

GET /health

Returns the API health status:

{
  "status": "ok"
}

Data Model

The auctions table stores each auction's status, starting price, closing time, current highest bid, and current highest bidder. The bids table stores accepted bid records and their timestamps.

The auction record is the source of truth for the current highest bid. Keeping bid history separately avoids growing an embedded list inside an auction record.

Bidding Rules

A bid is accepted only if it is strictly higher than the current bid.

The current highest bidder can bid again, but only with a higher amount.

A bid is rejected when the auction is closed or the server evaluates it at or after ends_at.

Requests with an idempotency key are checked for duplicates according to the key and payload.

The auction update uses a conditional database update to prevent concurrent requests from overwriting a newer highest bid.

Tests

The tests use a running RethinkDB instance and isolated test auction records.

Run the tests:

npm test
npm run test:coverage

Make sure the test database configuration points to a local, disposable database before running tests. Do not run test cleanup against production data.

Limitations

RethinkDB does not provide a multi-document transaction across the auction and bid-history tables. The service attempts to handle bid-history write failures, but a process or network failure at the wrong point can still leave the two records inconsistent.

A production implementation would need a stronger recovery mechanism, such as a durable event log or an outbox-based design.

Submission

Include the source code, package.json, package-lock.json, Docker files, .env.example, and this README. Include tests if required by the evaluator.

Do not commit .env, credentials, production data, or generated dependency/build directories.

The required package.json entry is:

"addition": 1