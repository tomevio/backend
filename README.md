<div align="center">
  <h1>Tomevio Backend</h1>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/tomevioDark.svg">
    <source media="(prefers-color-scheme: light)" srcset="assets/tomevioLight.svg">
    <img alt="Tomevio Backend: The Rust-powered engine for your literary journey"
         src="assets/tomevioLight.svg"
         width="50%">
  </picture>
  <p>High-performance backend for tracking, discovering, and organizing books</p>
</div>

Tomevio Backend is the Express/Node.js port of the original Rust + Axum service.  
It exposes the same behavior and endpoints as the Axum version, while providing a familiar Node/Express structure that integrates with OpenLibrary and (optionally) PostgreSQL.

## Highlights

- One-to-one behavioral mapping from the Axum implementation
- Routes for search, book and author metadata backed by OpenLibrary
- Simple JWT-based authentication endpoint to match original behavior
- Minimal dependencies for easy deployment

## Quick Start

Prerequisites:
- Node.js 18+ (or compatible)
- npm

Create and run:

```bash
cd tomevio-backend/tomevio-backend-express
npm install
npm start
```

The server will print something like:
`Server running on http://localhost:8080`

## Project layout

```
tomevio-backend-express/
  .env
  package.json
  src/
    index.js                 # App entry — wires routes and starts Express
    controller/
      auth.js                # /login and /profile handlers (JWT)
    routes/
      search.js              # GET /search?q=...
      book.js                # GET /book/:id (edition vs work handling)
      author.js              # GET /author/:id
    db/
    model/
      auth.js                # (placeholder) models related to auth
```

Key files:
- `src/index.js` — application entry and route registration
- `src/controller/auth.js` — login and profile verification (JWT)
- `src/routes/search.js` — OpenLibrary search aggregation
- `src/routes/book.js` — book detail lookup (edition vs work)
- `src/routes/author.js` — author profile and works
- `src/db/pool.js` — optional Postgres pool (`pg`), reads `DATABASE_URL`

## Configuration

Copy or edit `.env` at the project root. Important variables:

- `SERVER_ADDR` — e.g. `127.0.0.1:8080`. The app parses the port portion; default port is `8080`.
- `JWT_SECRET` — secret for signing/verifying tokens (default in example: `secret_key`)
- `DATABASE_URL` — Postgres connection string (optional)

Files reading env:
- `src/index.js`
- `src/controller/auth.js`
- `src/db/pool.js` (if you enable PostgreSQL usage)

## Endpoints

- `GET /`  
  Returns a small health string (Hello, World!).

- `GET /search?q=<term>`  
  Searches OpenLibrary for books and authors. Implementation: `src/routes/search.js`.

- `GET /book/:id`  
  Fetches a book by edition id (e.g. `OLXXXM`) or work id. Edition vs work branch matches the Rust logic. Implementation: `src/routes/book.js`.

- `GET /author/:id`  
  Returns author profile, bio, alternate names, works and lifespan. Implementation: `src/routes/author.js`.

- `POST /login`  
  Body `{ username, passwd }`. Hard-coded validation to mirror Rust:
  - success when `username === "admin"` and `passwd === "password"`, returns `{ token }`.
  Implementation: `src/controller/auth.js`.

- `GET /profile`  
  Expects header `Authorization: Bearer <token>`. Verifies token and returns a simple confirmation. Implementation: `src/controller/auth.js`.

## Auth behavior

Auth mirrors the original:
- Login uses a hard-coded credential check.
- Token: JWT signed with `JWT_SECRET`, `expiresIn: '24h'`.
- `GET /profile` validates the bearer token using the same secret.

See `src/controller/auth.js`.

## License
Tomevio Backend is open-source software released under the [MIT License](LICENSE).

## Maintainer
### Sanjith
- [GitHub](https://github.com/s4nj1th) | [Twitter](https://x.com/s4nj1th) | [Email](mailto:sanjith.develops@gmail.com)
