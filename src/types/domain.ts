export type CaLevel = "FOUNDATION" | "INTERMEDIATE" | "FINAL";

export interface StudentProfile {
  userId: string;
  fullName: string;
  email: string;
  caLevel: CaLevel;
  examAttemptId: string;
  examAttemptLabel?: string;
  city?: string;
  preferredSubjects: string[];
  studentCode?: string;
}

export type EvaluationStatus = "queued" | "processing" | "completed" | "failed";

export interface EvaluationSummary {
  id: string;
  subject: string;
  status: EvaluationStatus;
  createdAt: string;
  marksObtained?: number;
  maximumMarks?: number;
  resultUrl?: string;
  checkedCopyUrl?: string;
}
