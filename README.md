# UrlShortener

A basic URL shortener built with Node.js, Express, and PostgreSQL. Submit an original URL to create a short link, then visit that link to redirect to the original address.

This version is an API with no frontend. It stores links in one table and has no accounts, analytics, expiration, or custom codes.

## Requirements

- Node.js and npm (a supported Node.js LTS release)
- PostgreSQL running locally, or an accessible PostgreSQL server
- A database user that can create the table and insert and select rows

## Local setup

### 1. Install dependencies

From the project directory:

```bash
npm install
```

### 2. Configure the database connection

Create a `.env` file in the project root, replacing the sample credentials with your own:

```dotenv
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_USER=your_postgres_user
DB_PASSWORD=your_postgres_password
DB_DATABASE=url_shortener
```

The app loads this file through `dotenv`. `.env` is ignored by Git; keep actual credentials out of the README and source code.

### 3. Create the database and table

Connect with a PostgreSQL user allowed to create databases:

```bash
psql -h localhost -p 5432 -U your_postgres_user -d postgres
```

Run the following in `psql`. Skip database creation if it already exists, and skip table creation if you already created `links`.

```sql
CREATE DATABASE url_shortener;
\connect url_shortener

CREATE TABLE links (
    short_code VARCHAR(16) PRIMARY KEY,
    original_url TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT short_code_format
        CHECK (short_code ~ '^[A-Za-z0-9]{1,16}$'),

    CONSTRAINT original_url_not_blank
        CHECK (length(btrim(original_url)) > 0)
);
```

Use the same database name in `.env`. The app does not create the database or table automatically.

### 4. Start the app

```bash
npm run dev
```

The server runs at `http://localhost:4500`. A successful database startup check prints `Connected to PostgreSQL database`.

Both `npm run dev` and `npm start` currently use nodemon, which restarts the app when source files change. To run directly without nodemon, use `node index.js`.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/links` | Create a short link |
| GET | `/:shortCode` | Redirect to the stored original URL |
| GET | `/api` | Return `Hi there` to check that Express responds |

### Create a link

```bash
curl -i -X POST http://localhost:4500/api/links \
  -H 'Content-Type: application/json' \
  -d '{"original_url":"https://example.com/articles/hello"}'
```

Example response (`201 Created`; the code and timestamp will vary):

```json
{
  "short_code": "a1b2c3d4e5f6",
  "original_url": "https://example.com/articles/hello",
  "created_at": "2026-10-02T12:00:00.000Z",
  "short_url": "http://localhost:4500/a1b2c3d4e5f6"
}
```

`original_url` must be a nonblank string containing a valid URL with an `http://` or `https://` scheme. Surrounding whitespace is removed. Every successful request creates a new link, even if the same original URL was submitted previously.

### Visit a link

Open the returned `short_url` in a browser, or inspect the redirect headers:

```bash
# Replace this example code with one returned by your creation request.
curl -i http://localhost:4500/a1b2c3d4e5f6
```

An existing link returns `302 Found` with a `Location` header containing the original URL. A browser follows that redirect automatically; curl follows it when you add `-L`.

### Error responses

Errors from the controller use JSON such as `{"error":"Link not found"}`.

| Status | Meaning |
| --- | --- |
| 400 | Missing or invalid original URL |
| 404 | Unknown short code or a code with an invalid format |
| 500 | Database insert or lookup failed |
| 503 | Generated code already exists; submit the request again |

## How the pieces connect

```text
Create:   Client -> Express -> Router -> Controller -> PostgreSQL
Response: Client <- Express <- Controller <- Inserted row

Visit:    Browser -> Express -> Controller -> PostgreSQL lookup
          Browser <- 302 redirect with the original URL
          Browser -> Original website
```

| File | Responsibility |
| --- | --- |
| `index.js` | Create the Express app, parse JSON, mount routes, and listen on port 4500 |
| `route/link.js` | Map the creation request to `shortLink` |
| `controller/link.js` | Validate input, generate codes, insert links, look up links, and redirect |
| `db/db.js` | Load environment settings and export the PostgreSQL connection pool |

For creation, the controller converts six random bytes into a 12-character hexadecimal code. It inserts the code and original URL using SQL parameters (`$1`, `$2`), while PostgreSQL supplies `created_at`. The code fits the table's alphanumeric constraint and 16-character limit. The primary key prevents duplicate codes.

For a visit, the controller selects the original URL by its short code. The primary key gives PostgreSQL an index for that lookup. The server returns a redirect; the browser makes the next request to the destination website.

The connection pool manages reusable database connections. Calling `pool.query()` borrows a connection and returns it automatically after the query.

## Troubleshooting

- **`EAI_AGAIN` or `ENOTFOUND`:** Check the database hostname. For local PostgreSQL, use `DB_HOST=localhost`, spelled correctly.
- **`ECONNREFUSED`:** Check that PostgreSQL is running and listening on the host and port in `.env`.
- **Password authentication failed:** Check `DB_USER`, `DB_PASSWORD`, and the server's authentication settings.
- **Database does not exist:** Create the database named by `DB_DATABASE`.
- **Relation `links` does not exist:** Run the table creation SQL in the database the app connects to.

Restart the app after changing `.env`. The startup check logs database failures, but the HTTP server can still start; seeing `Server started` alone does not prove the database is connected.

## Production connection settings

When `NODE_ENV=production`, `db/db.js` uses `DATABASE_URL` instead of the individual `DB_*` settings:

```dotenv
NODE_ENV=production
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=verify-full
```

Use the connection string and TLS settings required by your database provider. The HTTP port remains 4500 in the current implementation. This README's short-link examples assume direct local access to Express.

## Testing

There is no automated test suite configured yet. `npm test` currently exits with a placeholder error. Use the curl examples above to check creation and redirects against your running database.
