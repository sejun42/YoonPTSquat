import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { nanoid } from "nanoid";

import { TEST_TEMPLATE_MAP } from "@/lib/constants";
import type {
  Finding,
  RecommendedTest,
  VideoAnalysisResult,
  ViewType,
} from "@/lib/types";

const DEFAULT_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task";

const WASM_ROOT =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";

interface SampleMetric {
  time: number;
  brightness: number;
  valid: boolean;
  depth: number;
  hipShift: number;
  torsoLean: number;
  lateralTilt: number;
  kneeValgusLeft: number;
  kneeValgusRight: number;
  heelLift: number;
  toeAngleDelta: number;
}

interface AggregateMetrics {
  validFrameRatio: number;
  brightness: number;
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
  repSeries: VideoAnalysisResult["metricsJson"]["repSeries"];
  repCountEstimate: number;
  analysisQuality: VideoAnalysisResult["analysisQuality"];
  warnings: string[];
  sampledFrames: number;
  validFrames: number;
  timestamps: number[];
}

export interface AnalyzerOutput {
  analysis: VideoAnalysisResult;
  findings: Finding[];
  recommendedTests: RecommendedTest[];
}

let poseLandmarkerPromise: Promise<PoseLandmarker | null> | null = null;

async function getPoseLandmarker() {
  if (poseLandmarkerPromise) {
    return poseLandmarkerPromise;
  }

  poseLandmarkerPromise = (async () => {
    try {
      const vision = await FilesetResolver.forVisionTasks(WASM_ROOT);
      return PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            process.env.NEXT_PUBLIC_MEDIAPIPE_POSE_MODEL_URL ?? DEFAULT_MODEL_URL,
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numPoses: 1,
      });
    } catch {
      return null;
    }
  })();

  return poseLandmarkerPromise;
}

function average(values: number[]) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number, decimals = 3) {
  const unit = 10 ** decimals;
  return Math.round(value * unit) / unit;
}

function movingAverage(values: number[], window = 3) {
  return values.map((_, index) => {
    const start = Math.max(0, index - window);
    const end = Math.min(values.length - 1, index + window);
    return average(values.slice(start, end + 1));
  });
}

function standardDeviation(values: number[]) {
  if (values.length <= 1) {
    return 0;
  }
  const mean = average(values);
  const variance = average(values.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance);
}

function peakIndices(values: number[]) {
  const smoothed = movingAverage(values, 2);
  const minimum = Math.min(...smoothed);
  const maximum = Math.max(...smoothed);
  const threshold = minimum + (maximum - minimum) * 0.55;
  const peaks: number[] = [];

  for (let index = 1; index < smoothed.length - 1; index += 1) {
    if (
      smoothed[index] > smoothed[index - 1] &&
      smoothed[index] >= smoothed[index + 1] &&
      smoothed[index] >= threshold &&
      index - (peaks.at(-1) ?? -99) > 2
    ) {
      peaks.push(index);
    }
  }

  if (!peaks.length && maximum - minimum > 0.3 && values.length > 4) {
    const maxIndex = smoothed.indexOf(maximum);
    if (maxIndex >= 0) {
      peaks.push(maxIndex);
    }
  }

  return peaks;
}

async function waitForEvent(target: EventTarget, eventName: string) {
  return new Promise<void>((resolve) => {
    target.addEventListener(eventName, () => resolve(), { once: true });
  });
}

async function loadVideo(file: File) {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = "anonymous";
  await waitForEvent(video, "loadedmetadata");
  return { video, url };
}

function brightnessFromCanvas(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return 0;
  }

  const { width, height } = canvas;
  const { data } = context.getImageData(0, 0, width, height);
  let luminance = 0;

  for (let index = 0; index < data.length; index += 16) {
    luminance += data[index] * 0.2126 + data[index + 1] * 0.7152 + data[index + 2] * 0.0722;
  }

  return luminance / (data.length / 16);
}

function landmarkVisibilityScore(landmarks: Array<{ visibility?: number }> | undefined) {
  if (!landmarks?.length) {
    return 0;
  }

  const keypoints = [11, 12, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32];
  return average(keypoints.map((index) => landmarks[index]?.visibility ?? 0));
}

function footAngle(
  heel: { x: number; y: number } | undefined,
  foot: { x: number; y: number } | undefined,
) {
  if (!heel || !foot) {
    return 0;
  }
  return (Math.atan2(foot.y - heel.y, foot.x - heel.x) * 180) / Math.PI;
}

function sampleMetricFromLandmarks(
  landmarks: Array<{ x: number; y: number; visibility?: number }> | undefined,
  baselineHeelY: number | null,
) {
  if (!landmarks?.length) {
    return { valid: false } as const;
  }

  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  const leftKnee = landmarks[25];
  const rightKnee = landmarks[26];
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];
  const leftHeel = landmarks[29];
  const rightHeel = landmarks[30];
  const leftFoot = landmarks[31];
  const rightFoot = landmarks[32];

  if (!leftShoulder || !rightShoulder || !leftHip || !rightHip || !leftKnee || !rightKnee || !leftAnkle || !rightAnkle) {
    return { valid: false } as const;
  }

  const shoulderCenterX = average([leftShoulder.x, rightShoulder.x]);
  const shoulderCenterY = average([leftShoulder.y, rightShoulder.y]);
  const hipCenterX = average([leftHip.x, rightHip.x]);
  const hipCenterY = average([leftHip.y, rightHip.y]);
  const kneeCenterY = average([leftKnee.y, rightKnee.y]);
  const ankleCenterY = average([leftAnkle.y, rightAnkle.y]);
  const ankleCenterX = average([leftAnkle.x, rightAnkle.x]);

  const depth = (hipCenterY - kneeCenterY) / Math.max(ankleCenterY - kneeCenterY, 0.001);
  const torsoLean =
    (Math.atan2(Math.abs(shoulderCenterX - hipCenterX), Math.max(hipCenterY - shoulderCenterY, 0.001)) *
      180) /
    Math.PI;
  const lateralTilt = torsoLean;
  const hipShift = hipCenterX - ankleCenterX;
  const kneeValgusLeft = leftKnee.x - leftAnkle.x;
  const kneeValgusRight = rightAnkle.x - rightKnee.x;
  const heelAverage = average([leftHeel?.y ?? leftAnkle.y, rightHeel?.y ?? rightAnkle.y]);
  const heelLift = baselineHeelY === null ? 0 : Math.max(0, baselineHeelY - heelAverage);
  const toeAngleDelta = Math.abs(
    Math.abs(footAngle(leftHeel, leftFoot)) - Math.abs(footAngle(rightHeel, rightFoot)),
  );

  return {
    valid: landmarkVisibilityScore(landmarks) >= 0.4,
    depth,
    torsoLean,
    lateralTilt,
    hipShift,
    kneeValgusLeft,
    kneeValgusRight,
    heelLift,
    toeAngleDelta,
  } as const;
}

function aggregateMetrics(samples: SampleMetric[]) {
  const valid = samples.filter((sample) => sample.valid);
  const depths = valid.map((sample) => sample.depth);
  const peakFrames = peakIndices(depths);
  const timestamps = samples.map((sample) => round(sample.time, 2));
  const firstChunk = valid.slice(0, Math.max(1, Math.floor(valid.length / 3)));
  const lastChunk = valid.slice(-Math.max(1, Math.floor(valid.length / 3)));
  const earlyInstability = average(
    firstChunk.map((sample) => Math.abs(sample.hipShift) + Math.abs(sample.kneeValgusLeft) + Math.abs(sample.kneeValgusRight)),
  );
  const lateInstability = average(
    lastChunk.map((sample) => Math.abs(sample.hipShift) + Math.abs(sample.kneeValgusLeft) + Math.abs(sample.kneeValgusRight)),
  );
  const durations = peakFrames
    .map((frame, index) => {
      const previous = peakFrames[index - 1];
      if (previous === undefined) {
        return 0;
      }
      return valid[frame]?.time - valid[previous]?.time;
    })
    .filter((duration) => duration > 0);

  const repSeries = (peakFrames.length ? peakFrames : valid.map((_, index) => index))
    .slice(0, 6)
    .map((frameIndex, index) => {
      const sample = valid[frameIndex] ?? valid[index];
      return {
        rep: index + 1,
        depth: round(sample?.depth ?? 0, 2),
        symmetry: round(Math.abs((sample?.kneeValgusLeft ?? 0) - (sample?.kneeValgusRight ?? 0)), 3),
        torsoLean: round(sample?.torsoLean ?? 0, 1),
        hipShift: round(sample?.hipShift ?? 0, 3),
      };
    });

  const warnings: string[] = [];
  const validFrameRatio = valid.length / Math.max(samples.length, 1);
  const brightness = average(samples.map((sample) => sample.brightness));

  if (brightness < 70) {
    warnings.push("조도가 낮아 분석 신뢰도가 떨어질 수 있습니다.");
  }
  if (validFrameRatio < 0.55) {
    warnings.push("랜드마크 검출 품질이 낮아 판단 유보 항목이 포함될 수 있습니다.");
  }
  if (peakFrames.length < 3) {
    warnings.push("스쿼트 반복 수가 적어 패턴 해석이 제한적입니다.");
  }

  return {
    validFrameRatio: round(validFrameRatio, 3),
    brightness: round(brightness, 1),
    depthPeak: round(Math.max(...depths, 0), 3),
    heelLiftPeak: round(Math.max(...valid.map((sample) => sample.heelLift), 0), 3),
    toeAngleDelta: round(Math.max(...valid.map((sample) => sample.toeAngleDelta), 0), 1),
    maxTorsoLean: round(Math.max(...valid.map((sample) => sample.torsoLean), 0), 1),
    lateralTiltPeak: round(Math.max(...valid.map((sample) => sample.lateralTilt), 0), 1),
    avgHipShift: round(average(valid.map((sample) => sample.hipShift)), 3),
    avgKneeValgusLeft: round(average(valid.map((sample) => sample.kneeValgusLeft)), 3),
    avgKneeValgusRight: round(average(valid.map((sample) => sample.kneeValgusRight)), 3),
    lateRepInstabilityDelta: round(lateInstability - earlyInstability, 3),
    rhythmVariation: round(standardDeviation(durations), 3),
    repSeries,
    repCountEstimate: peakFrames.length,
    analysisQuality:
      validFrameRatio > 0.76 ? "good" : validFrameRatio > 0.48 ? "fair" : "poor",
    warnings,
    sampledFrames: samples.length,
    validFrames: valid.length,
    timestamps,
  } satisfies AggregateMetrics;
}

function createFinding(
  sessionId: string,
  view: ViewType,
  input: Omit<Finding, "id" | "assessmentSessionId" | "createdAt" | "sourceView">,
) {
  return {
    ...input,
    id: nanoid(),
    assessmentSessionId: sessionId,
    sourceView: view,
    createdAt: new Date().toISOString(),
  } satisfies Finding;
}

function createRecommendedTest(
  sessionId: string,
  view: ViewType,
  priorityOrder: number,
  testCode: string,
  reasonKo: string,
) {
  const template = TEST_TEMPLATE_MAP[testCode];
  return {
    id: nanoid(),
    assessmentSessionId: sessionId,
    sourceView: view,
    testCode,
    testNameKo: template?.nameKo ?? testCode,
    priorityOrder,
    reasonKo,
    status: "recommended",
    createdAt: new Date().toISOString(),
  } satisfies RecommendedTest;
}

function deriveInsights(sessionId: string, view: ViewType, aggregate: AggregateMetrics) {
  const findings: Finding[] = [];
  const recs = new Map<string, string>();

  const addRec = (testCode: string, reason: string) => {
    if (!recs.has(testCode)) {
      recs.set(testCode, reason);
    }
  };

  if (view !== "side") {
    if (aggregate.avgKneeValgusLeft > 0.026) {
      findings.push(
        createFinding(sessionId, view, {
          code: "left_knee_valgus",
          labelKo: "좌측 무릎 내측 이동 경향",
          category: "observation",
          severity: aggregate.avgKneeValgusLeft > 0.045 ? "high" : "medium",
          confidence: aggregate.validFrameRatio > 0.72 ? "high" : "medium",
          descriptionKo: "하강 후반부와 최하단 구간에서 좌측 무릎이 안쪽으로 모이는 패턴이 관찰되었습니다.",
          rationaleKo: "좌측 무릎-발목 정렬 차이가 반복적으로 중간선 쪽으로 이동했습니다.",
          isHiddenByTrainer: false,
        }),
      );
      findings.push(
        createFinding(sessionId, view, {
          code: "left_foot_or_hip_control",
          labelKo: "좌측 발 안정성 또는 고관절 제어 확인 필요 가능성",
          category: "hypothesis",
          severity: "medium",
          confidence: "medium",
          descriptionKo: "좌측 지지 안정성 또는 좌측 고관절 제어 패턴에 대한 추가 확인이 필요해 보입니다.",
          rationaleKo: "무릎 정렬 변화만으로 원인을 구분하기 어려워 추가 검사 권장이 필요합니다.",
          isHiddenByTrainer: false,
        }),
      );
      addRec("single_leg_squat", "단일지지 안정성과 좌우 제어 차이 구분이 필요합니다.");
      addRec("knee_to_wall", "발목 가동성 영향 여부를 함께 확인하기 위함입니다.");
      addRec("short_foot_resquat", "발 안정성 개입 시 변화 여부를 확인하기 위함입니다.");
    }

    if (aggregate.avgKneeValgusRight > 0.026) {
      findings.push(
        createFinding(sessionId, view, {
          code: "right_knee_valgus",
          labelKo: "우측 무릎 내측 이동 경향",
          category: "observation",
          severity: aggregate.avgKneeValgusRight > 0.045 ? "high" : "medium",
          confidence: aggregate.validFrameRatio > 0.72 ? "high" : "medium",
          descriptionKo: "하강 후반부와 최하단 구간에서 우측 무릎이 안쪽으로 모이는 패턴이 관찰되었습니다.",
          rationaleKo: "우측 무릎-발목 정렬 차이가 반복적으로 중간선 쪽으로 이동했습니다.",
          isHiddenByTrainer: false,
        }),
      );
      addRec("single_leg_squat", "우측 단일지지 안정성과 제어 패턴 확인이 필요합니다.");
      addRec("knee_to_wall", "우측 발목 가동성 영향 여부를 함께 확인하기 위함입니다.");
      addRec("short_foot_resquat", "우측 발 안정성 개입 시 변화 여부를 확인하기 위함입니다.");
    }

    if (Math.abs(aggregate.avgHipShift) > 0.024) {
      const side = aggregate.avgHipShift > 0 ? "우측" : "좌측";
      findings.push(
        createFinding(sessionId, view, {
          code: "hip_shift_bias",
          labelKo: `${side} 지지 편향 의심`,
          category: "observation",
          severity: Math.abs(aggregate.avgHipShift) > 0.04 ? "high" : "medium",
          confidence: "medium",
          descriptionKo: `반복 중 골반 중심이 ${side}으로 치우치는 경향이 관찰되었습니다.`,
          rationaleKo: "골반 중심과 발목 중간선의 좌우 차이가 반복적으로 유지되었습니다.",
          isHiddenByTrainer: false,
        }),
      );
      findings.push(
        createFinding(sessionId, view, {
          code: "support_bias_hypothesis",
          labelKo: `${side} 지지 편향 가능성`,
          category: "hypothesis",
          severity: "medium",
          confidence: "medium",
          descriptionKo: `${side} 단일지지 안정성 또는 반대측 제어 전략 차이에 대한 확인이 필요합니다.`,
          rationaleKo: "편측 체중 편향은 단일지지 안정성과 고관절 회전 차이의 영향을 함께 받을 수 있습니다.",
          isHiddenByTrainer: false,
        }),
      );
      addRec("single_leg_stance", "편측 지지 안정성을 구분하기 위함입니다.");
      addRec("single_leg_squat", "편측 로딩 시 제어 전략 차이를 확인하기 위함입니다.");
      addRec("hip_90_90", "고관절 회전 차이 여부를 함께 보기 위함입니다.");
    }

    if (aggregate.toeAngleDelta > 18) {
      findings.push(
        createFinding(sessionId, view, {
          code: "toe_angle_asymmetry",
          labelKo: "발끝 방향 좌우 차이",
          category: "observation",
          severity: "low",
          confidence: "medium",
          descriptionKo: "시작 자세 기준 발끝 방향의 좌우 차이가 관찰되었습니다.",
          rationaleKo: "좌우 발끝 벡터 각도 차이가 기준값보다 크게 나타났습니다.",
          isHiddenByTrainer: false,
        }),
      );
      findings.push(
        createFinding(sessionId, view, {
          code: "hip_rotation_hypothesis",
          labelKo: "고관절 회전 제한 확인 필요 가능성",
          category: "hypothesis",
          severity: "low",
          confidence: "low",
          descriptionKo: "발 자체의 안정성 문제인지, 고관절 회전 차이 영향인지 구분이 필요합니다.",
          rationaleKo: "시작 자세의 발끝 방향 차이만으로 원인을 단정할 수 없기 때문입니다.",
          isHiddenByTrainer: false,
        }),
      );
      addRec("hip_90_90", "고관절 회전 차이 여부를 확인하기 위함입니다.");
      addRec("short_foot_resquat", "발 안정성 개입 시 패턴 변화 여부를 보기 위함입니다.");
    }
  }

  if (view === "side") {
    if (aggregate.maxTorsoLean > 24) {
      findings.push(
        createFinding(sessionId, view, {
          code: "torso_lean_forward",
          labelKo: "하강 후반부 몸통 전방경사 증가",
          category: "observation",
          severity: aggregate.maxTorsoLean > 31 ? "high" : "medium",
          confidence: aggregate.validFrameRatio > 0.7 ? "high" : "medium",
          descriptionKo: "깊은 구간에서 몸통 전방경사가 증가하는 패턴이 관찰되었습니다.",
          rationaleKo: "어깨 중심과 골반 중심의 기울기 각도가 기준값을 넘었습니다.",
          isHiddenByTrainer: false,
        }),
      );
      findings.push(
        createFinding(sessionId, view, {
          code: "depth_control_hypothesis",
          labelKo: "하강 말기 제어 저하 가능성",
          category: "hypothesis",
          severity: "medium",
          confidence: "medium",
          descriptionKo: "깊은 구간 제어 전략과 발목 영향 여부를 함께 확인할 필요가 있습니다.",
          rationaleKo: "몸통 전방경사 증가는 깊은 구간 제어 저하 또는 발목 제한의 영향을 함께 받을 수 있습니다.",
          isHiddenByTrainer: false,
        }),
      );
      addRec("heel_elevated_resquat", "발목 가동성 영향 여부를 빠르게 확인하기 위함입니다.");
      addRec("knee_to_wall", "발목 가동성 제한 여부를 확인하기 위함입니다.");
      addRec("single_leg_stance", "깊은 구간 제어와 지지 안정성을 함께 보기 위함입니다.");
    }

    if (aggregate.heelLiftPeak > 0.016) {
      findings.push(
        createFinding(sessionId, view, {
          code: "heel_lift_proxy",
          labelKo: "발뒤꿈치 들림 프록시",
          category: "observation",
          severity: "medium",
          confidence: "medium",
          descriptionKo: "최하단 구간에서 발뒤꿈치가 들리는 프록시가 관찰되었습니다.",
          rationaleKo: "초기 프레임 대비 뒤꿈치 랜드마크 높이 변화가 기준값을 넘었습니다.",
          isHiddenByTrainer: false,
        }),
      );
      addRec("knee_to_wall", "발목 가동성 영향 여부를 확인하기 위함입니다.");
      addRec("heel_elevated_resquat", "발목 개입 시 개선 여부를 확인하기 위함입니다.");
    }

    if (aggregate.lateRepInstabilityDelta > 0.03 || aggregate.rhythmVariation > 0.35) {
      findings.push(
        createFinding(sessionId, view, {
          code: "late_phase_control_drop",
          labelKo: "깊은 구간에서 제어 저하 의심",
          category: "observation",
          severity: "medium",
          confidence: "medium",
          descriptionKo: "후반 반복에서 속도와 정렬 일관성이 떨어지는 경향이 관찰되었습니다.",
          rationaleKo: "후반 구간의 정렬 편차가 초반보다 크게 증가했습니다.",
          isHiddenByTrainer: false,
        }),
      );
      addRec("single_leg_stance", "후반부 안정성 저하가 단일지지 제어와 연결되는지 확인하기 위함입니다.");
    }
  }

  if (view !== "side" && aggregate.lateRepInstabilityDelta > 0.03) {
    findings.push(
      createFinding(sessionId, view, {
        code: "late_rep_asymmetry",
        labelKo: "후반 반복에서 좌우 정렬 흔들림 증가",
        category: "observation",
        severity: "medium",
        confidence: "medium",
        descriptionKo: "후반 반복에서 비대칭 정렬이 더 커지는 경향이 관찰되었습니다.",
        rationaleKo: "후반 프레임의 좌우 정렬 편차가 초반보다 더 크게 나타났습니다.",
        isHiddenByTrainer: false,
      }),
    );
  }

  if (!findings.length) {
    findings.push(
      createFinding(sessionId, view, {
        code: "analysis_inconclusive",
        labelKo: "판단 유보",
        category: "observation",
        severity: "low",
        confidence: "low",
        descriptionKo: "현재 영상에서는 확신도 높은 비대칭 패턴을 제한적으로만 확인했습니다.",
        rationaleKo: "촬영 품질 또는 움직임 편차가 작아 강한 패턴을 만들지 않았습니다.",
        isHiddenByTrainer: false,
      }),
    );
  }

  return {
    findings,
    recommendedTests: [...recs.entries()].map(([testCode, reasonKo], index) =>
      createRecommendedTest(sessionId, view, index + 1, testCode, reasonKo),
    ),
  };
}

export async function analyzeSquatVideo(
  file: File,
  view: ViewType,
  sessionId: string,
  onProgress?: (value: number) => void,
) {
  const timestamp = new Date().toISOString();
  const landmarker = await getPoseLandmarker();
  const { video, url } = await loadVideo(file);
  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = Math.max(180, Math.round((video.videoHeight / Math.max(video.videoWidth, 1)) * 320));
  const context = canvas.getContext("2d");

  const sampleCount = Math.max(18, Math.min(60, Math.round(video.duration * 4)));
  const samples: SampleMetric[] = [];
  let baselineHeelY: number | null = null;

  try {
    for (let index = 0; index < sampleCount; index += 1) {
      const time = (video.duration * index) / Math.max(sampleCount - 1, 1);
      video.currentTime = Math.min(time, Math.max(video.duration - 0.05, 0));
      await waitForEvent(video, "seeked");

      context?.drawImage(video, 0, 0, canvas.width, canvas.height);
      const brightness = brightnessFromCanvas(canvas);
      const result = landmarker?.detectForVideo(video, time * 1000);
      const landmarks = result?.landmarks?.[0];
      if (baselineHeelY === null && landmarks?.[29] && landmarks?.[30]) {
        baselineHeelY = average([landmarks[29].y, landmarks[30].y]);
      }

      const metric = sampleMetricFromLandmarks(landmarks, baselineHeelY);
      samples.push({
        time,
        brightness,
        valid: metric.valid,
        depth: metric.valid ? metric.depth : 0,
        hipShift: metric.valid ? metric.hipShift : 0,
        torsoLean: metric.valid ? metric.torsoLean : 0,
        lateralTilt: metric.valid ? metric.lateralTilt : 0,
        kneeValgusLeft: metric.valid ? metric.kneeValgusLeft : 0,
        kneeValgusRight: metric.valid ? metric.kneeValgusRight : 0,
        heelLift: metric.valid ? metric.heelLift : 0,
        toeAngleDelta: metric.valid ? metric.toeAngleDelta : 0,
      });
      onProgress?.((index + 1) / sampleCount);
    }

    const aggregate = aggregateMetrics(samples);
    const insights = deriveInsights(sessionId, view, aggregate);

    const analysis = {
      id: nanoid(),
      assessmentSessionId: sessionId,
      sourceView: view,
      repCountEstimate: aggregate.repCountEstimate,
      analysisQuality: aggregate.analysisQuality,
      metricsJson: {
        brightness: aggregate.brightness,
        validFrameRatio: aggregate.validFrameRatio,
        depthPeak: aggregate.depthPeak,
        heelLiftPeak: aggregate.heelLiftPeak,
        toeAngleDelta: aggregate.toeAngleDelta,
        maxTorsoLean: aggregate.maxTorsoLean,
        lateralTiltPeak: aggregate.lateralTiltPeak,
        avgHipShift: aggregate.avgHipShift,
        avgKneeValgusLeft: aggregate.avgKneeValgusLeft,
        avgKneeValgusRight: aggregate.avgKneeValgusRight,
        lateRepInstabilityDelta: aggregate.lateRepInstabilityDelta,
        rhythmVariation: aggregate.rhythmVariation,
        warnings: aggregate.warnings,
        rawFrameCount: aggregate.sampledFrames,
        analyzedFrameCount: aggregate.validFrames,
        repSeries: aggregate.repSeries,
      },
      rawLandmarkSummaryJson: {
        sampledFrames: aggregate.sampledFrames,
        validFrames: aggregate.validFrames,
        timestamps: aggregate.timestamps,
      },
      createdAt: timestamp,
    } satisfies VideoAnalysisResult;

    return {
      analysis,
      findings: insights.findings,
      recommendedTests: insights.recommendedTests,
    } satisfies AnalyzerOutput;
  } catch {
    const analysis = {
      id: nanoid(),
      assessmentSessionId: sessionId,
      sourceView: view,
      repCountEstimate: 0,
      analysisQuality: "poor",
      metricsJson: {
        brightness: 0,
        validFrameRatio: 0,
        depthPeak: 0,
        heelLiftPeak: 0,
        toeAngleDelta: 0,
        maxTorsoLean: 0,
        lateralTiltPeak: 0,
        avgHipShift: 0,
        avgKneeValgusLeft: 0,
        avgKneeValgusRight: 0,
        lateRepInstabilityDelta: 0,
        rhythmVariation: 0,
        warnings: ["영상 분석을 완료하지 못했습니다. 재촬영 또는 수동 검토를 권장합니다."],
        rawFrameCount: 0,
        analyzedFrameCount: 0,
        repSeries: [],
      },
      rawLandmarkSummaryJson: {
        sampledFrames: 0,
        validFrames: 0,
        timestamps: [],
      },
      createdAt: timestamp,
    } satisfies VideoAnalysisResult;

    return {
      analysis,
      findings: [
        createFinding(sessionId, view, {
          code: "analysis_inconclusive",
          labelKo: "판단 유보",
          category: "observation",
          severity: "low",
          confidence: "low",
          descriptionKo: "영상 분석을 완료하지 못해 수동 확인이 필요합니다.",
          rationaleKo: "포즈 추정기 초기화 또는 프레임 추출 단계에서 오류가 발생했습니다.",
          isHiddenByTrainer: false,
        }),
      ],
      recommendedTests: [],
    } satisfies AnalyzerOutput;
  } finally {
    URL.revokeObjectURL(url);
  }
}
