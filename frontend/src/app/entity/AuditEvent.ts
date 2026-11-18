export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'CSV_IMPORT';

export type AuditSource = 'UI' | 'CSV_IMPORT';

export interface AuditActor {
  userId: number;
  login: string;
  role: string;
}

export interface AuditEvent {
  eventId: string;
  timestamp: string;
  action: AuditAction;
  source: AuditSource;
  actor: AuditActor;
  isuId: number;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

export interface AuditPageResponse {
  items: AuditEvent[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AuditFilter {
  page?: number;
  pageSize?: number;
  action?: string;
  isuId?: number;
  actorLogin?: string;
}
