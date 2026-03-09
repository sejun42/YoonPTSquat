import "server-only";

import { promises as fs } from "fs";
import path from "path";

import type {
  AssessmentSession,
  Client,
  Finding,
  Report,
  RecommendedTest,
  TestResult,
  User,
  VideoAnalysisResult,
} from "@/lib/types";

interface DatabaseSnapshot {
  users: User[];
  clients: Client[];
  assessmentSessions: AssessmentSession[];
  videoAnalysisResults: VideoAnalysisResult[];
  findings: Finding[];
  recommendedTests: RecommendedTest[];
  testResults: TestResult[];
  reports: Report[];
}

const DB_PATH = path.join(process.cwd(), "data", "demo-db.json");

const DEFAULT_DB: DatabaseSnapshot = {
  users: [],
  clients: [],
  assessmentSessions: [],
  videoAnalysisResults: [],
  findings: [],
  recommendedTests: [],
  testResults: [],
  reports: [],
};

let queue: Promise<unknown> = Promise.resolve();

async function ensureDbFile() {
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true });

  try {
    await fs.access(DB_PATH);
  } catch {
    await fs.writeFile(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2), "utf8");
  }
}

export async function readDb() {
  await ensureDbFile();
  const raw = await fs.readFile(DB_PATH, "utf8");
  return JSON.parse(raw) as DatabaseSnapshot;
}

export async function mutateDb<T>(
  mutator: (db: DatabaseSnapshot) => Promise<T> | T,
) {
  const operation = queue.then(async () => {
    await ensureDbFile();
    const db = await readDb();
    const result = await mutator(db);
    await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf8");
    return result;
  });

  queue = operation.then(
    () => undefined,
    () => undefined,
  );

  return operation;
}
