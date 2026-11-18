import { CsvSkippedRowError } from './RealtimeEvents';

export type { CsvSkippedRowError };

export type CsvJobStatus = 'IDLE' | 'UPLOADING' | 'COMPLETED' | 'FAILED';

export interface CsvImportResponse {
  totalRows: number;
  saved: number;
  updated: number;
  failed: number;
  errors: string[];
}

export interface CsvJobResult {
  status: 'COMPLETED' | 'FAILED';
  total: number;
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  errors: CsvSkippedRowError[];
}
