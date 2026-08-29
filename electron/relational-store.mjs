export const RELATIONAL_COLLECTION_KEYS = Object.freeze({
  accounts: 'elite-erp-accounts-v9',
  journals: 'elite-erp-journals-v6',
  paymentVouchers: 'elite-erp-vouchers-v1',
  receiptVouchers: 'elite-erp-receiptvouchers-v1',
  costCenters: 'elite-erp-costcenters-v6',
  currencies: 'elite-erp-currencies-v1',
  cashBoxes: 'elite-erp-cashboxes-v1',
  bankAccounts: 'elite-erp-bankaccounts-v1',
  employees: 'elite-erp-employees-v1',
  customers: 'elite-erp-customers-v1',
  vendors: 'elite-erp-vendors-v1',
  auditLogs: 'elite-erp-auditlogs-v6',
});

const COLLECTION_NAMES = new Map(Object.entries(RELATIONAL_COLLECTION_KEYS).map(([name, key]) => [key, name]));

const text = value => value === undefined || value === null ? null : String(value);
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const bool = value => value ? 1 : 0;
const json = value => JSON.stringify(value ?? null);
const payload = value => {
  try { return JSON.parse(String(value)); } catch { return {}; }
};

function parseRows(value, key) {
  const parsed = JSON.parse(String(value));
  if (!Array.isArray(parsed)) throw new TypeError(`Relational collection ${key} must be a JSON array`);
  return parsed;
}

export function createRelationalStore(db) {
  function ensureSchema() {
    db.exec(`
      CREATE TABLE IF NOT EXISTS erp_accounts (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL,
        name_ar TEXT NOT NULL,
        name_en TEXT NOT NULL DEFAULT '',
        level INTEGER NOT NULL,
        account_type TEXT NOT NULL,
        report_type TEXT NOT NULL,
        parent_id TEXT,
        nature TEXT NOT NULL,
        category TEXT NOT NULL,
        sub_ledger_type TEXT NOT NULL DEFAULT 'NONE',
        default_currency TEXT NOT NULL,
        opening_balance REAL NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        payload_json TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_erp_accounts_code ON erp_accounts(code);
      CREATE INDEX IF NOT EXISTS idx_erp_accounts_parent ON erp_accounts(parent_id);
      CREATE INDEX IF NOT EXISTS idx_erp_accounts_report ON erp_accounts(report_type, nature, is_active);

      CREATE TABLE IF NOT EXISTS erp_cost_centers (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name_ar TEXT NOT NULL,
        parent_id TEXT REFERENCES erp_cost_centers(id) ON DELETE RESTRICT,
        payload_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS erp_currencies (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name_ar TEXT NOT NULL,
        decimals INTEGER NOT NULL CHECK(decimals BETWEEN 0 AND 8),
        is_base INTEGER NOT NULL DEFAULT 0 CHECK(is_base IN (0,1)),
        is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
        payload_json TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_erp_one_base_currency ON erp_currencies(is_base) WHERE is_base=1;
      CREATE TABLE IF NOT EXISTS erp_master_entities (
        entity_type TEXT NOT NULL,
        id TEXT NOT NULL,
        code TEXT NOT NULL,
        name_ar TEXT NOT NULL,
        normalized_name TEXT NOT NULL,
        linked_account_id TEXT REFERENCES erp_accounts(id) ON DELETE RESTRICT,
        is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
        payload_json TEXT NOT NULL,
        PRIMARY KEY(entity_type,id),
        UNIQUE(entity_type,code)
      );
      CREATE INDEX IF NOT EXISTS idx_erp_master_entities_duplicate ON erp_master_entities(entity_type,normalized_name);

      CREATE TABLE IF NOT EXISTS erp_account_currencies (
        account_id TEXT NOT NULL REFERENCES erp_accounts(id) ON DELETE CASCADE,
        currency_id TEXT NOT NULL,
        currency_code TEXT NOT NULL,
        is_default INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        PRIMARY KEY(account_id, currency_id)
      );
      CREATE INDEX IF NOT EXISTS idx_erp_account_currencies_code ON erp_account_currencies(currency_code, is_active);

      CREATE TABLE IF NOT EXISTS erp_journal_entries (
        id TEXT PRIMARY KEY,
        entry_number TEXT NOT NULL,
        entry_date TEXT NOT NULL,
        reference TEXT,
        narration TEXT NOT NULL DEFAULT '',
        total_debit REAL NOT NULL DEFAULT 0,
        total_credit REAL NOT NULL DEFAULT 0,
        currency TEXT NOT NULL,
        exchange_rate REAL NOT NULL DEFAULT 1,
        status TEXT NOT NULL,
        document_type TEXT,
        source_type TEXT,
        reference_code TEXT,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        posted_by TEXT,
        posted_at TEXT,
        payload_json TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_erp_journals_number ON erp_journal_entries(entry_number);
      CREATE INDEX IF NOT EXISTS idx_erp_journals_date_status ON erp_journal_entries(entry_date, status);
      CREATE INDEX IF NOT EXISTS idx_erp_journals_source ON erp_journal_entries(source_type, reference_code);

      CREATE TABLE IF NOT EXISTS erp_journal_lines (
        id TEXT PRIMARY KEY,
        journal_id TEXT NOT NULL REFERENCES erp_journal_entries(id) ON DELETE CASCADE,
        line_index INTEGER NOT NULL,
        account_id TEXT NOT NULL,
        account_code TEXT NOT NULL,
        account_name_ar TEXT NOT NULL,
        debit REAL NOT NULL DEFAULT 0,
        credit REAL NOT NULL DEFAULT 0,
        description TEXT NOT NULL DEFAULT '',
        cost_center_id TEXT,
        sub_ledger_type TEXT,
        sub_ledger_id TEXT,
        sub_ledger_name TEXT,
        currency TEXT,
        exchange_rate REAL NOT NULL DEFAULT 1,
        debit_foreign REAL NOT NULL DEFAULT 0,
        credit_foreign REAL NOT NULL DEFAULT 0,
        reference_number TEXT,
        payload_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_erp_journal_lines_journal ON erp_journal_lines(journal_id, line_index);
      CREATE INDEX IF NOT EXISTS idx_erp_journal_lines_account ON erp_journal_lines(account_id);
      CREATE INDEX IF NOT EXISTS idx_erp_journal_lines_subledger ON erp_journal_lines(sub_ledger_type, sub_ledger_id);
      CREATE INDEX IF NOT EXISTS idx_erp_journal_lines_costcenter ON erp_journal_lines(cost_center_id);

      CREATE TABLE IF NOT EXISTS erp_payment_vouchers (
        id TEXT PRIMARY KEY,
        voucher_number TEXT NOT NULL,
        voucher_date TEXT NOT NULL,
        payment_method TEXT NOT NULL,
        source_type TEXT NOT NULL,
        source_entity_id TEXT,
        source_account_id TEXT NOT NULL,
        payee_name TEXT NOT NULL,
        reference_number TEXT,
        narration TEXT NOT NULL DEFAULT '',
        currency TEXT NOT NULL,
        exchange_rate REAL NOT NULL DEFAULT 1,
        subtotal_amount REAL NOT NULL DEFAULT 0,
        total_amount REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL,
        journal_entry_id TEXT,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        posted_by TEXT,
        posted_at TEXT,
        payload_json TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_erp_payment_number ON erp_payment_vouchers(voucher_number);
      CREATE INDEX IF NOT EXISTS idx_erp_payment_date_status ON erp_payment_vouchers(voucher_date, status);
      CREATE INDEX IF NOT EXISTS idx_erp_payment_journal ON erp_payment_vouchers(journal_entry_id);

      CREATE TABLE IF NOT EXISTS erp_payment_voucher_lines (
        id TEXT PRIMARY KEY,
        voucher_id TEXT NOT NULL REFERENCES erp_payment_vouchers(id) ON DELETE CASCADE,
        line_index INTEGER NOT NULL,
        account_id TEXT NOT NULL,
        account_code TEXT NOT NULL,
        amount REAL NOT NULL DEFAULT 0,
        total_amount REAL NOT NULL DEFAULT 0,
        local_amount REAL NOT NULL DEFAULT 0,
        currency TEXT,
        exchange_rate REAL NOT NULL DEFAULT 1,
        cost_center_id TEXT,
        sub_ledger_type TEXT,
        sub_ledger_id TEXT,
        reference_number TEXT,
        description TEXT NOT NULL DEFAULT '',
        payload_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_erp_payment_lines_voucher ON erp_payment_voucher_lines(voucher_id, line_index);
      CREATE INDEX IF NOT EXISTS idx_erp_payment_lines_account ON erp_payment_voucher_lines(account_id);

      CREATE TABLE IF NOT EXISTS erp_receipt_vouchers (
        id TEXT PRIMARY KEY,
        receipt_number TEXT NOT NULL,
        receipt_date TEXT NOT NULL,
        receipt_method TEXT NOT NULL,
        source_type TEXT NOT NULL,
        source_entity_id TEXT,
        source_account_id TEXT NOT NULL,
        payer_name TEXT NOT NULL,
        reference_number TEXT,
        narration TEXT NOT NULL DEFAULT '',
        currency TEXT NOT NULL,
        exchange_rate REAL NOT NULL DEFAULT 1,
        subtotal_amount REAL NOT NULL DEFAULT 0,
        total_amount REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL,
        journal_entry_id TEXT,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        posted_by TEXT,
        posted_at TEXT,
        payload_json TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_erp_receipt_number ON erp_receipt_vouchers(receipt_number);
      CREATE INDEX IF NOT EXISTS idx_erp_receipt_date_status ON erp_receipt_vouchers(receipt_date, status);
      CREATE INDEX IF NOT EXISTS idx_erp_receipt_journal ON erp_receipt_vouchers(journal_entry_id);

      CREATE TABLE IF NOT EXISTS erp_receipt_voucher_lines (
        id TEXT PRIMARY KEY,
        voucher_id TEXT NOT NULL REFERENCES erp_receipt_vouchers(id) ON DELETE CASCADE,
        line_index INTEGER NOT NULL,
        account_id TEXT NOT NULL,
        account_code TEXT NOT NULL,
        amount REAL NOT NULL DEFAULT 0,
        total_amount REAL NOT NULL DEFAULT 0,
        local_amount REAL NOT NULL DEFAULT 0,
        currency TEXT,
        exchange_rate REAL NOT NULL DEFAULT 1,
        cost_center_id TEXT,
        sub_ledger_type TEXT,
        sub_ledger_id TEXT,
        reference_number TEXT,
        description TEXT NOT NULL DEFAULT '',
        payload_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_erp_receipt_lines_voucher ON erp_receipt_voucher_lines(voucher_id, line_index);
      CREATE INDEX IF NOT EXISTS idx_erp_receipt_lines_account ON erp_receipt_voucher_lines(account_id);

      CREATE TRIGGER IF NOT EXISTS trg_journal_line_account_insert
      BEFORE INSERT ON erp_journal_lines WHEN NOT EXISTS (SELECT 1 FROM erp_accounts WHERE id=NEW.account_id)
      BEGIN SELECT RAISE(ABORT, 'journal line account does not exist'); END;
      CREATE TRIGGER IF NOT EXISTS trg_journal_line_account_update
      BEFORE UPDATE OF account_id ON erp_journal_lines WHEN NOT EXISTS (SELECT 1 FROM erp_accounts WHERE id=NEW.account_id)
      BEGIN SELECT RAISE(ABORT, 'journal line account does not exist'); END;
      CREATE TRIGGER IF NOT EXISTS trg_account_referenced_delete
      BEFORE DELETE ON erp_accounts WHEN
        EXISTS (SELECT 1 FROM erp_journal_lines WHERE account_id=OLD.id) OR
        EXISTS (SELECT 1 FROM erp_payment_vouchers WHERE source_account_id=OLD.id) OR
        EXISTS (SELECT 1 FROM erp_payment_voucher_lines WHERE account_id=OLD.id) OR
        EXISTS (SELECT 1 FROM erp_receipt_vouchers WHERE source_account_id=OLD.id) OR
        EXISTS (SELECT 1 FROM erp_receipt_voucher_lines WHERE account_id=OLD.id) OR
        EXISTS (SELECT 1 FROM erp_master_entities WHERE linked_account_id=OLD.id)
      BEGIN SELECT RAISE(ABORT, 'referenced account cannot be deleted'); END;
      CREATE TRIGGER IF NOT EXISTS trg_payment_source_account_insert
      BEFORE INSERT ON erp_payment_vouchers WHEN NOT EXISTS (SELECT 1 FROM erp_accounts WHERE id=NEW.source_account_id)
      BEGIN SELECT RAISE(ABORT, 'payment source account does not exist'); END;
      CREATE TRIGGER IF NOT EXISTS trg_payment_line_account_insert
      BEFORE INSERT ON erp_payment_voucher_lines WHEN NOT EXISTS (SELECT 1 FROM erp_accounts WHERE id=NEW.account_id)
      BEGIN SELECT RAISE(ABORT, 'payment line account does not exist'); END;
      CREATE TRIGGER IF NOT EXISTS trg_receipt_source_account_insert
      BEFORE INSERT ON erp_receipt_vouchers WHEN NOT EXISTS (SELECT 1 FROM erp_accounts WHERE id=NEW.source_account_id)
      BEGIN SELECT RAISE(ABORT, 'receipt source account does not exist'); END;
      CREATE TRIGGER IF NOT EXISTS trg_receipt_line_account_insert
      BEFORE INSERT ON erp_receipt_voucher_lines WHEN NOT EXISTS (SELECT 1 FROM erp_accounts WHERE id=NEW.account_id)
      BEGIN SELECT RAISE(ABORT, 'receipt line account does not exist'); END;

      CREATE TABLE IF NOT EXISTS relational_projection_status (
        collection_key TEXT PRIMARY KEY,
        record_count INTEGER NOT NULL DEFAULT 0,
        last_synced_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS erp_audit_events (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        user_id TEXT NOT NULL,
        user_name TEXT NOT NULL,
        user_role TEXT NOT NULL,
        module TEXT NOT NULL,
        action TEXT NOT NULL,
        details TEXT NOT NULL,
        ip_address TEXT NOT NULL,
        before_json TEXT,
        after_json TEXT,
        payload_json TEXT NOT NULL
      );
      CREATE TRIGGER IF NOT EXISTS trg_audit_events_no_update BEFORE UPDATE ON erp_audit_events BEGIN SELECT RAISE(ABORT, 'audit events are append-only'); END;
      CREATE TRIGGER IF NOT EXISTS trg_audit_events_no_delete BEFORE DELETE ON erp_audit_events BEGIN SELECT RAISE(ABORT, 'audit events are append-only'); END;
    `);
    for (const column of ['before_json', 'after_json']) {
      try { db.exec(`ALTER TABLE erp_audit_events ADD COLUMN ${column} TEXT`); } catch {}
    }
  }

  ensureSchema();

  const projectionStatus = db.prepare(`
    INSERT INTO relational_projection_status(collection_key, record_count, last_synced_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(collection_key) DO UPDATE SET record_count=excluded.record_count, last_synced_at=datetime('now')
  `);

  const insertAccount = db.prepare(`INSERT INTO erp_accounts
    (id,code,name_ar,name_en,level,account_type,report_type,parent_id,nature,category,sub_ledger_type,default_currency,opening_balance,is_active,payload_json)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET code=excluded.code,name_ar=excluded.name_ar,name_en=excluded.name_en,level=excluded.level,account_type=excluded.account_type,report_type=excluded.report_type,parent_id=excluded.parent_id,nature=excluded.nature,category=excluded.category,sub_ledger_type=excluded.sub_ledger_type,default_currency=excluded.default_currency,opening_balance=excluded.opening_balance,is_active=excluded.is_active,payload_json=excluded.payload_json`);
  const insertAccountCurrency = db.prepare(`INSERT INTO erp_account_currencies
    (account_id,currency_id,currency_code,is_default,is_active) VALUES (?,?,?,?,?)`);
  const insertJournal = db.prepare(`INSERT INTO erp_journal_entries
    (id,entry_number,entry_date,reference,narration,total_debit,total_credit,currency,exchange_rate,status,document_type,source_type,reference_code,created_by,created_at,posted_by,posted_at,payload_json)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insertJournalLine = db.prepare(`INSERT INTO erp_journal_lines
    (id,journal_id,line_index,account_id,account_code,account_name_ar,debit,credit,description,cost_center_id,sub_ledger_type,sub_ledger_id,sub_ledger_name,currency,exchange_rate,debit_foreign,credit_foreign,reference_number,payload_json)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insertPayment = db.prepare(`INSERT INTO erp_payment_vouchers
    (id,voucher_number,voucher_date,payment_method,source_type,source_entity_id,source_account_id,payee_name,reference_number,narration,currency,exchange_rate,subtotal_amount,total_amount,status,journal_entry_id,created_by,created_at,posted_by,posted_at,payload_json)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insertPaymentLine = db.prepare(`INSERT INTO erp_payment_voucher_lines
    (id,voucher_id,line_index,account_id,account_code,amount,total_amount,local_amount,currency,exchange_rate,cost_center_id,sub_ledger_type,sub_ledger_id,reference_number,description,payload_json)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insertReceipt = db.prepare(`INSERT INTO erp_receipt_vouchers
    (id,receipt_number,receipt_date,receipt_method,source_type,source_entity_id,source_account_id,payer_name,reference_number,narration,currency,exchange_rate,subtotal_amount,total_amount,status,journal_entry_id,created_by,created_at,posted_by,posted_at,payload_json)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insertReceiptLine = db.prepare(`INSERT INTO erp_receipt_voucher_lines
    (id,voucher_id,line_index,account_id,account_code,amount,total_amount,local_amount,currency,exchange_rate,cost_center_id,sub_ledger_type,sub_ledger_id,reference_number,description,payload_json)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insertCostCenter = db.prepare(`INSERT INTO erp_cost_centers(id,code,name_ar,parent_id,payload_json) VALUES (?,?,?,?,?)`);
  const insertCurrency = db.prepare(`INSERT INTO erp_currencies(id,code,name_ar,decimals,is_base,is_active,payload_json) VALUES (?,?,?,?,?,?,?)`);
  const insertEntity = db.prepare(`INSERT INTO erp_master_entities(entity_type,id,code,name_ar,normalized_name,linked_account_id,is_active,payload_json) VALUES (?,?,?,?,?,?,?,?)`);
  const insertAudit = db.prepare(`INSERT OR IGNORE INTO erp_audit_events(id,timestamp,user_id,user_name,user_role,module,action,details,ip_address,before_json,after_json,payload_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);

  function clearCollection(key) {
    const name = COLLECTION_NAMES.get(key);
    if (!name) return false;
    if (name === 'accounts') db.exec('DELETE FROM erp_accounts');
    if (name === 'journals') db.exec('DELETE FROM erp_journal_entries');
    if (name === 'paymentVouchers') db.exec('DELETE FROM erp_payment_vouchers');
    if (name === 'receiptVouchers') db.exec('DELETE FROM erp_receipt_vouchers');
    if (name === 'costCenters') db.exec('DELETE FROM erp_cost_centers');
    if (name === 'currencies') db.exec('DELETE FROM erp_currencies');
    if (['cashBoxes','bankAccounts','employees','customers','vendors'].includes(name)) db.prepare('DELETE FROM erp_master_entities WHERE entity_type=?').run(name);
    if (name === 'auditLogs') return true;
    projectionStatus.run(key, 0);
    return true;
  }

  function clearAll() {
    ['journals','paymentVouchers','receiptVouchers','cashBoxes','bankAccounts','employees','customers','vendors','costCenters','currencies','accounts'].forEach(name => clearCollection(RELATIONAL_COLLECTION_KEYS[name]));
  }

  function syncCollection(key, value) {
    const name = COLLECTION_NAMES.get(key);
    if (!name) return false;
    const rows = parseRows(value, key);
    if (name === 'auditLogs') {
      rows.slice().reverse().forEach(item => insertAudit.run(text(item.id), text(item.timestamp) ?? '', text(item.userId) ?? '', text(item.userName) ?? '', text(item.userRole) ?? '', text(item.module) ?? '', text(item.action) ?? '', text(item.details) ?? '', text(item.ipAddress) ?? '', text(item.beforeJson), text(item.afterJson), json(item)));
      projectionStatus.run(key, db.prepare('SELECT count(*) AS count FROM erp_audit_events').get().count);
      return true;
    }
    if (name !== 'accounts') clearCollection(key);

    if (name === 'accounts') {
      const incomingIds = [];
      rows.forEach(account => {
        incomingIds.push(text(account.id));
        insertAccount.run(
          text(account.id), text(account.code), text(account.nameAr) ?? '', text(account.nameEn) ?? '', number(account.level),
          text(account.accountType) ?? '', text(account.reportType) ?? '', text(account.parentId), text(account.nature) ?? '',
          text(account.category) ?? '', text(account.subLedgerType) ?? 'NONE', text(account.defaultCurrency) ?? '',
          number(account.openingBalance), bool(account.isActive), json(account),
        );
        db.prepare('DELETE FROM erp_account_currencies WHERE account_id=?').run(text(account.id));
        (Array.isArray(account.currencies) ? account.currencies : []).forEach(currency => {
          insertAccountCurrency.run(text(account.id), text(currency.id), text(currency.code) ?? '', bool(currency.isDefault), bool(currency.isActive));
        });
      });
      if (incomingIds.length) db.prepare(`DELETE FROM erp_accounts WHERE id NOT IN (${incomingIds.map(() => '?').join(',')})`).run(...incomingIds);
      else db.exec('DELETE FROM erp_accounts');
      projectionStatus.run(key, rows.length);
    }

    if (name === 'journals') {
      rows.forEach(journal => {
        insertJournal.run(
          text(journal.id), text(journal.entryNumber), text(journal.date), text(journal.reference), text(journal.narration) ?? '',
          number(journal.totalDebit), number(journal.totalCredit), text(journal.currency) ?? '', number(journal.exchangeRate || 1),
          text(journal.status) ?? '', text(journal.type), text(journal.sourceType), text(journal.referenceCode),
          text(journal.createdBy) ?? '', text(journal.createdAt) ?? '', text(journal.postedBy), text(journal.postedAt), json(journal),
        );
        (Array.isArray(journal.lines) ? journal.lines : []).forEach((line, index) => {
          insertJournalLine.run(
            text(line.id), text(journal.id), index, text(line.accountId), text(line.accountCode) ?? '', text(line.accountNameAr) ?? '',
            number(line.debit), number(line.credit), text(line.description) ?? '', text(line.costCenterId), text(line.subLedgerType),
            text(line.subLedgerId), text(line.subLedgerName), text(line.currency), number(line.exchangeRate || 1),
            number(line.debitForeign), number(line.creditForeign), text(line.referenceNumber), json(line),
          );
        });
      });
    }

    if (name === 'paymentVouchers') {
      rows.forEach(voucher => {
        insertPayment.run(
          text(voucher.id), text(voucher.voucherNumber), text(voucher.date), text(voucher.paymentMethod) ?? '', text(voucher.sourceType) ?? '',
          text(voucher.sourceEntityId), text(voucher.sourceAccountId), text(voucher.payeeName) ?? '', text(voucher.referenceNumber),
          text(voucher.narration) ?? '', text(voucher.currency) ?? '', number(voucher.exchangeRate || 1), number(voucher.subtotalAmount),
          number(voucher.totalAmount), text(voucher.status) ?? '', text(voucher.journalEntryId), text(voucher.createdBy) ?? '',
          text(voucher.createdAt) ?? '', text(voucher.postedBy), text(voucher.postedAt), json(voucher),
        );
        (Array.isArray(voucher.lines) ? voucher.lines : []).forEach((line, index) => {
          insertPaymentLine.run(
            text(line.id), text(voucher.id), index, text(line.accountId), text(line.accountCode) ?? '', number(line.amount),
            number(line.totalAmount), number(line.localAmount ?? line.totalAmount ?? line.amount), text(line.currency),
            number(line.exchangeRate || 1), text(line.costCenterId), text(line.subLedgerType), text(line.subLedgerId),
            text(line.referenceNumber), text(line.description) ?? '', json(line),
          );
        });
      });
    }

    if (name === 'receiptVouchers') {
      rows.forEach(voucher => {
        insertReceipt.run(
          text(voucher.id), text(voucher.receiptNumber), text(voucher.date), text(voucher.receiptMethod) ?? '', text(voucher.sourceType) ?? '',
          text(voucher.sourceEntityId), text(voucher.sourceAccountId), text(voucher.payerName) ?? '', text(voucher.referenceNumber),
          text(voucher.narration) ?? '', text(voucher.currency) ?? '', number(voucher.exchangeRate || 1), number(voucher.subtotalAmount),
          number(voucher.totalAmount), text(voucher.status) ?? '', text(voucher.journalEntryId), text(voucher.createdBy) ?? '',
          text(voucher.createdAt) ?? '', text(voucher.postedBy), text(voucher.postedAt), json(voucher),
        );
        (Array.isArray(voucher.lines) ? voucher.lines : []).forEach((line, index) => {
          insertReceiptLine.run(
            text(line.id), text(voucher.id), index, text(line.accountId), text(line.accountCode) ?? '', number(line.amount),
            number(line.totalAmount), number(line.localAmount ?? line.totalAmount ?? line.amount), text(line.currency),
            number(line.exchangeRate || 1), text(line.costCenterId), text(line.subLedgerType), text(line.subLedgerId),
            text(line.referenceNumber), text(line.description) ?? '', json(line),
          );
        });
      });
    }

    if (name === 'costCenters') rows.forEach(item => insertCostCenter.run(text(item.id), text(item.code), text(item.nameAr) ?? '', text(item.parentId), json(item)));
    if (name === 'currencies') rows.forEach(item => insertCurrency.run(text(item.id), text(item.code), text(item.nameAr) ?? '', number(item.decimals), bool(item.isBase), bool(item.isActive), json(item)));
    const entityTypes = new Set(['cashBoxes','bankAccounts','employees','customers','vendors']);
    if (entityTypes.has(name)) rows.forEach(item => {
      const displayName = item.nameAr ?? item.bankNameAr ?? '';
      const normalized = String(displayName).normalize('NFKC').trim().toLocaleLowerCase('ar');
      insertEntity.run(name, text(item.id), text(item.code), text(displayName) ?? '', normalized, text(item.linkedAccountId), bool(item.isActive), json(item));
    });

    projectionStatus.run(key, rows.length);
    return true;
  }

  function rebuildAll(entries) {
    clearAll();
    const values = entries instanceof Map ? entries : new Map(entries);
    Object.values(RELATIONAL_COLLECTION_KEYS).forEach(key => {
      const value = values.get(key);
      if (value !== undefined && value !== null) syncCollection(key, value);
    });
  }

  function info() {
    const scalar = sql => Number(db.prepare(sql).get()?.count ?? 0);
    const lastSyncedAt = db.prepare('SELECT max(last_synced_at) AS value FROM relational_projection_status').get()?.value ?? null;
    return {
      schemaVersion: 3,
      accounts: scalar('SELECT count(*) AS count FROM erp_accounts'),
      accountCurrencies: scalar('SELECT count(*) AS count FROM erp_account_currencies'),
      journals: scalar('SELECT count(*) AS count FROM erp_journal_entries'),
      journalLines: scalar('SELECT count(*) AS count FROM erp_journal_lines'),
      paymentVouchers: scalar('SELECT count(*) AS count FROM erp_payment_vouchers'),
      paymentVoucherLines: scalar('SELECT count(*) AS count FROM erp_payment_voucher_lines'),
      receiptVouchers: scalar('SELECT count(*) AS count FROM erp_receipt_vouchers'),
      receiptVoucherLines: scalar('SELECT count(*) AS count FROM erp_receipt_voucher_lines'),
      costCenters: scalar('SELECT count(*) AS count FROM erp_cost_centers'),
      currencies: scalar('SELECT count(*) AS count FROM erp_currencies'),
      masterEntities: scalar('SELECT count(*) AS count FROM erp_master_entities'),
      auditEvents: scalar('SELECT count(*) AS count FROM erp_audit_events'),
      lastSyncedAt,
    };
  }

  function readCollection(key) {
    const name = COLLECTION_NAMES.get(key);
    if (!name) return null;
    if (name === 'accounts') {
      const currenciesByAccount = new Map();
      db.prepare('SELECT * FROM erp_account_currencies ORDER BY account_id,currency_code').all().forEach(row => {
        const list = currenciesByAccount.get(row.account_id) || [];
        list.push({ id: row.currency_id, code: row.currency_code, isDefault: Boolean(row.is_default), isActive: Boolean(row.is_active) });
        currenciesByAccount.set(row.account_id, list);
      });
      return JSON.stringify(db.prepare('SELECT * FROM erp_accounts ORDER BY code').all().map(row => ({
        ...payload(row.payload_json), id: row.id, code: row.code, nameAr: row.name_ar, nameEn: row.name_en,
        level: row.level, accountType: Number(row.account_type), reportType: Number(row.report_type), parentId: row.parent_id ?? undefined,
        nature: row.nature, category: row.category, subLedgerType: row.sub_ledger_type, defaultCurrency: row.default_currency,
        openingBalance: row.opening_balance, isActive: Boolean(row.is_active), currencies: currenciesByAccount.get(row.id) || [],
      })));
    }
    if (name === 'journals') {
      const linesByJournal = new Map();
      db.prepare('SELECT * FROM erp_journal_lines ORDER BY journal_id,line_index').all().forEach(row => {
        const list = linesByJournal.get(row.journal_id) || [];
        list.push({ ...payload(row.payload_json), id: row.id, accountId: row.account_id, accountCode: row.account_code, accountNameAr: row.account_name_ar, debit: row.debit, credit: row.credit, description: row.description, costCenterId: row.cost_center_id ?? undefined, subLedgerType: row.sub_ledger_type ?? undefined, subLedgerId: row.sub_ledger_id ?? undefined, subLedgerName: row.sub_ledger_name ?? undefined, currency: row.currency ?? undefined, exchangeRate: row.exchange_rate, debitForeign: row.debit_foreign, creditForeign: row.credit_foreign, referenceNumber: row.reference_number ?? undefined });
        linesByJournal.set(row.journal_id, list);
      });
      return JSON.stringify(db.prepare('SELECT * FROM erp_journal_entries ORDER BY entry_date DESC,entry_number DESC').all().map(row => ({ ...payload(row.payload_json), id: row.id, entryNumber: row.entry_number, date: row.entry_date, reference: row.reference ?? '', narration: row.narration, totalDebit: row.total_debit, totalCredit: row.total_credit, currency: row.currency, exchangeRate: row.exchange_rate, status: row.status, type: row.document_type ?? undefined, sourceType: row.source_type ?? undefined, referenceCode: row.reference_code ?? undefined, createdBy: row.created_by, createdAt: row.created_at, postedBy: row.posted_by ?? undefined, postedAt: row.posted_at ?? undefined, lines: linesByJournal.get(row.id) || [] })));
    }
    const voucherCollection = (headerTable, lineTable, numberColumn, dateColumn, methodColumn, partyColumn, numberProperty, methodProperty, partyProperty) => {
      const linesByVoucher = new Map();
      db.prepare(`SELECT * FROM ${lineTable} ORDER BY voucher_id,line_index`).all().forEach(row => {
        const list = linesByVoucher.get(row.voucher_id) || [];
        list.push({ ...payload(row.payload_json), id: row.id, accountId: row.account_id, accountCode: row.account_code, amount: row.amount, totalAmount: row.total_amount, localAmount: row.local_amount, currency: row.currency ?? undefined, exchangeRate: row.exchange_rate, costCenterId: row.cost_center_id ?? undefined, subLedgerType: row.sub_ledger_type ?? undefined, subLedgerId: row.sub_ledger_id ?? undefined, referenceNumber: row.reference_number ?? undefined, description: row.description });
        linesByVoucher.set(row.voucher_id, list);
      });
      return db.prepare(`SELECT * FROM ${headerTable} ORDER BY ${dateColumn} DESC,${numberColumn} DESC`).all().map(row => ({ ...payload(row.payload_json), id: row.id, [numberProperty]: row[numberColumn], date: row[dateColumn], [methodProperty]: row[methodColumn], sourceType: row.source_type, sourceEntityId: row.source_entity_id ?? undefined, sourceAccountId: row.source_account_id, [partyProperty]: row[partyColumn], referenceNumber: row.reference_number ?? undefined, narration: row.narration, currency: row.currency, exchangeRate: row.exchange_rate, subtotalAmount: row.subtotal_amount, totalAmount: row.total_amount, status: row.status, journalEntryId: row.journal_entry_id ?? undefined, createdBy: row.created_by, createdAt: row.created_at, postedBy: row.posted_by ?? undefined, postedAt: row.posted_at ?? undefined, lines: linesByVoucher.get(row.id) || [] }));
    };
    if (name === 'paymentVouchers') return JSON.stringify(voucherCollection('erp_payment_vouchers','erp_payment_voucher_lines','voucher_number','voucher_date','payment_method','payee_name','voucherNumber','paymentMethod','payeeName'));
    if (name === 'receiptVouchers') return JSON.stringify(voucherCollection('erp_receipt_vouchers','erp_receipt_voucher_lines','receipt_number','receipt_date','receipt_method','payer_name','receiptNumber','receiptMethod','payerName'));
    if (name === 'costCenters') return JSON.stringify(db.prepare('SELECT payload_json FROM erp_cost_centers ORDER BY code').all().map(row => payload(row.payload_json)));
    if (name === 'currencies') return JSON.stringify(db.prepare('SELECT payload_json FROM erp_currencies ORDER BY code').all().map(row => payload(row.payload_json)));
    if (name === 'auditLogs') return JSON.stringify(db.prepare('SELECT payload_json FROM erp_audit_events ORDER BY timestamp DESC,id DESC').all().map(row => payload(row.payload_json)));
    if (['cashBoxes','bankAccounts','employees','customers','vendors'].includes(name)) return JSON.stringify(db.prepare('SELECT payload_json FROM erp_master_entities WHERE entity_type=? ORDER BY code').all(name).map(row => payload(row.payload_json)));
    return null;
  }

  function diagnostics() {
    const scalar = (sql, ...args) => Number(db.prepare(sql).get(...args)?.count ?? 0);
    const foreignKeyViolations = db.prepare('PRAGMA foreign_key_check').all().length;
    const orphanJournalLines = scalar('SELECT count(*) AS count FROM erp_journal_lines l LEFT JOIN erp_journal_entries h ON h.id=l.journal_id LEFT JOIN erp_accounts a ON a.id=l.account_id WHERE h.id IS NULL OR a.id IS NULL');
    const orphanPaymentLines = scalar('SELECT count(*) AS count FROM erp_payment_voucher_lines l LEFT JOIN erp_payment_vouchers h ON h.id=l.voucher_id LEFT JOIN erp_accounts a ON a.id=l.account_id WHERE h.id IS NULL OR a.id IS NULL');
    const orphanReceiptLines = scalar('SELECT count(*) AS count FROM erp_receipt_voucher_lines l LEFT JOIN erp_receipt_vouchers h ON h.id=l.voucher_id LEFT JOIN erp_accounts a ON a.id=l.account_id WHERE h.id IS NULL OR a.id IS NULL');
    const duplicateDocumentNumbers = scalar(`SELECT count(*) AS count FROM (SELECT entry_number FROM erp_journal_entries GROUP BY entry_number HAVING count(*)>1 UNION ALL SELECT voucher_number FROM erp_payment_vouchers GROUP BY voucher_number HAVING count(*)>1 UNION ALL SELECT receipt_number FROM erp_receipt_vouchers GROUP BY receipt_number HAVING count(*)>1)`);
    const unbalancedPostedJournals = scalar('SELECT count(*) AS count FROM erp_journal_entries WHERE status=\'POSTED\' AND abs(total_debit-total_credit)>0.005');
    const issues = foreignKeyViolations + orphanJournalLines + orphanPaymentLines + orphanReceiptLines + duplicateDocumentNumbers + unbalancedPostedJournals;
    return { ok: issues === 0, issues, foreignKeyViolations, orphanJournalLines, orphanPaymentLines, orphanReceiptLines, duplicateDocumentNumbers, unbalancedPostedJournals, auditEvents: scalar('SELECT count(*) AS count FROM erp_audit_events') };
  }

  return { ensureSchema, syncCollection, clearCollection, clearAll, rebuildAll, readCollection, diagnostics, info };
}
