/**
 * Oxford debate method parser.
 * 4 phases: Opening Statements -> Rebuttals -> Closing Arguments -> Judgement
 */

import { BaseParser } from "./base-parser.js";
import type { ParsedRole } from "./types.js";
import { STRUCTURAL_PATTERNS } from "./types.js";
import {
  SCHEMA_VERSION,
  type ParseResult,
  type OxfordExportDocument,
  type OxfordMetadata,
  type OxfordPhase1,
  type OxfordPhase2,
  type OxfordPhase3,
  type OxfordPhase4,
  type OxfordDebateMessage,
  type OxfordJudgement,
  type OxfordRole,
  type OxfordRoundType,
  type OxfordDecision,
} from "../schemas/index.js";

export class OxfordParser extends BaseParser<OxfordExportDocument> {
  get methodName() {
    return "oxford" as const;
  }

  get expectedPhaseCount() {
    return 4;
  }

  get validRoles(): ParsedRole[] {
    return ["FOR", "AGAINST"];
  }

  parse(): ParseResult<OxfordExportDocument> {
    const rawMetadata = this.parseRawMetadata();
    const question = this.parseQuestion();

    this.skipToDiscussion();
    const phases = this.parseAllPhases();

    // Extract teams from messages
    const teams = this.extractTeams(phases);

    // Parse judgement and inject it into Phase 4
    this.skipToResult();
    const judgementData = this.parseJudgementData();

    // Find Phase 4 and populate it with judgement
    const phase4 = phases.find(p => p.number === 4) as OxfordPhase4 | undefined;
    if (phase4 && judgementData) {
      phase4.messages = [{
        source: judgementData.synthesizer,
        role: null,
        content: judgementData.content,
        type: "judgement",
        decision: judgementData.decision,
        keyContentions: judgementData.keyContentions,
      }];
    }

    const metadata: OxfordMetadata = {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      method: "oxford",
      date: rawMetadata.date,
      models: rawMetadata.models,
      question,
      teams,
    };

    const doc: OxfordExportDocument = {
      metadata,
      phases: phases as [OxfordPhase1, OxfordPhase2, OxfordPhase3, OxfordPhase4],
      synthesis: judgementData,
    };

    this.validate(doc);
    return { document: doc, warnings: this.warnings };
  }

  validate(doc: OxfordExportDocument): void {
    // Validate phase count
    if (doc.phases.length !== 4) {
      this.warn(`Expected 4 phases for Oxford method, found ${doc.phases.length}`);
    }

    // Validate all messages have FOR or AGAINST role
    for (const phase of doc.phases) {
      for (const msg of phase.messages) {
        if (msg.role !== "FOR" && msg.role !== "AGAINST") {
          this.warn(`Message from ${msg.source} missing FOR/AGAINST role`);
        }
      }
    }

    // Validate teams are balanced
    if (doc.metadata.teams.for.length !== doc.metadata.teams.against.length) {
      this.warn("Oxford debate should have equal FOR and AGAINST teams");
    }

    // Validate judgement has decision
    if (!doc.synthesis.decision) {
      this.warn("Judgement missing decision");
    }
  }

  private parseAllPhases(): (OxfordPhase1 | OxfordPhase2 | OxfordPhase3 | OxfordPhase4)[] {
    const phases: (OxfordPhase1 | OxfordPhase2 | OxfordPhase3 | OxfordPhase4)[] = [];

    while (this.hasMore()) {
      const line = this.peek();

      if (STRUCTURAL_PATTERNS.RESULT.test(line)) break;
      if (STRUCTURAL_PATTERNS.SEPARATOR.test(line) && this.looksLikeResultAhead()) break;

      const phaseHeader = this.parsePhaseHeader();
      if (phaseHeader) {
        const phase = this.parsePhase(phaseHeader.number, phaseHeader.title);
        phases.push(phase);
        continue;
      }

      this.consume();
    }

    return phases;
  }

  private parsePhase(
    phaseNumber: number,
    phaseTitle: string
  ): OxfordPhase1 | OxfordPhase2 | OxfordPhase3 | OxfordPhase4 {
    const roundType = this.getRoundType(phaseNumber);
    const messages = this.parseDebateMessages(phaseNumber, roundType);

    switch (phaseNumber) {
      case 1:
        return { number: 1, name: phaseTitle, messages } as OxfordPhase1;
      case 2:
        return { number: 2, name: phaseTitle, messages } as OxfordPhase2;
      case 3:
        return { number: 3, name: phaseTitle, messages } as OxfordPhase3;
      case 4:
        return { number: 4, name: phaseTitle, messages: [] } as OxfordPhase4;
      default:
        this.warn(`Unexpected phase number ${phaseNumber} in Oxford method`);
        return { number: 1, name: phaseTitle, messages } as OxfordPhase1;
    }
  }

  private getRoundType(phaseNumber: number): OxfordRoundType {
    switch (phaseNumber) {
      case 1:
        return "opening";
      case 2:
        return "rebuttal";
      case 3:
        return "closing";
      default:
        return "opening";
    }
  }

  private parseDebateMessages(phaseNumber: number, roundType: OxfordRoundType): OxfordDebateMessage[] {
    const messages: OxfordDebateMessage[] = [];

    while (this.hasMore()) {
      const line = this.peek();

      if (
        STRUCTURAL_PATTERNS.PHASE.test(line) ||
        STRUCTURAL_PATTERNS.RESULT.test(line) ||
        (STRUCTURAL_PATTERNS.SEPARATOR.test(line) && this.looksLikeResultAhead())
      ) {
        break;
      }

      const msgHeader = this.parseMessageHeader();
      if (msgHeader) {
        this.validateRole(msgHeader.role, phaseNumber);
        const content = this.collectMessageContent();

        messages.push({
          source: msgHeader.source,
          type: "debate",
          role: (msgHeader.role as OxfordRole) || "FOR",
          roundType,
          content,
        });
        continue;
      }

      this.consume();
    }

    return messages;
  }

  private extractTeams(phases: (OxfordPhase1 | OxfordPhase2 | OxfordPhase3 | OxfordPhase4)[]): {
    for: string[];
    against: string[];
  } {
    const forTeam = new Set<string>();
    const againstTeam = new Set<string>();

    for (const phase of phases) {
      for (const msg of phase.messages) {
        if (msg.role === "FOR") {
          forTeam.add(msg.source);
        } else if (msg.role === "AGAINST") {
          againstTeam.add(msg.source);
        }
      }
    }

    return {
      for: Array.from(forTeam),
      against: Array.from(againstTeam),
    };
  }

  private parseJudgementData(): OxfordJudgement {
    const raw = this.parseRawSynthesis();

    return {
      synthesizer: raw.synthesizer,
      content: raw.synthesis,
      decision: this.normalizeDecision(raw.consensus),
      keyContentions: raw.differences || null,
    };
  }

  private normalizeDecision(value: string): OxfordDecision {
    const upper = value.toUpperCase();
    if (upper.includes("FOR") || upper.includes("FÖR") || upper.includes("POUR") || upper.includes("A FAVOR")) {
      return "FOR";
    }
    if (upper.includes("AGAINST") || upper.includes("EMOT") || upper.includes("GEGEN") || upper.includes("CONTRE") || upper.includes("EN CONTRA")) {
      return "AGAINST";
    }
    return "PARTIAL";
  }
}
