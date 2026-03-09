import type {
  ConfidenceLevel,
  FinalSummary,
  SeverityLevel,
  SessionStatus,
  TestTemplate,
  ViewType,
} from "@/lib/types";

export const APP_NAME = "Squat Screen";
export const ANALYSIS_VERSION = "mvp-rule-engine-v1";

export const VIEW_LABELS: Record<ViewType, string> = {
  front: "정면",
  side: "측면",
  rear: "후면",
};

export const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
  draft: "초안",
  analyzed: "분석 완료",
  tests_added: "검사 입력 완료",
  report_ready: "리포트 준비",
  shared: "공유 중",
};

export const SEVERITY_LABELS: Record<SeverityLevel, string> = {
  low: "낮음",
  medium: "중간",
  high: "높음",
};

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  low: "낮음",
  medium: "중간",
  high: "높음",
};

export const CAPTURE_GUIDE = [
  "전신이 발끝까지 모두 보이게 촬영하세요.",
  "회원과 카메라 사이 거리를 일정하게 유지하세요.",
  "조명이 충분한 곳에서 촬영하세요.",
  "정면/측면/후면 중 한 방향을 고정해서 촬영하세요.",
  "10~20회 맨몸 스쿼트를 수행하도록 안내하세요.",
] as const;

export const TEST_TEMPLATES: TestTemplate[] = [
  {
    code: "knee_to_wall",
    nameKo: "Knee-to-wall test",
    sideMode: "perSide",
    options: ["정상", "제한", "현저한 제한"],
    recommendedReason: "발목 가동성 영향 여부를 구분하기 위한 검사입니다.",
  },
  {
    code: "single_leg_squat",
    nameKo: "Single-leg squat",
    sideMode: "perSide",
    options: ["안정", "불안정", "보상 큼"],
    recommendedReason: "단일지지 안정성과 좌우 제어 차이를 확인하기 위한 검사입니다.",
  },
  {
    code: "single_leg_stance",
    nameKo: "Single-leg stance",
    sideMode: "perSide",
    options: ["안정", "흔들림", "유지 어려움"],
    recommendedReason: "편측 지지 안정성을 확인하기 위한 검사입니다.",
  },
  {
    code: "hip_90_90",
    nameKo: "90/90 hip IR/ER 비교",
    sideMode: "perSide",
    options: ["내회전 제한", "외회전 제한", "큰 차이 없음", "판단 유보"],
    recommendedReason: "고관절 회전 차이를 구분하기 위한 검사입니다.",
  },
  {
    code: "short_foot_resquat",
    nameKo: "Short foot 세팅 후 재스쿼트",
    sideMode: "bilateral",
    options: ["개선됨", "큰 변화 없음", "오히려 불편", "시행 안 함"],
    recommendedReason: "발 안정성 개입 시 변화 여부를 빠르게 보기 위한 재테스트입니다.",
  },
  {
    code: "heel_elevated_resquat",
    nameKo: "Heel-elevated squat 재테스트",
    sideMode: "bilateral",
    options: ["개선됨", "큰 변화 없음", "오히려 불편", "시행 안 함"],
    recommendedReason: "발목 가동성 영향 여부를 보기 위한 재테스트입니다.",
  },
] as const;

export const TEST_TEMPLATE_MAP = Object.fromEntries(
  TEST_TEMPLATES.map((template) => [template.code, template]),
) as Record<string, TestTemplate>;

export const EMPTY_SUMMARY: FinalSummary = {
  observationSummary: "",
  testSummary: "",
  coachOpinion: "",
  nextSessionFocus: "",
  memberFriendlySummary: "",
  trainerNote: "",
};

export const DISALLOWED_TERMS = [
  "확진",
  "진단 완료",
  "구조적 이상",
  "디스크",
  "골반이 틀어져",
  "근육 약화가 확진",
];
