/**
 * Tradeoff analysis method JSON export schema
 * 4 phases: Frame (Define Alternatives) -> Criteria -> Evaluate -> Decision
 */

import type {
  BaseMetadata,
  BasePhase,
  BaseMessage,
  BaseSynthesis,
  BaseExportDocument,
} from "./base-schema.js";

// ============ Types ============

export type TradeoffAgreement = "YES" | "NO";

// ============ Metadata ============

export interface TradeoffMetadata extends BaseMetadata {
  method: "tradeoff";
  alternatives: string[]; // The options being compared
  criteria: string[]; // The evaluation dimensions
}

// ============ Message Types ============

/** Evaluator message for tradeoff analysis */
export interface EvaluatorMessage extends BaseMessage {
  type: "evaluation";
  role: "EVALUATOR";
}

/** Evaluation with optional scores matrix */
export interface TradeoffEvaluation extends EvaluatorMessage {
  /** Scores matrix: alternative -> criterion -> score (1-10) */
  scores?: Record<string, Record<string, number>>;
}

// ============ Phase Types ============

export interface TradeoffPhase1 extends BasePhase {
  number: 1;
  name: string; // "Frame: Define Alternatives" or translated
  messages: EvaluatorMessage[];
}

export interface TradeoffPhase2 extends BasePhase {
  number: 2;
  name: string; // "Criteria: Evaluation Dimensions" or translated
  messages: EvaluatorMessage[];
}

export interface TradeoffPhase3 extends BasePhase {
  number: 3;
  name: string; // "Evaluate: Score Options" or translated
  messages: TradeoffEvaluation[];
}

// Phase 4 contains the decision
export interface TradeoffDecisionMessage extends BaseMessage {
  type: "decision";
  role: null;
  agreement: TradeoffAgreement;
  recommendation: string;
  keyTradeoffs: string | null;
}

export interface TradeoffPhase4 extends BasePhase {
  number: 4;
  name: string; // "Decision" or translated
  messages: TradeoffDecisionMessage[];
}

// ============ Synthesis (Decision) ============

export interface TradeoffDecision extends BaseSynthesis {
  agreement: TradeoffAgreement;
  recommendation: string;
  keyTradeoffs: string | null;
}

// ============ Export Document ============

export interface TradeoffExportDocument extends BaseExportDocument {
  metadata: TradeoffMetadata;
  phases: [TradeoffPhase1, TradeoffPhase2, TradeoffPhase3, TradeoffPhase4];
  synthesis: TradeoffDecision;
}
