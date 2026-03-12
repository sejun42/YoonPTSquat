import "server-only";

import { nanoid } from "nanoid";
import { notFound } from "next/navigation";

import { ANALYSIS_VERSION, EMPTY_SUMMARY, TEST_TEMPLATE_MAP } from "@/lib/constants";
import { mutateDb, readDb } from "@/lib/data/file-db";
import { buildReportSnapshot, createSummaryDraft } from "@/lib/report/compose";
import type {
  AssessmentSession,
  Client,
  DashboardData,
  Report,
  RecommendedTest,
  SessionDetail,
  SessionDraftPayload,
  TestResult,
  User,
  ViewType,
} from "@/lib/types";
import { sortByDateDesc } from "@/lib/utils";

function now() {
  return new Date().toISOString();
}

function ensureOwner<T extends { trainerId: string }>(entity: T | undefined, trainerId: string) {
  if (!entity || entity.trainerId !== trainerId) {
    notFound();
  }
  return entity;
}

function hydrateSessionDetail(
  trainerId: string,
  sessionId: string,
  db: Awaited<ReturnType<typeof readDb>>,
) {
  const session = ensureOwner(
    db.assessmentSessions.find((item) => item.id === sessionId),
    trainerId,
  );
  const client = ensureOwner(db.clients.find((item) => item.id === session.clientId), trainerId);

  return {
    session,
    client,
    analyses: sortByDateDesc(
      db.videoAnalysisResults.filter((item) => item.assessmentSessionId === sessionId),
      (item) => item.createdAt,
    ),
    findings: db.findings.filter((item) => item.assessmentSessionId === sessionId),
    recommendedTests: db.recommendedTests
      .filter((item) => item.assessmentSessionId === sessionId)
      .sort((left, right) => left.priorityOrder - right.priorityOrder),
    testResults: db.testResults.filter((item) => item.assessmentSessionId === sessionId),
    reports: sortByDateDesc(
      db.reports.filter((item) => item.assessmentSessionId === sessionId),
      (item) => item.createdAt,
    ),
  } satisfies SessionDetail;
}

function deriveSessionStatus(detail: SessionDetail) {
  const hasAnalysis = detail.analyses.length > 0;
  const hasTests = detail.testResults.some((test) => test.performed);
  const hasSummary = Boolean(
    detail.session.summaryDraftJson &&
      Object.values(detail.session.summaryDraftJson).some((value) => value.trim().length > 0),
  );
  const hasActiveReport = detail.reports.some((report) => report.isActive);

  if (hasActiveReport) {
    return "shared" as const;
  }
  if (hasSummary) {
    return "report_ready" as const;
  }
  if (hasTests) {
    return "tests_added" as const;
  }
  if (hasAnalysis) {
    return "analyzed" as const;
  }
  return "draft" as const;
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

export async function upsertTrainer(email: string) {
  return mutateDb<User>((db) => {
    const normalized = email.trim().toLowerCase();
    const existing = db.users.find((user) => user.email === normalized);
    if (existing) {
      return existing;
    }

    const user = {
      id: nanoid(),
      email: normalized,
      createdAt: now(),
    } satisfies User;

    db.users.push(user);
    return user;
  });
}

export async function createClient(
  trainerId: string,
  input: Pick<Client, "name" | "phoneOrIdentifier" | "memo">,
) {
  return mutateDb<Client>((db) => {
    const timestamp = now();
    const client = {
      id: nanoid(),
      trainerId,
      name: input.name.trim(),
      phoneOrIdentifier: input.phoneOrIdentifier?.trim() || "",
      memo: input.memo?.trim() || "",
      createdAt: timestamp,
      updatedAt: timestamp,
    } satisfies Client;
    db.clients.push(client);
    return client;
  });
}

export async function getClients(trainerId: string, search = "") {
  const db = await readDb();
  const query = search.trim().toLowerCase();
  return sortByDateDesc(
    db.clients.filter(
      (client) =>
        client.trainerId === trainerId &&
        (!query || client.name.toLowerCase().includes(query)),
    ),
    (client) => client.updatedAt,
  );
}

export async function getClientDetail(trainerId: string, clientId: string) {
  const db = await readDb();
  const client = ensureOwner(db.clients.find((item) => item.id === clientId), trainerId);
  const sessions = sortByDateDesc(
    db.assessmentSessions.filter((item) => item.clientId === clientId),
    (item) => item.recordedAt,
  );
  const reports = sortByDateDesc(
    db.reports.filter((report) =>
      sessions.some((session) => session.id === report.assessmentSessionId),
    ),
    (report) => report.createdAt,
  );

  return { client, sessions, reports };
}

export async function createAssessmentSession(
  trainerId: string,
  input: { clientId: string; selectedView: ViewType; recordedAt?: string },
) {
  return mutateDb<AssessmentSession>((db) => {
    ensureOwner(db.clients.find((item) => item.id === input.clientId), trainerId);

    const timestamp = now();
    const session = {
      id: nanoid(),
      trainerId,
      clientId: input.clientId,
      movementType: "bodyweight_squat",
      selectedView: input.selectedView,
      status: "draft",
      recordedAt: input.recordedAt ?? timestamp,
      overallSummary: "",
      trainerNote: "",
      analysisVersion: ANALYSIS_VERSION,
      summaryDraftJson: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    } satisfies AssessmentSession;

    db.assessmentSessions.push(session);
    return session;
  });
}

export async function getSessionDetail(trainerId: string, sessionId: string) {
  const db = await readDb();
  const detail = hydrateSessionDetail(trainerId, sessionId, db);
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
  return mutateDb<SessionDetail>((db) => {
    const detail = hydrateSessionDetail(trainerId, sessionId, db);

    if (payload.analyses) {
      db.videoAnalysisResults = db.videoAnalysisResults.filter(
        (item) => item.assessmentSessionId !== sessionId,
      );
      if (payload.analyses.length) {
        db.videoAnalysisResults.push(...payload.analyses);
      }
    }

    if (payload.findings) {
      db.findings = db.findings.filter((item) => item.assessmentSessionId !== sessionId);
      db.findings.push(...payload.findings);
    }

    if (payload.recommendedTests) {
      db.recommendedTests = db.recommendedTests.filter(
        (item) => item.assessmentSessionId !== sessionId,
      );
      db.recommendedTests.push(...payload.recommendedTests);
    }

    if (payload.testResults) {
      db.testResults = db.testResults.filter((item) => item.assessmentSessionId !== sessionId);
      db.testResults.push(...payload.testResults);
    }

    const updatedSession = db.assessmentSessions.find((item) => item.id === sessionId);
    if (!updatedSession) {
      notFound();
    }

    if (payload.summaryDraft) {
      updatedSession.summaryDraftJson = payload.summaryDraft;
      updatedSession.overallSummary = payload.summaryDraft.coachOpinion;
      updatedSession.trainerNote = payload.summaryDraft.trainerNote;
    } else if (!updatedSession.summaryDraftJson) {
      updatedSession.summaryDraftJson = EMPTY_SUMMARY;
    }

    let refreshed = hydrateSessionDetail(trainerId, sessionId, db);
    refreshed.recommendedTests = syncRecommendedTestStatus(
      refreshed.recommendedTests,
      refreshed.testResults,
    );

    db.recommendedTests = db.recommendedTests.filter(
      (item) => item.assessmentSessionId !== sessionId,
    );
    db.recommendedTests.push(...refreshed.recommendedTests);

    if (!updatedSession.summaryDraftJson) {
      updatedSession.summaryDraftJson = createSummaryDraft(detail);
      refreshed = hydrateSessionDetail(trainerId, sessionId, db);
    }

    updatedSession.status = deriveSessionStatus(refreshed);
    updatedSession.updatedAt = now();

    return hydrateSessionDetail(trainerId, sessionId, db);
  });
}

export async function getDashboardData(trainerId: string, search = ""): Promise<DashboardData> {
  const db = await readDb();
  const clients = await getClients(trainerId, search);
  const sessions = sortByDateDesc(
    db.assessmentSessions.filter((session) => session.trainerId === trainerId),
    (session) => session.recordedAt,
  );

  const recentSessions = sessions.slice(0, 8).map((session) => {
    const client = db.clients.find((item) => item.id === session.clientId);
    const visibleFindingLabels = db.findings
      .filter(
        (finding) =>
          finding.assessmentSessionId === session.id && !finding.isHiddenByTrainer,
      )
      .slice(0, 2)
      .map((finding) => finding.labelKo);

    return {
      session,
      clientName: client?.name ?? "알 수 없음",
      visibleFindingLabels,
      hasActiveReport: db.reports.some(
        (report) => report.assessmentSessionId === session.id && report.isActive,
      ),
    };
  });

  const recentReports = sortByDateDesc(
    db.reports.filter((report) => {
      const session = db.assessmentSessions.find(
        (item) => item.id === report.assessmentSessionId,
      );
      return session?.trainerId === trainerId;
    }),
    (report) => report.updatedAt,
  )
    .slice(0, 8)
    .map((report) => {
      const session = db.assessmentSessions.find(
        (item) => item.id === report.assessmentSessionId,
      );
      const client = db.clients.find((item) => item.id === session?.clientId);
      return {
        report,
        clientName: client?.name ?? "알 수 없음",
      };
    });

  return {
    clients: clients.slice(0, 8),
    recentSessions,
    recentReports,
    stats: {
      totalClients: db.clients.filter((client) => client.trainerId === trainerId).length,
      totalSessions: sessions.length,
      sharedReports: recentReports.filter(({ report }) => report.isActive).length,
      lastRecordedAt: sessions[0]?.recordedAt ?? null,
    },
  };
}

export async function publishReport(
  trainerId: string,
  sessionId: string,
  options: { expiresAt?: string | null; replaceActiveLink?: boolean },
) {
  return mutateDb<Report>((db) => {
    const detail = hydrateSessionDetail(trainerId, sessionId, db);
    const trainer = db.users.find((user) => user.id === trainerId);
    if (!trainer) {
      notFound();
    }

    if (options.replaceActiveLink) {
      db.reports = db.reports.map((report) =>
        report.assessmentSessionId === sessionId ? { ...report, isActive: false } : report,
      );
    }

    const report = {
      id: nanoid(),
      assessmentSessionId: sessionId,
      shareToken: nanoid(22),
      isActive: true,
      expiresAt: options.expiresAt ?? null,
      reportSnapshotJson: buildReportSnapshot(detail, trainer),
      createdAt: now(),
      updatedAt: now(),
    } satisfies Report;

    db.reports.push(report);

    const session = db.assessmentSessions.find((item) => item.id === sessionId);
    if (session) {
      session.status = "shared";
      session.updatedAt = now();
    }

    return report;
  });
}

export async function deactivateReport(trainerId: string, reportId: string) {
  return mutateDb<Report>((db) => {
    const report = db.reports.find((item) => item.id === reportId);
    if (!report) {
      notFound();
    }

    const session = ensureOwner(
      db.assessmentSessions.find((item) => item.id === report.assessmentSessionId),
      trainerId,
    );

    report.isActive = false;
    report.updatedAt = now();
    session.updatedAt = now();
    return report;
  });
}

export async function getReportByToken(token: string) {
  const db = await readDb();
  const report = db.reports.find((item) => item.shareToken === token);
  if (!report || !report.isActive) {
    return null;
  }

  if (report.expiresAt && new Date(report.expiresAt).getTime() < Date.now()) {
    return null;
  }

  return report;
}

export function createManualTestResult(
  sessionId: string,
  input: { testCode: string; testNameKo: string; side: TestResult["side"] },
) {
  const timestamp = now();
  return {
    id: nanoid(),
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
