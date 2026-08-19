/**
 * Brainstorm method JSON export schema
 * 4 phases: Diverge (Wild Ideas) -> Build (Combine & Expand) -> Converge (Select & Refine) -> Synthesis
 */

import type {
  BaseMetadata,
  BasePhase,
  BaseMessage,
  BaseSynthesis,
  BaseExportDocument,
} from "./base-schema.js";

// ============ Metadata ============

export interface BrainstormMetadata extends BaseMetadata {
  method: "brainstorm";
}

// ============ Message Types ============

/** Ideator message for brainstorming */
export interface IdeatorMessage extends BaseMessage {
  type: "ideation";
  role: "IDEATOR";
}

// ============ Phase Types ============

export interface BrainstormPhase1 extends BasePhase {
  number: 1;
  name: string; // "Diverge: Wild Ideas" or translated
  messages: IdeatorMessage[];
}

export interface BrainstormPhase2 extends BasePhase {
  number: 2;
  name: string; // "Build: Combine & Expand" or translated
  messages: IdeatorMessage[];
}

export interface BrainstormPhase3 extends BasePhase {
  number: 3;
  name: string; // "Converge: Select & Refine" or translated
  messages: IdeatorMessage[];
}

// Phase 4 contains the synthesis
export interface BrainstormSynthesisMessage extends BaseMessage {
  type: "synthesis";
  role: null;
  ideasSelected: number;
  selectedIdeas: SelectedIdea[];
  alternativeDirections: string | null;
}

export interface BrainstormPhase4 extends BasePhase {
  number: 4;
  name: string; // "Synthesis" or translated
  messages: BrainstormSynthesisMessage[];
}

// ============ Synthesis ============

/** Selected idea from brainstorming */
export interface SelectedIdea {
  rank: number;
  title: string;
  description: string;
  contributors: string[];
}

export interface BrainstormSynthesis extends BaseSynthesis {
  ideasSelected: number; // e.g., "3 SELECTED" -> 3
  selectedIdeas: SelectedIdea[];
  alternativeDirections: string | null;
}

// ============ Export Document ============

export interface BrainstormExportDocument extends BaseExportDocument {
  metadata: BrainstormMetadata;
  phases: [BrainstormPhase1, BrainstormPhase2, BrainstormPhase3, BrainstormPhase4];
  synthesis: BrainstormSynthesis;
}
