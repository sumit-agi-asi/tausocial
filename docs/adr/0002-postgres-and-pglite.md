# ADR 0002: PostgreSQL, with PGlite for local dev and tests
Status: accepted. Azure Database for PostgreSQL is the system of record. The `Db` interface has a `pg` and a PGlite (embedded Postgres) implementation so integration tests run against real Postgres semantics without Docker. The design sketch mentions NoSQL/graph/Redis; relational tables cover current needs and can be split later (Q9).
