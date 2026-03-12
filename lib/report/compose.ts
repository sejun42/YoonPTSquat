import { DISALLOWED_TERMS, EMPTY_SUMMARY, TEST_TEMPLATE_MAP } from "@/lib/constants";
import type {
  FinalSummary,
  Finding,
  ReportSnapshot,
  SessionDetail,
  TestResult,
  User,
} from "@/lib/types";

function scrubLanguage(text: string) {
  return DISALLOWED_TERMS.reduce(
    (current, term) => current.replaceAll(term, "추가 확인이 필요한 소견"),
    text,
  );
}

function summarizeVisibleFindings(findings: Finding[]) {
  const visible = findings.filter((finding) => !finding.isHiddenByTrainer);
  if (!visible.length) {
    return "영상 분석상 확신도 높은 움직임 패턴은 제한적이어서 판단 유보 항목이 포함되었습니다.";
  }

  return visible
    .slice(0, 3)
    .map((finding) => `${finding.labelKo}이(가) 관찰되었습니다.`)
    .join(" ");
}

function summarizeTestResults(testResults: TestResult[]) {
  const performed = testResults.filter((test) => test.performed && test.resultLabel);
  if (!performed.length) {
    return "추가 검사 결과 입력이 아직 없어, 현장 확인 후 보완하는 것을 권장합니다.";
  }

  return performed
    .slice(0, 4)
    .map((test) => {
      const template = TEST_TEMPLATE_MAP[test.testCode];
      const prefix =
        test.side === "left"
          ? "좌측"
          : test.side === "right"
            ? "우측"
            : test.side === "bilateral"
              ? "양측/전체"
              : "";
      return `${prefix} ${template?.nameKo ?? test.testNameKo}: ${test.resultLabel}`.trim();
    })
    .join(", ");
}

function deriveNextFocus(detail: SessionDetail) {
  const hypotheses = detail.findings.filter(
    (finding) => finding.category === "hypothesis" && !finding.isHiddenByTrainer,
  );

  if (!hypotheses.length) {
    return "동일한 뷰에서 재촬영 후 패턴 재확인";
  }

  return hypotheses
    .slice(0, 2)
    .map((finding) => finding.labelKo.replace("가능성", "확인"))
    .join(", ");
}

export function createSummaryDraft(detail: SessionDetail) {
  const observationSummary = summarizeVisibleFindings(detail.findings);
  const testSummary = summarizeTestResults(detail.testResults);
  const nextSessionFocus = deriveNextFocus(detail);
  const coachOpinion = `${observationSummary} ${testSummary} 다음 세션에서는 ${nextSessionFocus}을 우선 확인하는 것이 좋습니다.`;
  const memberFriendlySummary = `${detail.client.name}님 스쿼트에서는 ${observationSummary} 추가 검사에서는 ${testSummary}이(가) 확인되었습니다.`;

  const merged: FinalSummary = {
    ...EMPTY_SUMMARY,
    ...(detail.session.summaryDraftJson ?? {}),
    observationSummary: detail.session.summaryDraftJson?.observationSummary || observationSummary,
    testSummary: detail.session.summaryDraftJson?.testSummary || testSummary,
    coachOpinion: detail.session.summaryDraftJson?.coachOpinion || coachOpinion,
    nextSessionFocus: detail.session.summaryDraftJson?.nextSessionFocus || nextSessionFocus,
    memberFriendlySummary:
      detail.session.summaryDraftJson?.memberFriendlySummary || memberFriendlySummary,
    trainerNote: detail.session.summaryDraftJson?.trainerNote || detail.session.trainerNote || "",
  };

  return {
    observationSummary: scrubLanguage(merged.observationSummary),
    testSummary: scrubLanguage(merged.testSummary),
    coachOpinion: scrubLanguage(merged.coachOpinion),
    nextSessionFocus: scrubLanguage(merged.nextSessionFocus),
    memberFriendlySummary: scrubLanguage(merged.memberFriendlySummary),
    trainerNote: scrubLanguage(merged.trainerNote),
  };
}

export function buildReportSnapshot(detail: SessionDetail, trainer: User): ReportSnapshot {
  const analyzedViews = [...new Set(detail.analyses.map((analysis) => analysis.sourceView))];

  return {
    publishedAt: new Date().toISOString(),
    trainerEmail: trainer.email,
    client: {
      id: detail.client.id,
      name: detail.client.name,
      phoneOrIdentifier: detail.client.phoneOrIdentifier,
    },
    session: {
      id: detail.session.id,
      movementType: detail.session.movementType,
      selectedView: detail.session.selectedView,
      recordedAt: detail.session.recordedAt,
      status: detail.session.status,
      analyzedViews,
    },
    analyses: detail.analyses,
    findings: detail.findings.filter((finding) => !finding.isHiddenByTrainer),
    recommendedTests: detail.recommendedTests,
    testResults: detail.testResults.filter((test) => test.performed),
    summary: createSummaryDraft(detail),
  };
}
