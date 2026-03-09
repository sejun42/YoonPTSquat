import "server-only";

import { hasSupabaseEnv } from "@/lib/supabase/config";
import * as local from "@/lib/data/local-repository";
import * as remote from "@/lib/data/supabase-repository";

const shouldUseSupabase = () => hasSupabaseEnv();

export async function upsertTrainer(email: string) {
  if (shouldUseSupabase()) {
    return remote.upsertTrainer(email);
  }
  return local.upsertTrainer(email);
}

export async function createClient(
  trainerId: string,
  input: Parameters<typeof local.createClient>[1],
) {
  if (shouldUseSupabase()) {
    return remote.createClient(trainerId, input);
  }
  return local.createClient(trainerId, input);
}

export async function getClients(trainerId: string, search = "") {
  if (shouldUseSupabase()) {
    return remote.getClients(trainerId, search);
  }
  return local.getClients(trainerId, search);
}

export async function getClientDetail(trainerId: string, clientId: string) {
  if (shouldUseSupabase()) {
    return remote.getClientDetail(trainerId, clientId);
  }
  return local.getClientDetail(trainerId, clientId);
}

export async function createAssessmentSession(
  trainerId: string,
  input: Parameters<typeof local.createAssessmentSession>[1],
) {
  if (shouldUseSupabase()) {
    return remote.createAssessmentSession(trainerId, input);
  }
  return local.createAssessmentSession(trainerId, input);
}

export async function getSessionDetail(trainerId: string, sessionId: string) {
  if (shouldUseSupabase()) {
    return remote.getSessionDetail(trainerId, sessionId);
  }
  return local.getSessionDetail(trainerId, sessionId);
}

export async function saveSessionDraft(
  trainerId: string,
  sessionId: string,
  payload: Parameters<typeof local.saveSessionDraft>[2],
) {
  if (shouldUseSupabase()) {
    return remote.saveSessionDraft(trainerId, sessionId, payload);
  }
  return local.saveSessionDraft(trainerId, sessionId, payload);
}

export async function getDashboardData(trainerId: string, search = "") {
  if (shouldUseSupabase()) {
    return remote.getDashboardData(trainerId, search);
  }
  return local.getDashboardData(trainerId, search);
}

export async function publishReport(
  trainerId: string,
  sessionId: string,
  options: Parameters<typeof local.publishReport>[2],
) {
  if (shouldUseSupabase()) {
    return remote.publishReport(trainerId, sessionId, options);
  }
  return local.publishReport(trainerId, sessionId, options);
}

export async function deactivateReport(trainerId: string, reportId: string) {
  if (shouldUseSupabase()) {
    return remote.deactivateReport(trainerId, reportId);
  }
  return local.deactivateReport(trainerId, reportId);
}

export async function getReportByToken(token: string) {
  if (shouldUseSupabase()) {
    return remote.getReportByToken(token);
  }
  return local.getReportByToken(token);
}

export const createManualTestResult = local.createManualTestResult;
