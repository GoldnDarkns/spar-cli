/**
 * Socratic method JSON export schema
 * 3 phases: Initial Thesis -> Socratic Inquiry -> Aporia & Insights
 */

import type {
  BaseMetadata,
  BasePhase,
  BaseMessage,
  BaseSynthesis,
  BaseExportDocument,
} from "./base-schema.js";

// ============ Types ============

export type SocraticRole = "QUESTIONER" | "RESPONDENT";
export type AporeaReached = "YES" | "PARTIAL" | "NO";

// ============ Metadata ============

export interface SocraticMetadata extends BaseMetadata {
  method: "socratic";
  respondent: string; // The model presenting and defending thesis
  questioners: string[]; // Models asking probing questions
}

// ============ Message Types ============

/** Socratic dialogue message */
export interface SocraticMessage extends BaseMessage {
  type: "dialogue";
  role: SocraticRole;
}

// ============ Phase Types ============

export interface SocraticPhase1 extends BasePhase {
  number: 1;
  name: string; // "Initial Thesis" or translated
  messages: SocraticMessage[];
}

export interface SocraticPhase2 extends BasePhase {
  number: 2;
  name: string; // "Socratic Inquiry" or translated
  messages: SocraticMessage[];
}

/** Synthesis message for Phase 3 */
export interface SocraticSynthesisMessage extends BaseMessage {
  type: "synthesis";
  role: null;
  aporeaReached: AporeaReached;
  openQuestions: string | null;
}

export interface SocraticPhase3 extends BasePhase {
  number: 3;
  name: string; // "Aporia & Insights" or translated
  messages: (SocraticMessage | SocraticSynthesisMessage)[];
}

// ============ Synthesis ============

export interface SocraticSynthesis extends BaseSynthesis {
  aporeaReached: AporeaReached;
  openQuestions: string | null;
}

// ============ Export Document ============

export interface SocraticExportDocument extends BaseExportDocument {
  metadata: SocraticMetadata;
  phases: [SocraticPhase1, SocraticPhase2, SocraticPhase3];
  synthesis: SocraticSynthesis;
}
