/**
 * Devil's Advocate method JSON export schema
 * 3 phases: Initial Positions -> Cross-Examination -> Verdict
 */

import type {
  BaseMetadata,
  BasePhase,
  BaseMessage,
  BaseSynthesis,
  BaseExportDocument,
} from "./base-schema.js";

// ============ Types ============

export type AdvocateRole = "ADVOCATE" | "DEFENDER";

// ============ Metadata ============

export interface AdvocateMetadata extends BaseMetadata {
  method: "advocate";
  advocate: string; // The model acting as devil's advocate
  defenders: string[]; // Models defending their positions
}

// ============ Message Types ============

/** Defender's initial position */
export interface DefenderPosition extends BaseMessage {
  type: "position";
  role: "DEFENDER";
}

/** Cross-examination message (question from advocate or response from defender) */
export interface CrossExaminationMessage extends BaseMessage {
  type: "examination";
  role: AdvocateRole;
  targetDefender?: string; // For advocate questions - which defender is being examined
}

// ============ Phase Types ============

export interface AdvocatePhase1 extends BasePhase {
  number: 1;
  name: string; // "Initial Positions" or translated
  messages: DefenderPosition[];
}

export interface AdvocatePhase2 extends BasePhase {
  number: 2;
  name: string; // "Cross-Examination" or translated
  messages: CrossExaminationMessage[];
}

// Phase 3 contains the verdict
export interface AdvocateVerdictMessage extends BaseMessage {
  type: "verdict";
  role: "ADVOCATE";
  unresolvedQuestions: string | null;
}

export interface AdvocatePhase3 extends BasePhase {
  number: 3;
  name: string; // "Verdict" or translated
  messages: AdvocateVerdictMessage[];
}

// ============ Synthesis (Verdict) ============

export interface AdvocateVerdict extends BaseSynthesis {
  // Advocate method uses verdict directly, no consensus field
  unresolvedQuestions: string | null;
}

// ============ Export Document ============

export interface AdvocateExportDocument extends BaseExportDocument {
  metadata: AdvocateMetadata;
  phases: [AdvocatePhase1, AdvocatePhase2, AdvocatePhase3];
  synthesis: AdvocateVerdict;
}
