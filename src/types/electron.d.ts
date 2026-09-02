export {};

declare global {
  interface Window {
    desktopStore?: {
      getItem(key: string): string | null;
      setItem(key: string, value: string): boolean;
      setItemVersioned(key: string, value: string, expectedVersion: number): { ok: boolean; version?: number; conflict?: boolean; expectedVersion?: number; actualVersion?: number; error?: string };
      removeItem(key: string): boolean;
      entries(): Array<[string, string]>;
      replaceEntries(entries: Array<[string, string]>, clearPrefixes?: string[]): {
        ok: boolean;
        restored: number;
        removed: number;
        integrity: string;
        total: number;
        error?: string;
      };
      info(): {
        databasePath: string;
        engine: 'SQLite';
        schemaVersion: number;
        entries: number;
        relational: {
          schemaVersion: number;
          accounts: number;
          accountCurrencies: number;
          journals: number;
          journalLines: number;
          paymentVouchers: number;
          paymentVoucherLines: number;
          receiptVouchers: number;
          receiptVoucherLines: number;
          costCenters: number;
          currencies: number;
          masterEntities: number;
          lastSyncedAt: string | null;
        };
        authority: 'RELATIONAL_SQLITE';
      };
      version(key: string): number;
      accountingCommand(payload: {
        idempotencyKey: string;
        commandType: string;
        documentType: string;
        documentNumber: string;
        changes: Array<{ key: string; value: string }>;
        expectedVersions?: Record<string, number>;
      }): {
        ok: boolean;
        replay?: boolean;
        conflict?: boolean;
        duplicate?: boolean;
        permissionDenied?: boolean;
        error?: string;
        key?: string;
        expectedVersion?: number;
        actualVersion?: number;
        versions?: Record<string, number>;
      };
      createBackup(): { ok: boolean; path?: string; integrity?: string; retained?: number; error?: string };
      login(username: string, password: string): { ok: boolean; token?: string; error?: string; user?: { username: string; name: string; roleId: string; mustChangePassword: boolean; expiresAt: string } };
      session(token: string): { ok: boolean; user?: { username: string; name: string; roleId: string; mustChangePassword: boolean; expiresAt: string } };
      logout(token: string): boolean;
      changePassword(token: string, currentPassword: string, nextPassword: string): { ok: boolean; error?: string };
      configureSecurity(options: { sessionTimeoutMinutes: number }): { ok: boolean; error?: string; sessionTimeoutMinutes?: number };
    };
    desktopPrint?: {
      preview(options: {
        landscape?: boolean;
        title?: string;
        html?: string;
        returnPdf?: boolean;
      }): Promise<{ opened: boolean; landscape: boolean; previewPath?: string; bytes?: Uint8Array }>;
    };
    desktopWindow?: {
      getUiScale(): { percent: number; zoomFactor: number };
      setUiScalePercent(percent: number): { ok: boolean; percent: number; zoomFactor: number };
    };
  }
}
