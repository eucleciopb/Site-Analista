# Security Specification - Team Management

## Data Invariants
1. A connection test document must be readable by anyone (anonymous or authenticated) to verify system uptime.
2. Users can only read their own user profile or profiles they have permission for (currently allowing all signed-in users read access to `/usuarios/` for team visibility, but this should be hardened).
3. Access logs (`acessos`) are write-only for users; only admins can read.
4. Active agendas and performance records are readable by any authenticated user in the current setup, but should be restricted by identity in future.

## The Dirty Dozen Payloads (Rejection Targets)
1. Write to `/cds/connection-test` as any user.
2. Read from `/acessos/` as any user.
3. Create an access log with a spoofed `criadoEm` (not equal to `request.time`).
4. Create an access log with a non-string `usuario`.
5. Update a user profile without being signed in.
6. Delete a record from `/cds/`.
7. Write to `/agenda_dias/` with a 1MB string as ID.
8. Read PII from `/usuarios/` anonymously.
9. Bypass `isValidId` with special characters in the ID.
10. Shadow update a profile with a `isAdmin` field (not defined).
11. Create a record in `chamados` without being signed in.
12. List all `acessos` records.
