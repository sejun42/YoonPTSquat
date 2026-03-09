import "server-only";

import { nanoid } from "nanoid";
import { notFound } from "next/navigation";

import { ANALYSIS_VERSION, TEST_TEMPLATE_MAP } from "@/lib/constants";
import { createSummaryDraft, buildReportSnapshot } from "@/lib/report/compose";
import { ensureTrainerProfile } from "@/lib/supabase/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  AssessmentSession,
  Client,
  DashboardData,
  Finding,
  RecommendedTest,
  Report,
  SessionDetail,
  SessionDraftPayload,
  TestResult,
  VideoAnalysisResult,
  ViewType,
} from "@/lib/types";
import { sortByDateDesc } from "@/lib/utils";

type SessionStatus = AssessmentSession["status"];

interface ClientRow {
  id: string;
  trainer_id: string;
  name: string;
  phone_or_identifier: string | null;
  memo: string | null;
  created_at: string;
  updated_at: string;
}

interface SessionRow {
  id: string;
  trainer_id: string;
  client_id: string;
  movement_type: AssessmentSession["movementType"];
  selected_view: ViewType;
  status: SessionStatus;
  recorded_at: string;
  overall_summary: string;
  trainer_note: string;
  analysis_version: string;
  summary_draft_json: AssessmentSession["summaryDraftJson"];
  created_at: string;
  updated_at: string;
}

interface VideoAnalysisRow {
  id: string;
  assessment_session_id: string;
  rep_count_estimate: number;
  analysis_quality: VideoAnalysisResult["analysisQuality"];
  metrics_json: VideoAnalysisResult["metricsJson"];
  raw_landmark_summary_json: VideoAnalysisResult["rawLandmarkSummaryJson"];
  created_at: string;
}

interface FindingRow {
  id: string;
  assessment_session_id: string;
  code: string;
  label_ko: string;
  category: Finding["category"];
  severity: Finding["severity"];
  confidence: Finding["confidence"];
  description_ko: string;
  rationale_ko: string;
  source_view: ViewType;
  is_hidden_by_trainer: boolean;
  created_at: string;
}

interface RecommendedTestRow {
  id: string;
  assessment_session_id: string;
  test_code: string;
  test_name_ko: string;
  priority_order: number;
  reason_ko: string;
  status: RecommendedTest["status"];
  created_at: string;
}

interface TestResultRow {
  id: string;
  assessment_session_id: string;
  test_code: string;
  test_name_ko: string;
  side: TestResult["side"];
  result_label: string;
  result_value_json: TestResult["resultValueJson"];
  memo: string;
  performed: boolean;
  created_at: string;
  updated_at: string;
}

interface ReportRow {
  id: string;
  assessment_session_id: string;
  share_token: string;
  is_active: boolean;
  expires_at: string | null;
  report_snapshot_json: Report["reportSnapshotJson"];
  created_at: string;
  updated_at: string;
}

function now() {
  return new Date().toISOString();
}

async function requireSupabase() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
  return supabase;
}

function unwrap<T>(result: { data: T | null; error: { message: string } | null }) {
  if (result.error) {
    throw new Error(result.error.message);
  }
  return result.data;
}

function toClient(row: ClientRow): Client {
  return {
    id: row.id,
    trainerId: row.trainer_id,
    name: row.name,
    phoneOrIdentifier: row.phone_or_identifier ?? "",
    memo: row.memo ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toSession(row: SessionRow): AssessmentSession {
  return {
    id: row.id,
    trainerId: row.trainer_id,
    clientId: row.client_id,
    movementType: row.movement_type,
    selectedView: row.selected_view,
    status: row.status,
    recordedAt: row.recorded_at,
    overallSummary: row.overall_summary,
    trainerNote: row.trainer_note,
    analysisVersion: row.analysis_version,
    summaryDraftJson: row.summary_draft_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toAnalysis(row: VideoAnalysisRow): VideoAnalysisResult {
  return {
    id: row.id,
    assessmentSessionId: row.assessment_session_id,
    repCountEstimate: row.rep_count_estimate,
    analysisQuality: row.analysis_quality,
    metricsJson: row.metrics_json,
    rawLandmarkSummaryJson: row.raw_landmark_summary_json,
    createdAt: row.created_at,
  };
}

function toFinding(row: FindingRow): Finding {
  return {
    id: row.id,
    assessmentSessionId: row.assessment_session_id,
    code: row.code,
    labelKo: row.label_ko,
    category: row.category,
    severity: row.severity,
    confidence: row.confidence,
    descriptionKo: row.description_ko,
    rationaleKo: row.rationale_ko,
    sourceView: row.source_view,
    isHiddenByTrainer: row.is_hidden_by_trainer,
    createdAt: row.created_at,
  };
}

function toRecommendedTest(row: RecommendedTestRow): RecommendedTest {
  return {
    id: row.id,
    assessmentSessionId: row.assessment_session_id,
    testCode: row.test_code,
    testNameKo: row.test_name_ko,
    priorityOrder: row.priority_order,
    reasonKo: row.reason_ko,
    status: row.status,
    createdAt: row.created_at,
  };
}

function toTestResult(row: TestResultRow): TestResult {
  return {
    id: row.id,
    assessmentSessionId: row.assessment_session_id,
    testCode: row.test_code,
    testNameKo: row.test_name_ko,
    side: row.side,
    resultLabel: row.result_label,
    resultValueJson: row.result_value_json,
    memo: row.memo,
    performed: row.performed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toReport(row: ReportRow): Report {
  return {
    id: row.id,
    assessmentSessionId: row.assessment_session_id,
    shareToken: row.share_token,
    isActive: row.is_active,
    expiresAt: row.expires_at,
    reportSnapshotJson: row.report_snapshot_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function serializeAnalysis(analysis: VideoAnalysisResult) {
  return {
    id: analysis.id,
    assessment_session_id: analysis.assessmentSessionId,
    rep_count_estimate: analysis.repCountEstimate,
    analysis_quality: analysis.analysisQuality,
    metrics_json: analysis.metricsJson,
    raw_landmark_summary_json: analysis.rawLandmarkSummaryJson,
    created_at: analysis.createdAt,
  };
}

function serializeFinding(finding: Finding) {
  return {
    id: finding.id,
    assessment_session_id: finding.assessmentSessionId,
    code: finding.code,
    label_ko: finding.labelKo,
    category: finding.category,
    severity: finding.severity,
    confidence: finding.confidence,
    description_ko: finding.descriptionKo,
    rationale_ko: finding.rationaleKo,
    source_view: finding.sourceView,
    is_hidden_by_trainer: finding.isHiddenByTrainer,
    created_at: finding.createdAt,
  };
}

function serializeRecommendedTest(test: RecommendedTest) {
  return {
    id: test.id,
    assessment_session_id: test.assessmentSessionId,
    test_code: test.testCode,
    test_name_ko: test.testNameKo,
    priority_order: test.priorityOrder,
    reason_ko: test.reasonKo,
    status: test.status,
    created_at: test.createdAt,
  };
}

function serializeTestResult(result: TestResult) {
  return {
    id: result.id,
    assessment_session_id: result.assessmentSessionId,
    test_code: result.testCode,
    test_name_ko: result.testNameKo,
    side: result.side,
    result_label: result.resultLabel,
    result_value_json: result.resultValueJson,
    memo: result.memo,
    performed: result.performed,
    created_at: result.createdAt,
    updated_at: result.updatedAt,
  };
}

function deriveSessionStatus(detail: SessionDetail): SessionStatus {
  const hasAnalysis = Boolean(detail.analysis);
  const hasTests = detail.testResults.some((test) => test.performed);
  const hasSummary = Boolean(
    detail.session.summaryDraftJson &&
      Object.values(detail.session.summaryDraftJson).some((value) => value.trim().length > 0),
  );
  const hasActiveReport = detail.reports.some((report) => report.isActive);

  if (hasActiveReport) {
    return "shared";
  }
  if (hasSummary) {
    return "report_ready";
  }
  if (hasTests) {
    return "tests_added";
  }
  if (hasAnalysis) {
    return "analyzed";
  }
  return "draft";
}

function syncRecommendedTestStatus(
  recommendedTests: RecommendedTest[],
  testResults: TestResult[],
) {
  return recommendedTests.map((test) => ({
    ...test,
    status: testResults.some(
      (result) => result.testCode === test.testCode && result.performed,
    )
      ? ("completed" as const)
      : test.status,
  }));
}

async function loadSessionDetail(trainerId: string, sessionId: string) {
  const supabase = await requireSupabase();
  const sessionRow = unwrap(
    await supabase
      .from("assessment_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("trainer_id", trainerId)
      .maybeSingle(),
  ) as SessionRow | null;

  if (!sessionRow) {
    notFound();
  }

  const clientRow = unwrap(
    await supabase
      .from("clients")
      .select("*")
      .eq("id", sessionRow.client_id)
      .eq("trainer_id", trainerId)
      .maybeSingle(),
  ) as ClientRow | null;

  if (!clientRow) {
    notFound();
  }

  const [analysisRows, findingRows, recommendedRows, resultRows, reportRows] = await Promise.all([
    supabase
      .from("video_analysis_results")
      .select("*")
      .eq("assessment_session_id", sessionId)
      .order("created_at", { ascending: false }),
    supabase
      .from("findings")
      .select("*")
      .eq("assessment_session_id", sessionId)
      .order("created_at", { ascending: true }),
    supabase
      .from("recommended_tests")
      .select("*")
      .eq("assessment_session_id", sessionId)
      .order("priority_order", { ascending: true }),
    supabase
      .from("test_results")
      .select("*")
      .eq("assessment_session_id", sessionId)
      .order("created_at", { ascending: true }),
    supabase
      .from("reports")
      .select("*")
      .eq("assessment_session_id", sessionId)
      .order("created_at", { ascending: false }),
  ]);

  return {
    session: toSession(sessionRow),
    client: toClient(clientRow),
    analysis: ((unwrap(analysisRows) as VideoAnalysisRow[])[0]
      ? toAnalysis((unwrap(analysisRows) as VideoAnalysisRow[])[0])
      : null),
    findings: (unwrap(findingRows) as FindingRow[]).map(toFinding),
    recommendedTests: (unwrap(recommendedRows) as RecommendedTestRow[]).map(toRecommendedTest),
    testResults: (unwrap(resultRows) as TestResultRow[]).map(toTestResult),
    reports: (unwrap(reportRows) as ReportRow[]).map(toReport),
  } satisfies SessionDetail;
}

export async function upsertTrainer(email: string) {
  void email;
  const supabase = await requireSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id || !user.email) {
    throw new Error("Authenticated Supabase user is required.");
  }

  const profile = await ensureTrainerProfile(user.id, user.email, supabase);
  if (!profile) {
    throw new Error("Failed to create trainer profile.");
  }
  return profile;
}

export async function createClient(
  trainerId: string,
  input: Pick<Client, "name" | "phoneOrIdentifier" | "memo">,
) {
  const supabase = await requireSupabase();
  const timestamp = now();
  const row = unwrap(
    await supabase
      .from("clients")
      .insert({
        id: crypto.randomUUID(),
        trainer_id: trainerId,
        name: input.name.trim(),
        phone_or_identifier: input.phoneOrIdentifier?.trim() || null,
        memo: input.memo?.trim() || null,
        created_at: timestamp,
        updated_at: timestamp,
      })
      .select("*")
      .single(),
  ) as ClientRow;

  return toClient(row);
}

export async function getClients(trainerId: string, search = "") {
  const supabase = await requireSupabase();
  const query = supabase
    .from("clients")
    .select("*")
    .eq("trainer_id", trainerId)
    .order("updated_at", { ascending: false });

  const rows = unwrap(
    search.trim()
      ? await query.ilike("name", `%${search.trim()}%`)
      : await query,
  ) as ClientRow[];

  return rows.map(toClient);
}

export async function getClientDetail(trainerId: string, clientId: string) {
  const supabase = await requireSupabase();
  const clientRow = unwrap(
    await supabase
      .from("clients")
      .select("*")
      .eq("id", clientId)
      .eq("trainer_id", trainerId)
      .maybeSingle(),
  ) as ClientRow | null;

  if (!clientRow) {
    notFound();
  }

  const sessionRows = unwrap(
    await supabase
      .from("assessment_sessions")
      .select("*")
      .eq("client_id", clientId)
      .eq("trainer_id", trainerId)
      .order("recorded_at", { ascending: false }),
  ) as SessionRow[];

  const sessionIds = sessionRows.map((session) => session.id);
  const reportRows =
    sessionIds.length > 0
      ? ((unwrap(
          await supabase
            .from("reports")
            .select("*")
            .in("assessment_session_id", sessionIds)
            .order("created_at", { ascending: false }),
        ) as ReportRow[]) ?? [])
      : [];

  return {
    client: toClient(clientRow),
    sessions: sessionRows.map(toSession),
    reports: reportRows.map(toReport),
  };
}

export async function createAssessmentSession(
  trainerId: string,
  input: { clientId: string; selectedView: ViewType; recordedAt?: string },
) {
  const supabase = await requireSupabase();
  const clientRow = unwrap(
    await supabase
      .from("clients")
      .select("id")
      .eq("id", input.clientId)
      .eq("trainer_id", trainerId)
      .maybeSingle(),
  ) as { id: string } | null;

  if (!clientRow) {
    notFound();
  }

  const timestamp = now();
  const row = unwrap(
    await supabase
      .from("assessment_sessions")
      .insert({
        id: crypto.randomUUID(),
        trainer_id: trainerId,
        client_id: input.clientId,
        movement_type: "bodyweight_squat",
        selected_view: input.selectedView,
        status: "draft",
        recorded_at: input.recordedAt ?? timestamp,
        overall_summary: "",
        trainer_note: "",
        analysis_version: ANALYSIS_VERSION,
        summary_draft_json: null,
        created_at: timestamp,
        updated_at: timestamp,
      })
      .select("*")
      .single(),
  ) as SessionRow;

  return toSession(row);
}

export async function getSessionDetail(trainerId: string, sessionId: string) {
  const detail = await loadSessionDetail(trainerId, sessionId);

  if (!detail.session.summaryDraftJson) {
    detail.session.summaryDraftJson = createSummaryDraft(detail);
  }

  return detail;
}

export async function saveSessionDraft(
  trainerId: string,
  sessionId: string,
  payload: SessionDraftPayload,
) {
  const supabase = await requireSupabase();
  await loadSessionDetail(trainerId, sessionId);

  if (payload.analysis !== undefined) {
    unwrap(
      await supabase
        .from("video_analysis_results")
        .delete()
        .eq("assessment_session_id", sessionId),
    );
    if (payload.analysis) {
      unwrap(
        await supabase
          .from("video_analysis_results")
          .insert(serializeAnalysis(payload.analysis)),
      );
    }
  }

  if (payload.findings) {
    unwrap(await supabase.from("findings").delete().eq("assessment_session_id", sessionId));
    if (payload.findings.length) {
      unwrap(await supabase.from("findings").insert(payload.findings.map(serializeFinding)));
    }
  }

  if (payload.recommendedTests) {
    unwrap(
      await supabase.from("recommended_tests").delete().eq("assessment_session_id", sessionId),
    );
    if (payload.recommendedTests.length) {
      unwrap(
        await supabase
          .from("recommended_tests")
          .insert(payload.recommendedTests.map(serializeRecommendedTest)),
      );
    }
  }

  if (payload.testResults) {
    unwrap(await supabase.from("test_results").delete().eq("assessment_session_id", sessionId));
    if (payload.testResults.length) {
      unwrap(
        await supabase
          .from("test_results")
          .insert(payload.testResults.map(serializeTestResult)),
      );
    }
  }

  if (payload.summaryDraft) {
    unwrap(
      await supabase
        .from("assessment_sessions")
        .update({
          summary_draft_json: payload.summaryDraft,
          overall_summary: payload.summaryDraft.coachOpinion,
          trainer_note: payload.summaryDraft.trainerNote,
          updated_at: now(),
        })
        .eq("id", sessionId)
        .eq("trainer_id", trainerId),
    );
  }

  let refreshed = await loadSessionDetail(trainerId, sessionId);
  const nextRecommended = syncRecommendedTestStatus(
    refreshed.recommendedTests,
    refreshed.testResults,
  );

  if (
    JSON.stringify(nextRecommended.map((item) => item.status)) !==
    JSON.stringify(refreshed.recommendedTests.map((item) => item.status))
  ) {
    unwrap(
      await supabase.from("recommended_tests").delete().eq("assessment_session_id", sessionId),
    );
    if (nextRecommended.length) {
      unwrap(
        await supabase
          .from("recommended_tests")
          .insert(nextRecommended.map(serializeRecommendedTest)),
      );
    }
    refreshed = await loadSessionDetail(trainerId, sessionId);
  }

  if (!payload.summaryDraft && !refreshed.session.summaryDraftJson) {
    const generatedSummary = createSummaryDraft(refreshed);
    unwrap(
      await supabase
        .from("assessment_sessions")
        .update({
          summary_draft_json: generatedSummary,
          overall_summary: generatedSummary.coachOpinion,
          trainer_note: generatedSummary.trainerNote,
          updated_at: now(),
        })
        .eq("id", sessionId)
        .eq("trainer_id", trainerId),
    );
    refreshed = await loadSessionDetail(trainerId, sessionId);
  }

  const nextStatus = deriveSessionStatus(refreshed);
  unwrap(
    await supabase
      .from("assessment_sessions")
      .update({
        status: nextStatus,
        updated_at: now(),
      })
      .eq("id", sessionId)
      .eq("trainer_id", trainerId),
  );

  return loadSessionDetail(trainerId, sessionId);
}

export async function getDashboardData(trainerId: string, search = ""): Promise<DashboardData> {
  const [clients, sessionRows, findingRows, reportRows] = await Promise.all([
    getClients(trainerId, search),
    (async () => {
      const supabase = await requireSupabase();
      return (unwrap(
        await supabase
          .from("assessment_sessions")
          .select("*")
          .eq("trainer_id", trainerId)
          .order("recorded_at", { ascending: false }),
      ) as SessionRow[]).map(toSession);
    })(),
    (async () => {
      const supabase = await requireSupabase();
      return (unwrap(await supabase.from("findings").select("*")) as FindingRow[]).map(toFinding);
    })(),
    (async () => {
      const supabase = await requireSupabase();
      return (unwrap(await supabase.from("reports").select("*")) as ReportRow[]).map(toReport);
    })(),
  ]);

  const clientMap = new Map(clients.map((client) => [client.id, client]));

  const recentSessions = sessionRows.slice(0, 8).map((session) => {
    const visibleFindingLabels = findingRows
      .filter(
        (finding) =>
          finding.assessmentSessionId === session.id && !finding.isHiddenByTrainer,
      )
      .slice(0, 2)
      .map((finding) => finding.labelKo);

    return {
      session,
      clientName: clientMap.get(session.clientId)?.name ?? "알 수 없음",
      visibleFindingLabels,
      hasActiveReport: reportRows.some(
        (report) => report.assessmentSessionId === session.id && report.isActive,
      ),
    };
  });

  const recentReports = sortByDateDesc(
    reportRows.filter((report) =>
      sessionRows.some((session) => session.id === report.assessmentSessionId),
    ),
    (report) => report.updatedAt,
  )
    .slice(0, 8)
    .map((report) => {
      const session = sessionRows.find((item) => item.id === report.assessmentSessionId);
      return {
        report,
        clientName: session ? clientMap.get(session.clientId)?.name ?? "알 수 없음" : "알 수 없음",
      };
    });

  return {
    clients: clients.slice(0, 8),
    recentSessions,
    recentReports,
    stats: {
      totalClients: clients.length,
      totalSessions: sessionRows.length,
      sharedReports: reportRows.filter((report) => report.isActive).length,
      lastRecordedAt: sessionRows[0]?.recordedAt ?? null,
    },
  };
}

export async function publishReport(
  trainerId: string,
  sessionId: string,
  options: { expiresAt?: string | null; replaceActiveLink?: boolean },
) {
  const supabase = await requireSupabase();
  const detail = await loadSessionDetail(trainerId, sessionId);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id || !user.email) {
    throw new Error("Authenticated trainer is required.");
  }

  if (options.replaceActiveLink) {
    unwrap(
      await supabase
        .from("reports")
        .update({ is_active: false, updated_at: now() })
        .eq("assessment_session_id", sessionId),
    );
  }

  const row = unwrap(
    await supabase
      .from("reports")
      .insert({
        id: crypto.randomUUID(),
        assessment_session_id: sessionId,
        share_token: nanoid(22),
        is_active: true,
        expires_at: options.expiresAt ?? null,
        report_snapshot_json: buildReportSnapshot(detail, {
          id: user.id,
          email: user.email,
          createdAt: now(),
        }),
        created_at: now(),
        updated_at: now(),
      })
      .select("*")
      .single(),
  ) as ReportRow;

  unwrap(
    await supabase
      .from("assessment_sessions")
      .update({ status: "shared", updated_at: now() })
      .eq("id", sessionId)
      .eq("trainer_id", trainerId),
  );

  return toReport(row);
}

export async function deactivateReport(trainerId: string, reportId: string) {
  const supabase = await requireSupabase();
  const reportRow = unwrap(
    await supabase
      .from("reports")
      .select("*")
      .eq("id", reportId)
      .maybeSingle(),
  ) as ReportRow | null;

  if (!reportRow) {
    notFound();
  }

  const sessionRow = unwrap(
    await supabase
      .from("assessment_sessions")
      .select("id")
      .eq("id", reportRow.assessment_session_id)
      .eq("trainer_id", trainerId)
      .maybeSingle(),
  ) as { id: string } | null;

  if (!sessionRow) {
    notFound();
  }

  const updated = unwrap(
    await supabase
      .from("reports")
      .update({ is_active: false, updated_at: now() })
      .eq("id", reportId)
      .select("*")
      .single(),
  ) as ReportRow;

  return toReport(updated);
}

export async function getReportByToken(token: string) {
  const supabase = await requireSupabase();
  const rows = unwrap(
    await supabase.rpc("get_public_report", {
      p_share_token: token,
    }),
  ) as ReportRow[] | null;

  const row = rows?.[0] ?? null;
  return row ? toReport(row) : null;
}

export function createManualTestResult(
  sessionId: string,
  input: { testCode: string; testNameKo: string; side: TestResult["side"] },
) {
  const timestamp = now();
  return {
    id: crypto.randomUUID(),
    assessmentSessionId: sessionId,
    testCode: input.testCode,
    testNameKo: input.testNameKo || TEST_TEMPLATE_MAP[input.testCode]?.nameKo || "수동 검사",
    side: input.side,
    resultLabel: "",
    resultValueJson: {},
    memo: "",
    performed: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  } satisfies TestResult;
}
