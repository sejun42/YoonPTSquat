"use client";

import Link from "next/link";
import {
  startTransition,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  Clipboard,
  Eye,
  EyeOff,
  FileUp,
  Link2,
  LoaderCircle,
  Plus,
  RefreshCcw,
  ScanLine,
  TestTubeDiagonal,
  Video,
} from "lucide-react";
import { nanoid } from "nanoid";

import { MetricChart } from "@/components/metric-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { analyzeSquatVideo } from "@/lib/analysis/engine";
import {
  CONFIDENCE_LABELS,
  EMPTY_SUMMARY,
  SEVERITY_LABELS,
  TEST_TEMPLATE_MAP,
  VIEW_LABELS,
} from "@/lib/constants";
import type {
  FinalSummary,
  Finding,
  RecommendedTest,
  SessionDetail,
  TestResult,
  TestSide,
  VideoAnalysisResult,
} from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

function createEmptyTestResult(
  sessionId: string,
  testCode: string,
  testNameKo: string,
  side: TestSide,
) {
  const timestamp = new Date().toISOString();
  return {
    id: nanoid(),
    assessmentSessionId: sessionId,
    testCode,
    testNameKo,
    side,
    resultLabel: "",
    resultValueJson: {},
    memo: "",
    performed: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  } satisfies TestResult;
}

function ensureTestRows(
  sessionId: string,
  recommendedTests: RecommendedTest[],
  current: TestResult[],
) {
  const next = [...current];

  recommendedTests.forEach((test) => {
    const template = TEST_TEMPLATE_MAP[test.testCode];
    const sides =
      template?.sideMode === "perSide"
        ? (["left", "right"] as const)
        : (["bilateral"] as const);

    sides.forEach((side) => {
      if (!next.some((item) => item.testCode === test.testCode && item.side === side)) {
        next.push(createEmptyTestResult(sessionId, test.testCode, test.testNameKo, side));
      }
    });
  });

  return next;
}

function syncRecommendationStatuses(
  recommendedTests: RecommendedTest[],
  results: TestResult[],
) {
  return recommendedTests.map((test) => ({
    ...test,
    status: results.some((result) => result.testCode === test.testCode && result.performed)
      ? ("completed" as const)
      : ("recommended" as const),
  }));
}

function buildSummaryDraft(
  clientName: string,
  findings: Finding[],
  testResults: TestResult[],
  previous?: FinalSummary | null,
) {
  const visible = findings.filter((finding) => !finding.isHiddenByTrainer);
  const observations = visible
    .filter((finding) => finding.category === "observation")
    .slice(0, 3)
    .map((finding) => finding.labelKo);
  const hypotheses = visible
    .filter((finding) => finding.category === "hypothesis")
    .slice(0, 2)
    .map((finding) => finding.labelKo);
  const performed = testResults.filter((result) => result.performed && result.resultLabel);

  return {
    ...EMPTY_SUMMARY,
    ...(previous ?? {}),
    observationSummary:
      previous?.observationSummary ||
      (observations.length
        ? `영상 분석상 ${observations.join(", ")}이(가) 관찰되었습니다.`
        : "영상 분석상 확신도 높은 패턴은 제한적이어서 판단 유보 항목이 포함되었습니다."),
    testSummary:
      previous?.testSummary ||
      (performed.length
        ? `추가 검사에서는 ${performed
            .slice(0, 4)
            .map((result) => `${result.side === "left" ? "좌측" : result.side === "right" ? "우측" : "전체"} ${result.testNameKo} ${result.resultLabel}`)
            .join(", ")}이(가) 확인되었습니다.`
        : "추가 검사 결과는 현장 체크 후 보완할 수 있습니다."),
    coachOpinion:
      previous?.coachOpinion ||
      "영상 기반 관찰과 추가 검사 결과를 함께 참고해 다음 세션 우선순위를 정리하는 것이 좋습니다.",
    nextSessionFocus:
      previous?.nextSessionFocus ||
      (hypotheses.length ? `${hypotheses.join(", ")} 확인` : "동일한 뷰에서 재촬영 후 패턴 재확인"),
    memberFriendlySummary:
      previous?.memberFriendlySummary ||
      `${clientName}님 스쿼트에서는 ${
        observations.length ? observations.join(", ") : "명확한 비대칭이 제한적"
      }이(가) 관찰되었습니다.`,
    trainerNote: previous?.trainerNote || "",
  } satisfies FinalSummary;
}

function qualityTone(quality: VideoAnalysisResult["analysisQuality"]) {
  if (quality === "good") {
    return "success" as const;
  }
  if (quality === "fair") {
    return "warn" as const;
  }
  return "danger" as const;
}

export function SessionWorkbench({
  initialDetail,
}: {
  initialDetail: SessionDetail;
}) {
  const [analysis, setAnalysis] = useState(initialDetail.analysis);
  const [findings, setFindings] = useState(initialDetail.findings);
  const [recommendedTests, setRecommendedTests] = useState(initialDetail.recommendedTests);
  const [testResults, setTestResults] = useState(() =>
    ensureTestRows(
      initialDetail.session.id,
      initialDetail.recommendedTests,
      initialDetail.testResults,
    ),
  );
  const [summaryDraft, setSummaryDraft] = useState<FinalSummary>(
    initialDetail.session.summaryDraftJson ??
      buildSummaryDraft(
        initialDetail.client.name,
        initialDetail.findings,
        initialDetail.testResults,
        null,
      ),
  );
  const [reports, setReports] = useState(initialDetail.reports);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoName, setVideoName] = useState("");
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [infoMessage, setInfoMessage] = useState("");
  const [manualFindingLabel, setManualFindingLabel] = useState("");
  const [manualFindingNote, setManualFindingNote] = useState("");
  const [manualTestName, setManualTestName] = useState("");
  const [manualTestSide, setManualTestSide] = useState<TestSide>("none");
  const [expiresAtLocal, setExpiresAtLocal] = useState("");
  const [isPending, startUiTransition] = useTransition();

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const hasMountedRef = useRef(false);

  const activeReport = reports.find((report) => report.isActive) ?? null;

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    const timeout = window.setTimeout(() => {
      setSaveState("saving");
      void (async () => {
        try {
          await fetch(`/api/sessions/${initialDetail.session.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              analysis,
              findings,
              recommendedTests,
              testResults,
              summaryDraft,
            }),
          });
          setSaveState("saved");
        } catch {
          setSaveState("error");
        }
      })();
    }, 900);

    return () => window.clearTimeout(timeout);
  }, [analysis, findings, recommendedTests, testResults, summaryDraft, initialDetail.session.id]);

  useEffect(() => {
    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);

  const updateSummaryIfBlank = (
    nextFindings: Finding[],
    nextResults: TestResult[],
    override?: Partial<FinalSummary>,
  ) => {
    setSummaryDraft((current) => {
      const allBlank = Object.values(current).every((value) => value.trim().length === 0);
      if (!allBlank && !override) {
        return current;
      }
      return {
        ...buildSummaryDraft(initialDetail.client.name, nextFindings, nextResults, current),
        ...override,
      };
    });
  };

  const updateTestResult = (targetId: string, patch: Partial<TestResult>) => {
    setTestResults((current) => {
      const next = current.map((result) =>
        result.id === targetId
          ? { ...result, ...patch, updatedAt: new Date().toISOString() }
          : result,
      );
      setRecommendedTests((existing) => syncRecommendationStatuses(existing, next));
      updateSummaryIfBlank(findings, next);
      return next;
    });
  };

  const handleFileSelect = async (file: File | null) => {
    if (!file) {
      return;
    }

    setAnalysisBusy(true);
    setInfoMessage("");
    setAnalysisProgress(0);
    const nextUrl = URL.createObjectURL(file);
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }
    setVideoUrl(nextUrl);
    setVideoName(file.name);

    try {
      const output = await analyzeSquatVideo(
        file,
        initialDetail.session.selectedView,
        initialDetail.session.id,
        setAnalysisProgress,
      );
      const nextResults = ensureTestRows(
        initialDetail.session.id,
        output.recommendedTests,
        testResults,
      );
      const nextRecommended = syncRecommendationStatuses(
        output.recommendedTests,
        nextResults,
      );
      const nextSummary = buildSummaryDraft(
        initialDetail.client.name,
        output.findings,
        nextResults,
        summaryDraft,
      );

      setAnalysis(output.analysis);
      setFindings(output.findings);
      setRecommendedTests(nextRecommended);
      setTestResults(nextResults);
      updateSummaryIfBlank(output.findings, nextResults, nextSummary);

      await fetch(`/api/sessions/${initialDetail.session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysis: output.analysis,
          findings: output.findings,
          recommendedTests: nextRecommended,
          testResults: nextResults,
          summaryDraft: nextSummary,
        }),
      });
      setSaveState("saved");
      setInfoMessage("분석 결과를 저장했습니다. 필요 시 자동 패턴을 숨기거나 메모로 보정할 수 있습니다.");
    } catch {
      setInfoMessage("분석에 실패했습니다. 재촬영하거나 수동 입력으로 진행하세요.");
      setSaveState("error");
    } finally {
      setAnalysisBusy(false);
    }
  };

  const addManualFinding = () => {
    if (!manualFindingLabel.trim()) {
      return;
    }

    const nextFinding = {
      id: nanoid(),
      assessmentSessionId: initialDetail.session.id,
      code: `manual_${nanoid(6)}`,
      labelKo: manualFindingLabel.trim(),
      category: "observation",
      severity: "medium",
      confidence: "low",
      descriptionKo:
        manualFindingNote.trim() || "트레이너가 현장에서 직접 추가한 관찰 결과입니다.",
      rationaleKo: "자동 분석 외 현장 관찰을 반영했습니다.",
      sourceView: initialDetail.session.selectedView,
      isHiddenByTrainer: false,
      createdAt: new Date().toISOString(),
    } satisfies Finding;

    const nextFindings = [...findings, nextFinding];
    setFindings(nextFindings);
    updateSummaryIfBlank(nextFindings, testResults);
    setManualFindingLabel("");
    setManualFindingNote("");
  };

  const addManualTest = () => {
    if (!manualTestName.trim()) {
      return;
    }

    const nextResults = [
      ...testResults,
      createEmptyTestResult(
        initialDetail.session.id,
        `manual_${nanoid(6)}`,
        manualTestName.trim(),
        manualTestSide,
      ),
    ];
    setTestResults(nextResults);
    updateSummaryIfBlank(findings, nextResults);
    setManualTestName("");
    setManualTestSide("none");
  };

  const publish = async () => {
    setInfoMessage("");
    try {
      const response = await fetch(`/api/sessions/${initialDetail.session.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          replaceActiveLink: true,
          expiresAt: expiresAtLocal ? new Date(expiresAtLocal).toISOString() : null,
        }),
      });
      const report = await response.json();
      setReports((current) => [
        report,
        ...current.map((item) => ({ ...item, isActive: false })),
      ]);
      setInfoMessage("공유 리포트 링크를 발행했습니다.");
    } catch {
      setInfoMessage("리포트 발행에 실패했습니다.");
    }
  };

  const deactivate = async () => {
    if (!activeReport) {
      return;
    }

    try {
      await fetch(`/api/reports/${activeReport.id}/deactivate`, { method: "POST" });
      setReports((current) =>
        current.map((report) =>
          report.id === activeReport.id ? { ...report, isActive: false } : report,
        ),
      );
      setInfoMessage("현재 링크를 비활성화했습니다.");
    } catch {
      setInfoMessage("링크 비활성화에 실패했습니다.");
    }
  };

  const copyActiveLink = async () => {
    if (!activeReport) {
      return;
    }

    const url = `${window.location.origin}/reports/${activeReport.shareToken}`;
    await navigator.clipboard.writeText(url);
    setInfoMessage("리포트 링크를 복사했습니다.");
  };

  const renderTopCard = () => (
    <Card className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-muted">Assessment Session</p>
          <h2 className="font-display text-3xl font-semibold tracking-[-0.06em]">
            {initialDetail.client.name}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {VIEW_LABELS[initialDetail.session.selectedView]} · 맨몸 스쿼트 ·{" "}
            {formatDateTime(initialDetail.session.recordedAt)}
          </p>
        </div>
        <Badge tone={analysis ? qualityTone(analysis.analysisQuality) : "neutral"}>
          {analysis ? `분석 ${analysis.analysisQuality}` : "분석 전"}
        </Badge>
      </div>
      <div className="rounded-3xl border border-line bg-white/75 p-4 text-sm leading-6 text-muted">
        원본 영상은 서버에 저장되지 않습니다. 촬영 또는 업로드 후 현재 기기에서만 분석하고, 저장되는 것은 평가 결과와 메모입니다.
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <span>저장 상태:</span>
        <Badge
          tone={
            saveState === "saved"
              ? "success"
              : saveState === "error"
                ? "danger"
                : "neutral"
          }
        >
          {saveState === "saving"
            ? "저장 중"
            : saveState === "saved"
              ? "자동 저장됨"
              : saveState === "error"
                ? "저장 실패"
                : "대기 중"}
        </Badge>
      </div>
    </Card>
  );

  const renderVideoCard = () => (
    <Card className="space-y-4">
      <div className="flex items-center gap-2">
        <Video className="size-4 text-accent" />
        <h3 className="font-semibold">촬영 / 업로드</h3>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => cameraInputRef.current?.click()}
        >
          <ScanLine className="mr-2 size-4" />
          카메라로 촬영
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => galleryInputRef.current?.click()}
        >
          <FileUp className="mr-2 size-4" />
          갤러리에서 업로드
        </Button>
      </div>
      <input
        ref={cameraInputRef}
        type="file"
        accept="video/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          startTransition(() => {
            void handleFileSelect(file);
          });
        }}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          startTransition(() => {
            void handleFileSelect(file);
          });
        }}
      />
      {videoUrl ? (
        <div className="space-y-3 rounded-[28px] border border-dashed border-line bg-white/70 p-4">
          <video
            src={videoUrl}
            controls
            playsInline
            className="aspect-[4/5] w-full rounded-[24px] bg-black/90 object-cover"
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted">{videoName}</p>
            {analysisBusy ? (
              <div className="flex items-center gap-2 text-sm text-muted">
                <LoaderCircle className="size-4 animate-spin" />
                {Math.round(analysisProgress * 100)}%
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </Card>
  );

  const renderAnalysisCard = () => (
    <Card className="space-y-4">
      <h3 className="font-semibold">분석 결과</h3>
      {analysis ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-3xl border border-line bg-white/75 p-4">
              <p className="text-xs text-muted">반복 수 추정</p>
              <p className="mt-2 text-2xl font-semibold">{analysis.repCountEstimate || "-"}</p>
            </div>
            <div className="rounded-3xl border border-line bg-white/75 p-4">
              <p className="text-xs text-muted">유효 프레임 비율</p>
              <p className="mt-2 text-2xl font-semibold">
                {Math.round(analysis.metricsJson.validFrameRatio * 100)}%
              </p>
            </div>
          </div>
          {analysis.metricsJson.warnings.length ? (
            <div className="space-y-2 rounded-3xl border border-warn/20 bg-warn/8 p-4 text-sm text-warn">
              {analysis.metricsJson.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          ) : null}
          <MetricChart analysis={analysis} />
          <div className="space-y-3">
            {findings.map((finding) => (
              <div
                key={finding.id}
                className="rounded-3xl border border-line bg-white/75 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{finding.labelKo}</p>
                      <Badge tone={finding.category === "hypothesis" ? "warn" : "default"}>
                        {finding.category === "hypothesis" ? "의심 패턴" : "관찰 결과"}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted">{finding.descriptionKo}</p>
                    <p className="mt-2 text-xs leading-5 text-muted">
                      근거: {finding.rationaleKo}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="inline-flex size-11 items-center justify-center rounded-2xl border border-line bg-white text-muted transition hover:text-foreground"
                    onClick={() => {
                      const next = findings.map((item) =>
                        item.id === finding.id
                          ? { ...item, isHiddenByTrainer: !item.isHiddenByTrainer }
                          : item,
                      );
                      setFindings(next);
                      updateSummaryIfBlank(next, testResults);
                    }}
                    aria-label={finding.isHiddenByTrainer ? "유지하기" : "숨기기"}
                  >
                    {finding.isHiddenByTrainer ? (
                      <Eye className="size-4" />
                    ) : (
                      <EyeOff className="size-4" />
                    )}
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge tone="neutral">심각도 {SEVERITY_LABELS[finding.severity]}</Badge>
                  <Badge tone="neutral">신뢰도 {CONFIDENCE_LABELS[finding.confidence]}</Badge>
                  {finding.isHiddenByTrainer ? <Badge tone="danger">숨김 처리됨</Badge> : null}
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-3xl border border-line bg-white/70 p-4">
            <p className="mb-3 font-medium">트레이너 관찰 직접 추가</p>
            <div className="space-y-3">
              <Input
                value={manualFindingLabel}
                onChange={(event) => setManualFindingLabel(event.target.value)}
                placeholder="예: 상승 시 골반 우측 이동 경향"
              />
              <Textarea
                value={manualFindingNote}
                onChange={(event) => setManualFindingNote(event.target.value)}
                placeholder="추가 메모 또는 현장 관찰"
                className="min-h-20"
              />
              <Button type="button" variant="secondary" onClick={addManualFinding}>
                <Plus className="mr-2 size-4" />
                관찰 패턴 추가
              </Button>
            </div>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted">
          아직 분석 결과가 없습니다. 촬영 또는 업로드 후 자동 스크리닝을 실행하세요.
        </p>
      )}
    </Card>
  );

  const renderTestsCard = () => (
    <Card className="space-y-4">
      <div className="flex items-center gap-2">
        <TestTubeDiagonal className="size-4 text-accent" />
        <h3 className="font-semibold">추가 검사 입력</h3>
      </div>
      {recommendedTests.length ? (
        <div className="space-y-3">
          {recommendedTests.map((test) => (
            <div key={test.id} className="rounded-3xl border border-line bg-white/75 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{test.testNameKo}</p>
                  <p className="mt-1 text-sm leading-6 text-muted">{test.reasonKo}</p>
                </div>
                <Badge tone={test.status === "completed" ? "success" : "default"}>
                  {test.status === "completed" ? "입력 완료" : "추천"}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">현재 자동 추천된 검사가 없습니다. 필요 시 수동으로 추가하세요.</p>
      )}
      <div className="space-y-3">
        {testResults.map((result) => {
          const template = TEST_TEMPLATE_MAP[result.testCode];
          return (
            <div key={result.id} className="rounded-3xl border border-line bg-white/75 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{result.testNameKo}</p>
                  <p className="text-xs text-muted">
                    {result.side === "left"
                      ? "좌측"
                      : result.side === "right"
                        ? "우측"
                        : result.side === "bilateral"
                          ? "양측/전체"
                          : "측면 없음"}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm text-muted">
                  <input
                    type="checkbox"
                    checked={result.performed}
                    onChange={(event) =>
                      updateTestResult(result.id, { performed: event.target.checked })
                    }
                    className="accent-[var(--accent)]"
                  />
                  시행
                </label>
              </div>
              <div className="mt-3 space-y-3">
                {template ? (
                  <select
                    value={result.resultLabel}
                    onChange={(event) =>
                      updateTestResult(result.id, {
                        resultLabel: event.target.value,
                        performed: event.target.value ? true : result.performed,
                      })
                    }
                    className="h-12 w-full rounded-2xl border border-line bg-white px-4 text-sm outline-none"
                  >
                    <option value="">결과 선택</option>
                    {template.options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    value={result.resultLabel}
                    onChange={(event) =>
                      updateTestResult(result.id, {
                        resultLabel: event.target.value,
                        performed: event.target.value ? true : result.performed,
                      })
                    }
                    placeholder="검사 결과 입력"
                  />
                )}
                <Textarea
                  value={result.memo}
                  onChange={(event) => updateTestResult(result.id, { memo: event.target.value })}
                  placeholder="간단 메모"
                  className="min-h-20"
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="rounded-3xl border border-line bg-white/70 p-4">
        <p className="mb-3 font-medium">수동 검사 추가</p>
        <div className="space-y-3">
          <Input
            value={manualTestName}
            onChange={(event) => setManualTestName(event.target.value)}
            placeholder="검사명 입력"
          />
          <select
            value={manualTestSide}
            onChange={(event) => setManualTestSide(event.target.value as TestSide)}
            className="h-12 w-full rounded-2xl border border-line bg-white px-4 text-sm outline-none"
          >
            <option value="none">측면 없음</option>
            <option value="left">좌측</option>
            <option value="right">우측</option>
            <option value="bilateral">양측/전체</option>
          </select>
          <Button type="button" variant="secondary" onClick={addManualTest}>
            <Plus className="mr-2 size-4" />
            수동 검사 카드 추가
          </Button>
        </div>
      </div>
    </Card>
  );

  const renderSummaryCard = () => (
    <Card className="space-y-4">
      <h3 className="font-semibold">최종 요약 작성</h3>
      <label className="block space-y-2">
        <span className="text-sm font-medium">영상 기반 관찰 결과 요약</span>
        <Textarea
          value={summaryDraft.observationSummary}
          onChange={(event) =>
            setSummaryDraft((current) => ({
              ...current,
              observationSummary: event.target.value,
            }))
          }
        />
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-medium">추가 검사 결과 요약</span>
        <Textarea
          value={summaryDraft.testSummary}
          onChange={(event) =>
            setSummaryDraft((current) => ({
              ...current,
              testSummary: event.target.value,
            }))
          }
        />
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-medium">최종 종합 의견</span>
        <Textarea
          value={summaryDraft.coachOpinion}
          onChange={(event) =>
            setSummaryDraft((current) => ({
              ...current,
              coachOpinion: event.target.value,
            }))
          }
        />
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-medium">다음 세션 권장 포인트</span>
        <Textarea
          value={summaryDraft.nextSessionFocus}
          onChange={(event) =>
            setSummaryDraft((current) => ({
              ...current,
              nextSessionFocus: event.target.value,
            }))
          }
        />
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-medium">회원 공유용 문구</span>
        <Textarea
          value={summaryDraft.memberFriendlySummary}
          onChange={(event) =>
            setSummaryDraft((current) => ({
              ...current,
              memberFriendlySummary: event.target.value,
            }))
          }
        />
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-medium">트레이너 메모</span>
        <Textarea
          value={summaryDraft.trainerNote}
          onChange={(event) =>
            setSummaryDraft((current) => ({
              ...current,
              trainerNote: event.target.value,
            }))
          }
        />
      </label>
    </Card>
  );

  const renderShareCard = () => (
    <Card className="space-y-4">
      <div className="flex items-center gap-2">
        <Link2 className="size-4 text-accent" />
        <h3 className="font-semibold">리포트 공유</h3>
      </div>
      <label className="block space-y-2">
        <span className="text-sm font-medium">링크 만료일 (선택)</span>
        <Input
          type="datetime-local"
          value={expiresAtLocal}
          onChange={(event) => setExpiresAtLocal(event.target.value)}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          type="button"
          onClick={() => startUiTransition(() => void publish())}
          disabled={isPending}
        >
          {isPending ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : null}
          리포트 발행
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => startUiTransition(() => void publish())}
          disabled={isPending}
        >
          <RefreshCcw className="mr-2 size-4" />
          새 링크 재발행
        </Button>
      </div>
      {activeReport ? (
        <div className="space-y-3 rounded-3xl border border-line bg-white/75 p-4">
          <p className="break-all text-sm text-muted">
            {`${typeof window !== "undefined" ? window.location.origin : ""}/reports/${activeReport.shareToken}`}
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Button type="button" variant="secondary" onClick={() => void copyActiveLink()}>
              <Clipboard className="mr-2 size-4" />
              링크 복사
            </Button>
            <Button asChild variant="secondary">
              <Link href={`/reports/${activeReport.shareToken}`} target="_blank">
                미리보기
              </Link>
            </Button>
            <Button type="button" variant="danger" onClick={() => void deactivate()}>
              현재 링크 비활성화
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted">아직 활성 링크가 없습니다.</p>
      )}
      {reports.length ? (
        <div className="space-y-3">
          {reports.map((report) => (
            <div
              key={report.id}
              className="flex items-center justify-between rounded-3xl border border-line bg-white/70 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium">{formatDateTime(report.createdAt)}</p>
                <p className="text-xs text-muted">
                  {report.isActive ? "활성 링크" : "비활성 링크"}
                </p>
              </div>
              <Badge tone={report.isActive ? "success" : "neutral"}>
                {report.isActive ? "공유 중" : "보관"}
              </Badge>
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );

  return (
    <div className="space-y-4">
      {renderTopCard()}
      {renderVideoCard()}
      {renderAnalysisCard()}
      {renderTestsCard()}
      {renderSummaryCard()}
      {renderShareCard()}
      {infoMessage ? (
        <p className="rounded-2xl border border-line bg-white/70 px-4 py-3 text-sm text-muted">
          {infoMessage}
        </p>
      ) : null}
    </div>
  );
}
