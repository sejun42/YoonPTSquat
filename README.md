# Yoon PT Squat

트레이너 전용 맨몸 스쿼트 스크리닝 PWA입니다. 휴대폰 카메라 또는 기존 영상으로 스쿼트를 분석하고, 추가 검사 결과와 메모를 합쳐 읽기 전용 리포트 링크를 발행합니다.

## 핵심 원칙

- 운동 종목은 `맨몸 스쿼트` 한 가지만 지원합니다.
- 원본 영상은 서버에 저장하지 않습니다.
- 회원은 로그인하지 않고, 공개 토큰 기반 리포트 링크만 열람합니다.
- 결과 표현은 `관찰 결과 / 의심 패턴 / 추가 검사 권장` 중심으로 제한합니다.

## 스택

- Next.js 15 App Router
- TypeScript
- Tailwind CSS
- Recharts
- MediaPipe Pose Landmarker
- Supabase 연동 준비 코드 + Drizzle 스키마
- 기본 실행 저장소: 파일 기반 데모 DB (`data/demo-db.json`)

## 실행

```bash
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 을 엽니다.

## 검증

```bash
npm run lint
npm run check
npm run build
```

## 환경 변수

`.env.example` 기준으로 설정합니다.

- `DATABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_MEDIAPIPE_POSE_MODEL_URL`

환경 변수가 없으면 데모 로그인 + 파일 기반 저장소로 동작합니다.

## Supabase 연결

1. Supabase 프로젝트를 만든 뒤 Auth Email 로그인과 Redirect URL을 설정합니다.
2. [supabase/schema.sql](/D:/YoonPTSquat/supabase/schema.sql)을 SQL Editor에서 실행합니다.
3. `.env.local`에 Supabase URL, publishable key, site URL을 채웁니다.
4. `npm run dev`로 실행한 뒤 로그인 화면에서 매직링크를 전송합니다.

Supabase 환경변수가 있으면:

- 로그인은 이메일 매직링크 기반으로 동작합니다.
- `public.users` / `clients` / `assessment_sessions` 이하 테이블을 사용합니다.
- 공개 리포트는 `get_public_report()` 함수로 읽기 전용 토큰 조회를 처리합니다.

## 현재 포함된 흐름

1. 트레이너 이메일 로그인
2. 회원 생성 / 검색 / 상세 조회
3. 새 평가 세션 생성
4. 카메라 촬영 또는 갤러리 영상 선택
5. 클라이언트 측 MediaPipe 기반 규칙 분석
6. 자동 감지 패턴 숨김 / 수동 패턴 추가
7. 추천 검사 입력 + 수동 검사 추가
8. 최종 요약 수정
9. 공유 리포트 발행 / 재발행 / 비활성화
10. 회원용 읽기 전용 리포트 조회
