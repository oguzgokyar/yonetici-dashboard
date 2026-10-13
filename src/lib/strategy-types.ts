import type { ColumnType, IdeaType } from './strategy-constants';
export type StrategyOverview = {
  brandIdentity: {
    tone: string;
    valueProposition: string;
    positioning: string;
    keyMessaging: string;
    brandArchetype?: string;
    visualDirectives?: {
      primaryAesthetic: string;
      forbiddenCliches: string[];
      photoStyle: string;
    };
  };
  competitorAnalysis: {
    contentGaps: string[];
    viralPatternsToAdapt: string[];
    differentiationAngle: string;
    liveOutlierCount?: number;
    liveOutlierSummary?: string;
    competitorWeaknesses?: string[];
  };
  audienceVoc: {
    targetPersona: string;
    painPoints: string[];
    frequentQuestions: string[];
    winningHooks: string[];
    unspokenDesires?: string[];
  };
  growthStrategy: {
    primaryPillars: string[];
    weeklyPostingPlan: string;
    channelPriorities: string[];
    conversionFunnel: string;
    leadMagnetOffer?: {
      hook: string;
      deliverable: string;
      ctaTrigger: string;
    };
    contentDistributionRatio?: {
      tofuAwareness: string;
      mofuTrust: string;
      bofuConversion: string;
    };
    aiSearchAeoDirective?: string;
    hashtagBank?: {
      broad: string[];
      niche: string[];
      brand: string[];
    };
    dailySchedule?: Array<{
      day: string;
      format: string;
      focus: string;
    }>;
  };
};

export type StrategyIdea = {
  id?: string;
  columnType: ColumnType;
  title: string;
  hook: string;
  description: string;
  structure: string[];
  targetChannel: string;
  nativeFormat?: GrowthNativeFormat;
  ideaType?: IdeaType | string;
  skillSource?: string;
  status?: "suggested" | "hidden";
  createdAt?: string;
};

import type { SocialPlatform } from './social/hashtag-policy';
export const GROWTH_PLATFORMS = ['instagram', 'tiktok', 'youtube'] as const satisfies readonly SocialPlatform[];
export type GrowthPlatform = typeof GROWTH_PLATFORMS[number];
export type GrowthNativeFormat = 'reels' | 'carousel' | 'story' | 'post' | 'video' | 'shorts' | 'long_video';
export type GrowthCapacity = { postsPerWeek: number; hoursPerWeek: number };
export type GrowthRequest = { platforms: GrowthPlatform[]; objective: string; capacity: GrowthCapacity; idempotencyKey: string };
export type GrowthEvidence = { id: string; sourceUrl: string; platform: GrowthPlatform; account: string; matchType: 'competitor_exact'; observedAt: string | null; title: string };
export type GrowthRecommendation = { id: string; title: string; rationale: string; steps: string[]; effort: 'low' | 'medium' | 'high'; impactHypothesis: string; evidenceIds: string[]; experimentIds: string[]; kpiIds: string[]; contentEligible: boolean; format: string; label: 'expert_hypothesis' | 'source_observation' };
export type GrowthExperiment = { id: string; title: string; hypothesis: string; steps: string[]; metric: string; periodDays: number; contentEligible: boolean; format: string };
export type PlatformGrowthStrategy = {
 schemaVersion: 1; platform: GrowthPlatform; objective: string; diagnosis: string; evidence: GrowthEvidence[]; missingData: string[];
 recommendations: GrowthRecommendation[]; contentMix: { format: string; postsPerWeek: number; purpose: string }[]; weeklyCadence: string; first7Days: string[];
 experiments: GrowthExperiment[]; kpis: { id: string; name: string; definition: string; baseline: number | null; target: string; targetType: 'proposed'; periodDays: number }[]; constraints: string[];
 provenance: { agentSlug: string; agentVersion: string; skillSource: string; engineMode: 'specialist_prompt'; model: string; generatedAt: string; evidenceTruncated: boolean; confidenceMeaning: string };
};
export type GrowthContext = { brandName: string; brandDescription: string; socialChannels: string[]; competitors: string[]; overview: Record<string, unknown>; accounts: { identifier: string; name: string }[]; evidence: GrowthEvidence[]; missingData: string[]; evidenceTruncated: boolean; objective: string; capacity: GrowthCapacity };
export type GrowthRunStatus = 'queued' | 'running' | 'completed' | 'partial' | 'failed' | 'cancelled';
export type GrowthRun = { id: string; project_id: string; status: GrowthRunStatus; platforms_json: string; context_json: string; context_hash: string; idempotency_key: string; request_hash: string; lease_owner: string | null; lease_expires_at: number | null; attempt_count: number; error: string | null; errors_json: string; created_at: string; updated_at: string; completed_at: string | null };
export type SavedGrowth = { id: string; platform: GrowthPlatform; strategy: PlatformGrowthStrategy; contextHash: string; createdAt: string; stale: boolean };
export type GrowthResponse = { strategies: SavedGrowth[]; activeRun: GrowthRun | null; run: GrowthRun | null; availablePlatforms: GrowthPlatform[]; connectedPlatforms: GrowthPlatform[]; context: GrowthContext };
