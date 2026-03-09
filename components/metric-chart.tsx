"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { VideoAnalysisResult } from "@/lib/types";

export function MetricChart({
  analysis,
}: {
  analysis: VideoAnalysisResult;
}) {
  if (!analysis.metricsJson.repSeries.length) {
    return null;
  }

  return (
    <div className="h-60 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={analysis.metricsJson.repSeries}
          margin={{ top: 8, right: 8, left: -22, bottom: 0 }}
        >
          <CartesianGrid stroke="rgba(58,41,22,0.1)" strokeDasharray="3 3" />
          <XAxis dataKey="rep" stroke="rgba(98,88,74,0.8)" fontSize={12} />
          <YAxis stroke="rgba(98,88,74,0.8)" fontSize={12} />
          <Tooltip
            contentStyle={{
              background: "rgba(255, 250, 241, 0.96)",
              borderRadius: 18,
              border: "1px solid rgba(58, 41, 22, 0.12)",
            }}
          />
          <Line
            type="monotone"
            dataKey="depth"
            stroke="#c75a1b"
            strokeWidth={3}
            dot={{ r: 3 }}
            name="깊이 프록시"
          />
          <Line
            type="monotone"
            dataKey="torsoLean"
            stroke="#8d2d11"
            strokeWidth={2}
            dot={false}
            name="몸통 기울기"
          />
          <Line
            type="monotone"
            dataKey="symmetry"
            stroke="#2f7d5c"
            strokeWidth={2}
            dot={false}
            name="좌우 차이"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
