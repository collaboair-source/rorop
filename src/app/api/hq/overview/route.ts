import { getStore } from "@/lib/db";
import { handler, json, requireUser, requestToday, addDays } from "@/lib/hq/api";
import { isAiConfigured } from "@/lib/hq/secretary";
import { listVentures, ventureStats, overviewTasks, recentComments, listKnowledge } from "@/lib/hq/service";
import type { OverviewResponse } from "@/lib/hq/types";

export const GET = handler(async () => {
  const user = await requireUser();
  const userId = user.id;
  const today = await requestToday();
  const t = overviewTasks(userId, today);
  const weekAgo = addDays(t.today, -7);
  const allTasks = getStore().tasks.filter((x) => x.user_id === userId);
  const ventures = listVentures(userId).map((v) => ventureStats(userId, v));
  const knowledge = listKnowledge(userId);
  const briefing = getStore().briefings.find((b) => b.user_id === userId && b.date === today && (b.kind || "daily") === "daily") || null;
  const weekly = getStore()
    .briefings.filter((b) => b.user_id === userId && b.kind === "weekly")
    .sort((a, b) => b.date.localeCompare(a.date))[0] || null;

  const body: OverviewResponse = {
    user: { id: user.id, name: user.name, email: user.email },
    today: t.today,
    ai_enabled: isAiConfigured(),
    stats: {
      open_tasks: t.open.length,
      doing_tasks: t.open.filter((x) => x.status === "doing").length,
      overdue_tasks: t.overdue.length,
      done_this_week: allTasks.filter((x) => x.status === "done" && (x.completed_at || "").slice(0, 10) >= weekAgo).length,
      ventures_active: ventures.filter((v) => v.status === "active").length,
      ventures_total: ventures.length,
      knowledge_count: knowledge.length,
      knowledge_unanalyzed: knowledge.filter((k) => !k.analyzed).length,
    },
    tasks: {
      overdue: t.overdue,
      today: t.today_tasks,
      doing: t.doing,
      upcoming: t.upcoming,
      unscheduled_urgent: t.unscheduled_urgent,
    },
    ventures: ventures.sort((a, b) => {
      const rank = { active: 0, idea: 1, paused: 2, done: 3 } as const;
      return rank[a.status] - rank[b.status] || a.priority.localeCompare(b.priority);
    }),
    briefing,
    weekly_review: weekly,
    recent_comments: recentComments(userId, 8),
  };
  return json(body);
});
