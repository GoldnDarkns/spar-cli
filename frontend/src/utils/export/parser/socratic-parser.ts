/**
 * Socratic method parser.
 * 3 phases: Initial Thesis -> Socratic Inquiry -> Aporia & Insights
 */

import { BaseParser } from "./base-parser.js";
import type { ParsedRole } from "./types.js";
import { STRUCTURAL_PATTERNS } from "./types.js";
import {
  SCHEMA_VERSION,
  type ParseResult,
  type SocraticExportDocument,
  type SocraticMetadata,
  type SocraticPhase1,
  type SocraticPhase2,
  type SocraticPhase3,
  type SocraticMessage,
  type SocraticSynthesisMessage,
  type SocraticSynthesis,
  type SocraticRole,
  type AporeaReached,
} from "../schemas/index.js";

export class SocraticParser extends BaseParser<SocraticExportDocument> {
  get methodName() {
    return "socratic" as const;
  }

  get expectedPhaseCount() {
    return 3;
  }

  get validRoles(): ParsedRole[] {
    return ["QUESTIONER", "RESPONDENT"];
  }

  parse(): ParseResult<SocraticExportDocument> {
    const rawMetadata = this.parseRawMetadata();
    const question = this.parseQuestion();

    this.skipToDiscussion();
    const phases = this.parseAllPhases();

    // Extract respondent and questioners from messages
    const { respondent, questioners } = this.extractRoles(phases);

    // Parse synthesis and inject it into Phase 3
    this.skipToResult();
    const synthesisData = this.parseSynthesisData();

    // Find Phase 3 and add synthesis message
    const phase3 = phases.find(p => p.number === 3) as SocraticPhase3 | undefined;
    if (phase3 && synthesisData) {
      // Add synthesis message to the end of Phase 3 (after dialogue messages)
      const synthesisMessage: SocraticSynthesisMessage = {
        source: synthesisData.synthesizer,
        role: null,
        content: synthesisData.content,
        type: "synthesis",
        aporeaReached: synthesisData.aporeaReached,
        openQuestions: synthesisData.openQuestions,
      };
      phase3.messages.push(synthesisMessage);
    }

    const metadata: SocraticMetadata = {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      method: "socratic",
      date: rawMetadata.date,
      models: rawMetadata.models,
      question,
      respondent,
      questioners,
    };

    const doc: SocraticExportDocument = {
      metadata,
      phases: phases as [SocraticPhase1, SocraticPhase2, SocraticPhase3],
      synthesis: synthesisData,
    };

    this.validate(doc);
    return { document: doc, warnings: this.warnings };
  }

  validate(doc: SocraticExportDocument): void {
    if (doc.phases.length !== 3) {
      this.warn(`Expected 3 phases for Socratic method, found ${doc.phases.length}`);
    }

    if (!doc.metadata.respondent) {
      this.warn("No respondent identified");
    }

    if (doc.metadata.questioners.length === 0) {
      this.warn("No questioners identified");
    }
  }

  private parseAllPhases(): (SocraticPhase1 | SocraticPhase2 | SocraticPhase3)[] {
    const phases: (SocraticPhase1 | SocraticPhase2 | SocraticPhase3)[] = [];

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
  ): SocraticPhase1 | SocraticPhase2 | SocraticPhase3 {
    const messages = this.parseDialogueMessages(phaseNumber);

    switch (phaseNumber) {
      case 1:
        return { number: 1, name: phaseTitle, messages } as SocraticPhase1;
      case 2:
        return { number: 2, name: phaseTitle, messages } as SocraticPhase2;
      case 3:
        return { number: 3, name: phaseTitle, messages } as SocraticPhase3;
      default:
        this.warn(`Unexpected phase number ${phaseNumber} in Socratic method`);
        return { number: 1, name: phaseTitle, messages } as SocraticPhase1;
    }
  }

  private parseDialogueMessages(phaseNumber: number): SocraticMessage[] {
    const messages: SocraticMessage[] = [];

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
          type: "dialogue",
          role: (msgHeader.role as SocraticRole) || "RESPONDENT",
          content,
        });
        continue;
      }

      this.consume();
    }

    return messages;
  }

  private extractRoles(phases: (SocraticPhase1 | SocraticPhase2 | SocraticPhase3)[]): {
    respondent: string;
    questioners: string[];
  } {
    const respondents = new Set<string>();
    const questioners = new Set<string>();

    for (const phase of phases) {
      for (const msg of phase.messages) {
        if (msg.role === "RESPONDENT") {
          respondents.add(msg.source);
        } else if (msg.role === "QUESTIONER") {
          questioners.add(msg.source);
        }
      }
    }

    return {
      respondent: Array.from(respondents)[0] || "",
      questioners: Array.from(questioners),
    };
  }

  private parseSynthesisData(): SocraticSynthesis {
    const raw = this.parseRawSynthesis();

    return {
      synthesizer: raw.synthesizer,
      content: raw.synthesis,
      aporeaReached: this.normalizeAporea(raw.consensus),
      openQuestions: raw.differences || null,
    };
  }

  private normalizeAporea(value: string): AporeaReached {
    const upper = value.toUpperCase();
    if (upper.includes("YES") || upper.includes("JA") || upper.includes("OUI") || upper.includes("SÍ") || upper.includes("SÌ")) {
      return "YES";
    }
    if (upper.includes("PARTIAL") || upper.includes("DELVIS") || upper.includes("TEILWEISE") || upper.includes("PARTIEL") || upper.includes("PARCIAL") || upper.includes("PARZIALE")) {
      return "PARTIAL";
    }
    return "NO";
  }
}
