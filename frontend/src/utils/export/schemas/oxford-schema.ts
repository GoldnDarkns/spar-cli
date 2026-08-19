/**
 * Oxford debate method JSON export schema
 * 4 phases: Opening Statements -> Rebuttals -> Closing Arguments -> Judgement
 */

import type {
  BaseMetadata,
  BasePhase,
  BaseMessage,
  BaseSynthesis,
  BaseExportDocument,
} from "./base-schema.js";

// ============ Types ============

export type OxfordRole = "FOR" | "AGAINST";
export type OxfordRoundType = "opening" | "rebuttal" | "closing";
export type OxfordDecision = "FOR" | "AGAINST" | "PARTIAL";

// ============ Metadata ============

export interface OxfordMetadata extends BaseMetadata {
  method: "oxford";
  teams: {
    for: string[];
    against: string[];
  };
}

// ============ Message Types ============

/** Debate message with role and round type */
export interface OxfordDebateMessage extends BaseMessage {
  type: "debate";
  role: OxfordRole;
  roundType: OxfordRoundType;
}

// ============ Phase Types ============

export interface OxfordPhase1 extends BasePhase {
  number: 1;
  name: string; // "Opening Statements" or translated
  messages: OxfordDebateMessage[];
}

export interface OxfordPhase2 extends BasePhase {
  number: 2;
  name: string; // "Rebuttals" or translated
  messages: OxfordDebateMessage[];
}

export interface OxfordPhase3 extends BasePhase {
  number: 3;
  name: string; // "Closing Arguments" or translated
  messages: OxfordDebateMessage[];
}

// Phase 4 contains the judgement
export interface OxfordJudgementMessage extends BaseMessage {
  type: "judgement";
  decision: OxfordDecision;
  keyContentions: string | null;
}

export interface OxfordPhase4 extends BasePhase {
  number: 4;
  name: string; // "Judgement" or translated
  messages: OxfordJudgementMessage[];
}

// ============ Synthesis (Judgement) ============

export interface OxfordJudgement extends BaseSynthesis {
  decision: OxfordDecision;
  keyContentions: string | null;
}

// ============ Export Document ============

export interface OxfordExportDocument extends BaseExportDocument {
  metadata: OxfordMetadata;
  phases: [OxfordPhase1, OxfordPhase2, OxfordPhase3, OxfordPhase4];
  synthesis: OxfordJudgement;
}
