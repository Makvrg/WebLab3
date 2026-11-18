import { Student } from './Student';

export type WebRtcConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export type StudentActionType = 'CREATE' | 'UPDATE' | 'DELETE' | 'CSV_IMPORT';

export interface RealtimeActor {
  userId: number;
  login: string;
  role: string;
}

export interface StudentRealtimeEvent {
  type: 'STUDENT_EVENT';
  eventId: string;
  timestamp: string;
  action: StudentActionType;
  source: 'UI' | 'CSV_IMPORT';
  actor: RealtimeActor;
  isuId: number;
  before?: Record<string, unknown> | Partial<Student> | null;
  after?: Record<string, unknown> | Partial<Student> | null;
}

export interface CsvSkippedRowError {
  row: number;
  isuId?: number | string | null;
  reason: string;
}

export interface CsvProgressEvent {
  type: 'CSV_PROGRESS';
  userId: number;
  jobId: string;
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  total: number;
  processed: number;
  created: number;
  skipped: number;
  errors: CsvSkippedRowError[];
}
