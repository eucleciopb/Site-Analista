# Firestore Security Specification

## 1. Data Invariants
- **Chamados**: Must belong to the user who created it (`createdByUid`).
- **Agenda**: Users can only edit their own agenda (`uid`).
- **CDs**: Publicly readable, admin only write.
- **Acessos**: Append only (create only).

## 2. The "Dirty Dozen" Payloads (Red Team Test Cases)
1. **Identity Spoofing**: Attempt to create a chamado with `createdByUid` of another user. -> **PERMISSION_DENIED**
2. **Resource Poisoning**: Create a CD with a 2MB 'nome' field. -> **PERMISSION_DENIED**
3. **State Shortcutting**: Update a chamado's `status` to 'CONCLUIDO' without being the owner or admin. -> **PERMISSION_DENIED**
4. **Shadow Update**: Update an agenda doc with an extra `isVerified: true` field. -> **PERMISSION_DENIED**
5. **PII Leak**: Read the entire `usuarios` collection as a guest. -> **PERMISSION_DENIED**
6. **Orphaned Write**: Create a chamado referencing a non-existent CD. -> **PERMISSION_DENIED**
7. **Bypassing App Logic**: Try to delete an agenda entry of another user. -> **PERMISSION_DENIED**
8. **Denial of Wallet**: Deeply nested document ID in `agenda_dias`. -> **PERMISSION_DENIED**
9. **Role Escalation**: Add self to an `admins` collection (if it existed). -> **PERMISSION_DENIED**
10. **Timestamp Fraud**: Create a chamado with a `createdAt` in the past (client-provided). -> **PERMISSION_DENIED**
11. **Malicious Query**: List all chamados without filtering by `createdByUid`. -> **PERMISSION_DENIED**
12. **Metadata Tampering**: Change `updatedAt` to a static string instead of server timestamp. -> **PERMISSION_DENIED**

## 3. Implementation Plan
- Define `isSignedIn()` and `isValidId()`.
- Define entity validators for `Chamado`, `AgendaDia`, `CD`.
- Implement Master Gate pattern.
