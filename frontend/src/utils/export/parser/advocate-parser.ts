/**
 * Devil's Advocate method parser.
 * 3 phases: Initial Positions -> Cross-Examination -> Verdict
 */

import { BaseParser } from "./base-parser.js";
import type { ParsedRole } from "./types.js";
import { STRUCTURAL_PATTERNS } from "./types.js";
import {
  SCHEMA_VERSION,
  type ParseResult,
  type AdvocateExportDocument,
  type AdvocateMetadata,
  type AdvocatePhase1,
  type AdvocatePhase2,
  type AdvocatePhase3,
  type DefenderPosition,
  type CrossExaminationMessage,
  type AdvocateVerdictMessage,
  type AdvocateVerdict,
  type AdvocateRole,
} from "../schemas/index.js";

export class AdvocateParser extends BaseParser<AdvocateExportDocument> {
  get methodName() {
    return "advocate" as const;
  }

  get expectedPhaseCount() {
    return 3;
  }

  get validRoles(): ParsedRole[] {
    return ["ADVOCATE", "DEFENDER"];
  }

  parse(): ParseResult<AdvocateExportDocument> {
    const rawMetadata = this.parseRawMetadata();
    const question = this.parseQuestion();

    this.skipToDiscussion();
    const phases = this.parseAllPhases();

    // Extract advocate and defenders from messages
    const { advocate, defenders } = this.extractRoles(phases);

    // Parse verdict and inject it into Phase 3
    this.skipToResult();
    const verdictData = this.parseVerdictData();

    // Find Phase 3 and populate it with verdict
    const phase3 = phases.find(p => p.number === 3) as AdvocatePhase3 | undefined;
    if (phase3 && verdictData) {
      phase3.messages = [{
        source: verdictData.synthesizer,
        role: "ADVOCATE",
        content: verdictData.content,
        type: "verdict",
        unresolvedQuestions: verdictData.unresolvedQuestions,
      }];
    }

    const metadata: AdvocateMetadata = {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      method: "advocate",
      date: rawMetadata.date,
      models: rawMetadata.models,
      question,
      advocate: advocate || verdictData.synthesizer,
      defenders,
    };

    const doc: AdvocateExportDocument = {
      metadata,
      phases: phases as [AdvocatePhase1, AdvocatePhase2, AdvocatePhase3],
      synthesis: verdictData,
    };

    this.validate(doc);
    return { document: doc, warnings: this.warnings };
  }

  validate(doc: AdvocateExportDocument): void {
    if (doc.phases.length !== 3) {
      this.warn(`Expected 3 phases for Advocate method, found ${doc.phases.length}`);
    }

    if (!doc.metadata.advocate) {
      this.warn("No advocate identified");
    }

    if (doc.metadata.defenders.length === 0) {
      this.warn("No defenders identified");
    }
  }

  private parseAllPhases(): (AdvocatePhase1 | AdvocatePhase2 | AdvocatePhase3)[] {
    const phases: (AdvocatePhase1 | AdvocatePhase2 | AdvocatePhase3)[] = [];

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
  ): AdvocatePhase1 | AdvocatePhase2 | AdvocatePhase3 {
    switch (phaseNumber) {
      case 1:
        return this.parsePhase1(phaseTitle);
      case 2:
        return this.parsePhase2(phaseTitle);
      case 3:
        return { number: 3, name: phaseTitle, messages: [] } as AdvocatePhase3;
      default:
        this.warn(`Unexpected phase number ${phaseNumber} in Advocate method`);
        return this.parsePhase1(phaseTitle);
    }
  }

  private parsePhase1(title: string): AdvocatePhase1 {
    const messages: DefenderPosition[] = [];

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
        this.validateRole(msgHeader.role, 1);
        const content = this.collectMessageContent();

        messages.push({
          source: msgHeader.source,
          type: "position",
          role: "DEFENDER",
          content,
        });
        continue;
      }

      this.consume();
    }

    return { number: 1, name: title, messages };
  }

  private parsePhase2(title: string): AdvocatePhase2 {
    const messages: CrossExaminationMessage[] = [];
    let currentDefender: string | undefined;

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
        this.validateRole(msgHeader.role, 2);
        const content = this.collectMessageContent();
        const role = (msgHeader.role as AdvocateRole) || "DEFENDER";

        // Track which defender is being examined
        if (role === "DEFENDER") {
          currentDefender = msgHeader.source;
        }

        messages.push({
          source: msgHeader.source,
          type: "examination",
          role,
          content,
          ...(role === "ADVOCATE" && currentDefender ? { targetDefender: currentDefender } : {}),
        });
        continue;
      }

      this.consume();
    }

    return { number: 2, name: title, messages };
  }

  private extractRoles(phases: (AdvocatePhase1 | AdvocatePhase2 | AdvocatePhase3)[]): {
    advocate: string;
    defenders: string[];
  } {
    const advocates = new Set<string>();
    const defenders = new Set<string>();

    for (const phase of phases) {
      for (const msg of phase.messages) {
        if (msg.role === "ADVOCATE") {
          advocates.add(msg.source);
        } else if (msg.role === "DEFENDER") {
          defenders.add(msg.source);
        }
      }
    }

    return {
      advocate: Array.from(advocates)[0] || "",
      defenders: Array.from(defenders),
    };
  }

  private parseVerdictData(): AdvocateVerdict {
    const raw = this.parseRawSynthesis();

    return {
      synthesizer: raw.synthesizer,
      content: raw.synthesis,
      unresolvedQuestions: raw.differences || null,
    };
  }
}
