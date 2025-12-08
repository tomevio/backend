<div align="center">
  <h1>Tomevio Backend</h1>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/tomevio/.github/refs/heads/main/assets/logo-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/tomevio/.github/refs/heads/main/assets/logo-light.svg">
    <img alt="Tomevio Backend: The Express engine for your literary journey"
         src="https://raw.githubusercontent.com/tomevio/.github/refs/heads/main/assets/logo-light.svg"
         width="50%">
  </picture>
  <p>High-performance backend for tracking, discovering, and organizing books</p>
</div>

Tomevio Backend is the ExpressJS implementation of the Tomevio backend API. It provides routes for searching books and authors, fetching metadata, and user authentication using Firebase JWTs. The backend interfaces with OpenLibrary for book data.

## Highlights

- One-to-one behavioral mapping from the Axum implementation
- Routes for search, book and author metadata backed by OpenLibrary
- Firebase JWT-based authentication (login/profile)
- Minimal dependencies for easy deployment

## Quick Start

Prerequisites:
- Node.js 18+ (or compatible)
- npm

Create and run:

```bash
git clone https://github.com/tomevio/backend.git
cd backend
npm install
npm start
```

The server will print something like:
`Server running on http://localhost:8080`

## License
Tomevio Backend is open-source software released under the [MIT License](LICENSE).

## Maintainer
### Sanjith
- [GitHub](https://github.com/s4nj1th) | [Twitter](https://x.com/s4nj1th) | [Email](mailto:sanjith.develops@gmail.com)
