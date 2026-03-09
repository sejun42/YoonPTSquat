import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import type {
  AnalysisMetrics,
  FinalSummary,
  RawLandmarkSummary,
  ReportSnapshot,
} from "@/lib/types";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const clients = pgTable("clients", {
  id: uuid("id").defaultRandom().primaryKey(),
  trainerId: uuid("trainer_id")
    .references(() => users.id)
    .notNull(),
  name: text("name").notNull(),
  phoneOrIdentifier: text("phone_or_identifier"),
  memo: text("memo"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const assessmentSessions = pgTable("assessment_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  trainerId: uuid("trainer_id")
    .references(() => users.id)
    .notNull(),
  clientId: uuid("client_id")
    .references(() => clients.id)
    .notNull(),
  movementType: text("movement_type").notNull().default("bodyweight_squat"),
  selectedView: text("selected_view").notNull(),
  status: text("status").notNull().default("draft"),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
  overallSummary: text("overall_summary").notNull().default(""),
  trainerNote: text("trainer_note").notNull().default(""),
  analysisVersion: text("analysis_version").notNull().default("mvp-rule-engine-v1"),
  summaryDraftJson: jsonb("summary_draft_json").$type<FinalSummary | null>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const videoAnalysisResults = pgTable("video_analysis_results", {
  id: uuid("id").defaultRandom().primaryKey(),
  assessmentSessionId: uuid("assessment_session_id")
    .references(() => assessmentSessions.id)
    .notNull(),
  repCountEstimate: integer("rep_count_estimate").notNull().default(0),
  analysisQuality: text("analysis_quality").notNull().default("poor"),
  metricsJson: jsonb("metrics_json").$type<AnalysisMetrics>().notNull(),
  rawLandmarkSummaryJson:
    jsonb("raw_landmark_summary_json").$type<RawLandmarkSummary>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const findings = pgTable("findings", {
  id: uuid("id").defaultRandom().primaryKey(),
  assessmentSessionId: uuid("assessment_session_id")
    .references(() => assessmentSessions.id)
    .notNull(),
  code: text("code").notNull(),
  labelKo: text("label_ko").notNull(),
  category: text("category").notNull(),
  severity: text("severity").notNull(),
  confidence: text("confidence").notNull(),
  descriptionKo: text("description_ko").notNull(),
  rationaleKo: text("rationale_ko").notNull(),
  sourceView: text("source_view").notNull(),
  isHiddenByTrainer: boolean("is_hidden_by_trainer").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const recommendedTests = pgTable("recommended_tests", {
  id: uuid("id").defaultRandom().primaryKey(),
  assessmentSessionId: uuid("assessment_session_id")
    .references(() => assessmentSessions.id)
    .notNull(),
  testCode: text("test_code").notNull(),
  testNameKo: text("test_name_ko").notNull(),
  priorityOrder: integer("priority_order").notNull(),
  reasonKo: text("reason_ko").notNull(),
  status: text("status").notNull().default("recommended"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const testResults = pgTable("test_results", {
  id: uuid("id").defaultRandom().primaryKey(),
  assessmentSessionId: uuid("assessment_session_id")
    .references(() => assessmentSessions.id)
    .notNull(),
  testCode: text("test_code").notNull(),
  testNameKo: text("test_name_ko").notNull(),
  side: text("side").notNull(),
  resultLabel: text("result_label").notNull(),
  resultValueJson: jsonb("result_value_json").notNull(),
  memo: text("memo").notNull().default(""),
  performed: boolean("performed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const reports = pgTable("reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  assessmentSessionId: uuid("assessment_session_id")
    .references(() => assessmentSessions.id)
    .notNull(),
  shareToken: text("share_token").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  reportSnapshotJson: jsonb("report_snapshot_json").$type<ReportSnapshot>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
