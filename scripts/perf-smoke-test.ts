/**
 * Performance Smoke Test Script
 *
 * This script makes requests to key API endpoints and reports timing metrics.
 * Run with: npx tsx scripts/perf-smoke-test.ts
 *
 * Requires:
 * - NEXTAUTH_URL environment variable (or defaults to http://localhost:3000)
 * - A valid session cookie (or use with --local flag for unauthenticated tests)
 */

const BASE_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";

interface TimingResult {
  endpoint: string;
  statusCode: number;
  totalMs: number;
  serverTiming?: Record<string, number>;
  payloadSize: number;
}

async function measureEndpoint(
  endpoint: string,
  options: RequestInit = {}
): Promise<TimingResult> {
  const url = `${BASE_URL}${endpoint}${endpoint.includes("?") ? "&" : "?"}perf=1`;
  const start = performance.now();

  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      "Content-Type": "application/json",
    },
  });

  const totalMs = performance.now() - start;
  const text = await res.text();

  // Parse Server-Timing header
  const serverTimingHeader = res.headers.get("Server-Timing");
  const serverTiming: Record<string, number> = {};
  if (serverTimingHeader) {
    serverTimingHeader.split(",").forEach((part) => {
      const match = part.trim().match(/^(\w+);dur=([0-9.]+)/);
      if (match) {
        serverTiming[match[1]] = parseFloat(match[2]);
      }
    });
  }

  return {
    endpoint,
    statusCode: res.status,
    totalMs,
    serverTiming: Object.keys(serverTiming).length > 0 ? serverTiming : undefined,
    payloadSize: text.length,
  };
}

function formatResult(result: TimingResult): string {
  const lines = [
    `\n📍 ${result.endpoint}`,
    `   Status: ${result.statusCode}`,
    `   Total: ${result.totalMs.toFixed(1)}ms`,
    `   Payload: ${(result.payloadSize / 1024).toFixed(1)}KB`,
  ];

  if (result.serverTiming) {
    lines.push(`   Server-Timing:`);
    for (const [key, value] of Object.entries(result.serverTiming)) {
      lines.push(`     - ${key}: ${value.toFixed(1)}ms`);
    }
  }

  return lines.join("\n");
}

async function runSmokeTest() {
  console.log("🚀 Performance Smoke Test");
  console.log(`   Base URL: ${BASE_URL}`);
  console.log("   Date: " + new Date().toISOString());
  console.log("\n" + "=".repeat(60));

  const endpoints = [
    // Tasks list with different views
    "/api/tasks?page=1&pageSize=10&view=default",
    "/api/tasks?page=1&pageSize=10&view=projectLists",
    "/api/tasks?page=1&pageSize=10&view=dashboard",
  ];

  const results: TimingResult[] = [];

  for (const endpoint of endpoints) {
    try {
      const result = await measureEndpoint(endpoint);
      results.push(result);
      console.log(formatResult(result));
    } catch (error) {
      console.log(`\n❌ ${endpoint}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 Summary");
  console.log("=".repeat(60));

  const avgTotal = results.reduce((sum, r) => sum + r.totalMs, 0) / results.length;
  console.log(`   Average total time: ${avgTotal.toFixed(1)}ms`);

  const totalPayload = results.reduce((sum, r) => sum + r.payloadSize, 0);
  console.log(`   Total payload: ${(totalPayload / 1024).toFixed(1)}KB`);

  // Check for regressions
  console.log("\n🔍 Regression Checks:");
  const THRESHOLDS = {
    default: 2000,
    projectLists: 1500,
    dashboard: 1500,
  };

  for (const result of results) {
    const viewMatch = result.endpoint.match(/view=(\w+)/);
    const view = (viewMatch ? viewMatch[1] : "default") as keyof typeof THRESHOLDS;
    const threshold = THRESHOLDS[view] || 2000;
    const status = result.totalMs <= threshold ? "✅" : "⚠️";
    console.log(
      `   ${status} ${view}: ${result.totalMs.toFixed(1)}ms (threshold: ${threshold}ms)`
    );
  }

  console.log("\n✨ Smoke test complete!");
}

runSmokeTest().catch(console.error);
