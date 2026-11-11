export type ReportType = 'financial' | 'attendance' | 'incident' | 'impact' | 'other';

export type ReportStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

export interface Report {
  id: string;
  title: string;
  type: ReportType;
  event_id?: string | null;
  event_title: string;
  period_start?: string | null;
  period_end?: string | null;
  summary: string;
  metrics: Record<string, unknown>;
  status: ReportStatus;
  created_by: string;
  created_by_name: string;
  submitted_at?: string | null;
  reviewed_by?: string | null;
  reviewed_by_name?: string;
  reviewed_at?: string | null;
  review_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ReportQuery {
  q?: string;
  type?: ReportType | '';
  status?: ReportStatus | '';
  eventId?: string;
  mine?: boolean;
  page?: number;
  pageSize?: number;
}

export interface ReportPayload {
  title: string;
  type: ReportType;
  event_id?: string | null;
  event_title: string;
  period_start?: string | null;
  period_end?: string | null;
  summary: string;
  metrics?: Record<string, unknown>;
}

export interface ReviewReportRequest {
  decision: 'approved' | 'rejected';
  notes: string;
}

export const REPORT_TYPE_LABEL: Record<ReportType, string> = {
  financial: 'Keuangan',
  attendance: 'Kehadiran',
  incident: 'Insiden',
  impact: 'Dampak',
  other: 'Lainnya',
};

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  draft: 'Draf',
  submitted: 'Menunggu tinjauan',
  approved: 'Disetujui',
  rejected: 'Ditolak',
};

export const REPORT_TYPES: ReportType[] = [
  'financial',
  'attendance',
  'incident',
  'impact',
  'other',
];

export const REPORT_STATUSES: ReportStatus[] = ['draft', 'submitted', 'approved', 'rejected'];
