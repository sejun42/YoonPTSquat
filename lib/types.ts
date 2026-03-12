export type MovementType = "bodyweight_squat";
export type ViewType = "front" | "side" | "rear";
export type SessionStatus =
  | "draft"
  | "analyzed"
  | "tests_added"
  | "report_ready"
  | "shared";
export type AnalysisQuality = "good" | "fair" | "poor";
export type FindingCategory = "observation" | "hypothesis";
export type SeverityLevel = "low" | "medium" | "high";
export type ConfidenceLevel = "low" | "medium" | "high";
export type RecommendedTestStatus = "recommended" | "skipped" | "completed";
export type TestSide = "left" | "right" | "bilateral" | "none";

export interface User {
  id: string;
  email: string;
  createdAt: string;
}

export interface Client {
  id: string;
  trainerId: string;
  name: string;
  phoneOrIdentifier?: string;
  memo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinalSummary {
  observationSummary: string;
  testSummary: string;
  coachOpinion: string;
  nextSessionFocus: string;
  memberFriendlySummary: string;
  trainerNote: string;
}

export interface AssessmentSession {
  id: string;
  trainerId: string;
  clientId: string;
  movementType: MovementType;
  selectedView: ViewType;
  status: SessionStatus;
  recordedAt: string;
  overallSummary: string;
  trainerNote: string;
  analysisVersion: string;
  summaryDraftJson: FinalSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface MetricSeriesPoint {
  rep: number;
  depth: number;
  symmetry: number;
  torsoLean: number;
  hipShift: number;
}

export interface AnalysisMetrics {
  brightness: number;
  validFrameRatio: number;
  depthPeak: number;
  heelLiftPeak: number;
  toeAngleDelta: number;
  maxTorsoLean: number;
  lateralTiltPeak: number;
  avgHipShift: number;
  avgKneeValgusLeft: number;
  avgKneeValgusRight: number;
  lateRepInstabilityDelta: number;
  rhythmVariation: number;
  warnings: string[];
  rawFrameCount: number;
  analyzedFrameCount: number;
  repSeries: MetricSeriesPoint[];
}

export interface RawLandmarkSummary {
  sampledFrames: number;
  validFrames: number;
  timestamps: number[];
}

export interface VideoAnalysisResult {
  id: string;
  assessmentSessionId: string;
  sourceView: ViewType;
  repCountEstimate: number;
  analysisQuality: AnalysisQuality;
  metricsJson: AnalysisMetrics;
  rawLandmarkSummaryJson: RawLandmarkSummary;
  createdAt: string;
}

export interface Finding {
  id: string;
  assessmentSessionId: string;
  code: string;
  labelKo: string;
  category: FindingCategory;
  severity: SeverityLevel;
  confidence: ConfidenceLevel;
  descriptionKo: string;
  rationaleKo: string;
  sourceView: ViewType;
  isHiddenByTrainer: boolean;
  createdAt: string;
}

export interface RecommendedTest {
  id: string;
  assessmentSessionId: string;
  sourceView: ViewType | null;
  testCode: string;
  testNameKo: string;
  priorityOrder: number;
  reasonKo: string;
  status: RecommendedTestStatus;
  createdAt: string;
}

export interface TestResult {
  id: string;
  assessmentSessionId: string;
  testCode: string;
  testNameKo: string;
  side: TestSide;
  resultLabel: string;
  resultValueJson: Record<string, string | number | boolean | null>;
  memo: string;
  performed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReportSnapshot {
  publishedAt: string;
  trainerEmail: string;
  client: Pick<Client, "id" | "name" | "phoneOrIdentifier">;
  session: Pick<
    AssessmentSession,
    "id" | "movementType" | "selectedView" | "recordedAt" | "status"
  > & {
    analyzedViews: ViewType[];
  };
  analyses: VideoAnalysisResult[];
  findings: Finding[];
  recommendedTests: RecommendedTest[];
  testResults: TestResult[];
  summary: FinalSummary;
}

export interface Report {
  id: string;
  assessmentSessionId: string;
  shareToken: string;
  isActive: boolean;
  expiresAt: string | null;
  reportSnapshotJson: ReportSnapshot;
  createdAt: string;
  updatedAt: string;
}

export interface SessionDetail {
  session: AssessmentSession;
  client: Client;
  analyses: VideoAnalysisResult[];
  findings: Finding[];
  recommendedTests: RecommendedTest[];
  testResults: TestResult[];
  reports: Report[];
}

export interface DashboardSessionCard {
  session: AssessmentSession;
  clientName: string;
  visibleFindingLabels: string[];
  hasActiveReport: boolean;
}

export interface DashboardData {
  clients: Client[];
  recentSessions: DashboardSessionCard[];
  recentReports: Array<{
    report: Report;
    clientName: string;
  }>;
  stats: {
    totalClients: number;
    totalSessions: number;
    sharedReports: number;
    lastRecordedAt: string | null;
  };
}

export interface TestTemplate {
  code: string;
  nameKo: string;
  sideMode: "perSide" | "bilateral";
  options: string[];
  recommendedReason: string;
}

export interface SessionDraftPayload {
  findings?: Finding[];
  recommendedTests?: RecommendedTest[];
  testResults?: TestResult[];
  summaryDraft?: FinalSummary;
  analyses?: VideoAnalysisResult[];
}
