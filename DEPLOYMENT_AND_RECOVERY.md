# FULLERP Desktop deployment and recovery model

## Supported P0 deployment

- One Windows workstation may open one or more FULLERP windows against the same local SQLite database.
- The database directory must be on a local disk. UNC paths, mapped network shares, cloud-synchronised folders, and removable shared media are not supported database locations.
- SQLite uses WAL, foreign keys, a five-second busy timeout, `BEGIN IMMEDIATE` accounting commands, durable idempotency receipts, and optimistic collection versions. A stale window is reloaded instead of overwriting a newer committed version.

## Multi-user boundary

Direct file sharing is deliberately rejected because SQLite WAL does not provide a reliable disconnected multi-workstation model. A future multi-workstation deployment must use a single application service/database host and authenticated API; workstations must not open the `.sqlite` file directly.

## Backups and ownership

- The workstation owning the database also owns backup creation.
- Startup and clean shutdown create verified SQLite snapshots in `<data-root>/backups`.
- Seven verified rotating snapshots are retained by the app; every snapshot must pass `PRAGMA integrity_check` before it is accepted.
- Manual backup remains available through the desktop storage bridge and the Settings backup UI.

## Recovery

- Startup verifies the active database before opening it.
- If verification fails, FULLERP renames the damaged file and restores the newest verified snapshot.
- If no verified snapshot exists, startup records a fatal diagnostic instead of opening a partially valid ledger.
- Accounting writes are committed or rolled back as a unit; interrupted commands do not leave voucher, journal, and audit changes partially committed.
