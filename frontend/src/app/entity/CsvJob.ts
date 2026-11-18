import { CsvSkippedRowError } from './RealtimeEvents';

export type { CsvSkippedRowError };

export type CsvJobStatus = 'IDLE' | 'UPLOADING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface CsvJobResult {
  jobId: string;
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  total: number;
  processed: number;
  created: number;
  skipped: number;
  errors: CsvSkippedRowError[];
}
