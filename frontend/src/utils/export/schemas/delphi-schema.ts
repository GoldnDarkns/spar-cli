/**
 * Delphi method JSON export schema
 * 3-4 phases: Round 1 -> Round 2 -> Round 3 (optional) -> Aggregation
 */

import type {
  BaseMetadata,
  BasePhase,
  BaseMessage,
  BaseSynthesis,
  BaseExportDocument,
  ConfidenceLevel,
  ConfidenceBreakdown,
} from "./base-schema.js";

// ============ Types ============

export type DelphiConvergence = "YES" | "PARTIAL" | "NO";

// ============ Metadata ============

export interface DelphiMetadata extends BaseMetadata {
  method: "delphi";
  totalRounds: number; // 2-3 rounds depending on convergence
}

// ============ Message Types ============

/** Anonymous panelist estimate */
export interface DelphiEstimate extends BaseMessage {
  type: "estimate";
  role: "PANELIST";
  anonymous: true;
  panelistId: string; // "A", "B", "C", etc.
  confidence?: ConfidenceLevel;
  revised?: boolean; // True for rounds 2+
}

// ============ Phase Types ============

export interface DelphiRound extends BasePhase {
  name: string; // "Round 1", "Round 2", etc. or translated
  messages: DelphiEstimate[];
}

// Aggregation message for the final phase
export interface DelphiAggregationMessage extends BaseMessage {
  type: "aggregation";
  role: null;
  convergence: DelphiConvergence;
  confidenceDistribution: ConfidenceBreakdown;
  outlierPerspectives: string | null;
}

export interface DelphiAggregationPhase extends BasePhase {
  name: string; // "Aggregation" or translated
  messages: DelphiAggregationMessage[];
}

// ============ Synthesis (Aggregation) ============

export interface DelphiAggregation extends BaseSynthesis {
  convergence: DelphiConvergence;
  confidenceDistribution: ConfidenceBreakdown;
  outlierPerspectives: string | null;
}

// ============ Export Document ============

export interface DelphiExportDocument extends BaseExportDocument {
  metadata: DelphiMetadata;
  phases: (DelphiRound | DelphiAggregationPhase)[]; // 3-4 phases
  synthesis: DelphiAggregation;
}
