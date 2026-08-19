/**
 * Standard method parser.
 * 5 phases: Independent Answers -> Critique -> Discussion -> Final Positions -> Synthesis
 */

import { BaseParser } from "./base-parser.js";
import type { ParsedRole } from "./types.js";
import { STRUCTURAL_PATTERNS } from "./types.js";
import {
  SCHEMA_VERSION,
  type ParseResult,
  type StandardExportDocument,
  type StandardMetadata,
  type StandardPhase1,
  type StandardPhase2,
  type StandardPhase3,
  type StandardPhase4,
  type StandardPhase5,
  type StandardIndependentAnswer,
  type StandardCritique,
  type StandardDiscussionMessage,
  type StandardFinalPosition,
  type StandardSynthesis,
  type StandardConsensus,
  type ConfidenceLevel,
  type ConfidenceBreakdown,
} from "../schemas/index.js";

export class StandardParser extends BaseParser<StandardExportDocument> {
  get methodName() {
    return "standard" as const;
  }

  get expectedPhaseCount() {
    return 5;
  }

  get validRoles(): ParsedRole[] {
    return [null]; // Standard has no roles
  }

  parse(): ParseResult<StandardExportDocument> {
    const rawMetadata = this.parseRawMetadata();
    const question = this.parseQuestion();

    this.skipToDiscussion();
    const phases = this.parseAllPhases();

    // Parse synthesis and inject it into Phase 5
    this.skipToResult();
    const synthesisData = this.parseSynthesisData(phases);

    // Find Phase 5 and populate it with synthesis
    const phase5 = phases.find(p => p.number === 5) as StandardPhase5 | undefined;
    if (phase5 && synthesisData) {
      phase5.messages = [{
        source: synthesisData.synthesizer,
        role: null,
        content: synthesisData.content,
        type: "synthesis",
        consensus: synthesisData.consensus,
        differences: synthesisData.differences,
        confidenceBreakdown: synthesisData.confidenceBreakdown,
      }];
    }

    const metadata: StandardMetadata = {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      method: "standard",
      date: rawMetadata.date,
      models: rawMetadata.models,
      question,
    };

    // synthesis field kept for backwards compatibility / convenience
    const doc: StandardExportDocument = {
      metadata,
      phases: phases as [StandardPhase1, StandardPhase2, StandardPhase3, StandardPhase4, StandardPhase5],
      synthesis: synthesisData,
    };

    this.validate(doc);
    return { document: doc, warnings: this.warnings };
  }

  validate(doc: StandardExportDocument): void {
    // Validate phase count
    if (doc.phases.length !== 5) {
      this.warn(`Expected 5 phases for Standard method, found ${doc.phases.length}`);
    }

    // Validate phase 2 critiques have required fields
    const phase2 = doc.phases[1];
    if (phase2) {
      for (const msg of phase2.messages) {
        if (!msg.agreements && !msg.disagreements && !msg.missing) {
          this.warn(`Critique from ${msg.source} has no agreements/disagreements/missing fields`);
        }
      }
    }

    // Validate phase 4 positions have confidence
    const phase4 = doc.phases[3];
    if (phase4) {
      for (const msg of phase4.messages) {
        if (!msg.confidence) {
          this.warn(`Final position from ${msg.source} missing confidence level`);
        }
      }
    }

    // Validate synthesis
    if (!doc.synthesis.consensus) {
      this.warn("Synthesis missing consensus value");
    }
  }

  private parseAllPhases(): (StandardPhase1 | StandardPhase2 | StandardPhase3 | StandardPhase4 | StandardPhase5)[] {
    const phases: (StandardPhase1 | StandardPhase2 | StandardPhase3 | StandardPhase4 | StandardPhase5)[] = [];

    while (this.hasMore()) {
      const line = this.peek();

      // Check for end of discussion
      if (STRUCTURAL_PATTERNS.RESULT.test(line)) break;
      if (STRUCTURAL_PATTERNS.SEPARATOR.test(line) && this.looksLikeResultAhead()) break;

      // Parse phase header
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
  ): StandardPhase1 | StandardPhase2 | StandardPhase3 | StandardPhase4 | StandardPhase5 {
    switch (phaseNumber) {
      case 1:
        return this.parsePhase1(phaseTitle);
      case 2:
        return this.parsePhase2(phaseTitle);
      case 3:
        return this.parsePhase3(phaseTitle);
      case 4:
        return this.parsePhase4(phaseTitle);
      case 5:
        return this.parsePhase5(phaseTitle);
      default:
        this.warn(`Unexpected phase number ${phaseNumber} in Standard method`);
        return this.parsePhase1(phaseTitle); // Fallback
    }
  }

  private parsePhase1(title: string): StandardPhase1 {
    const messages: StandardIndependentAnswer[] = [];

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
          type: "answer",
          role: null,
          content,
        });
        continue;
      }

      this.consume();
    }

    return { number: 1, name: title, messages };
  }

  private parsePhase2(title: string): StandardPhase2 {
    const messages: StandardCritique[] = [];

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

        if (this.isCritiqueType(msgHeader.messageType)) {
          const fields = this.parseCritiqueFields();
          messages.push({
            source: msgHeader.source,
            type: "critique",
            role: null,
            content: "", // Critiques have structured fields instead
            agreements: fields.agreements,
            disagreements: fields.disagreements,
            missing: fields.missing,
          });
        } else {
          // Fallback for unlabeled critique messages
          const fields = this.parseCritiqueFields();
          messages.push({
            source: msgHeader.source,
            type: "critique",
            role: null,
            content: "",
            agreements: fields.agreements,
            disagreements: fields.disagreements,
            missing: fields.missing,
          });
        }
        continue;
      }

      this.consume();
    }

    return { number: 2, name: title, messages };
  }

  private parsePhase3(title: string): StandardPhase3 {
    const messages: StandardDiscussionMessage[] = [];

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
        this.validateRole(msgHeader.role, 3);
        const content = this.collectMessageContent();
        messages.push({
          source: msgHeader.source,
          type: "discussion",
          role: null,
          content,
        });
        continue;
      }

      this.consume();
    }

    return { number: 3, name: title, messages };
  }

  private parsePhase4(title: string): StandardPhase4 {
    const messages: StandardFinalPosition[] = [];

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
        this.validateRole(msgHeader.role, 4);

        if (this.isPositionType(msgHeader.messageType)) {
          const { content, confidence } = this.parsePositionContent();
          messages.push({
            source: msgHeader.source,
            type: "position",
            role: null,
            content,
            confidence: this.normalizeConfidence(confidence),
          });
        } else {
          // Fallback for unlabeled position messages
          const { content, confidence } = this.parsePositionContent();
          messages.push({
            source: msgHeader.source,
            type: "position",
            role: null,
            content,
            confidence: this.normalizeConfidence(confidence),
          });
        }
        continue;
      }

      this.consume();
    }

    return { number: 4, name: title, messages };
  }

  private parsePhase5(title: string): StandardPhase5 {
    // Phase 5 in Standard is just a header - synthesis content is in Result section
    // Skip any content until next phase/result
    while (this.hasMore()) {
      const line = this.peek();

      if (
        STRUCTURAL_PATTERNS.PHASE.test(line) ||
        STRUCTURAL_PATTERNS.RESULT.test(line) ||
        (STRUCTURAL_PATTERNS.SEPARATOR.test(line) && this.looksLikeResultAhead())
      ) {
        break;
      }

      this.consume();
    }

    return { number: 5, name: title, messages: [] };
  }

  private parseSynthesisData(
    phases: (StandardPhase1 | StandardPhase2 | StandardPhase3 | StandardPhase4 | StandardPhase5)[]
  ): StandardSynthesis {
    const raw = this.parseRawSynthesis();

    // Count confidence levels from phase 4
    const confidenceBreakdown = this.countConfidenceLevels(phases);

    return {
      synthesizer: raw.synthesizer,
      content: raw.synthesis,
      consensus: this.normalizeConsensus(raw.consensus),
      differences: raw.differences || null,
      confidenceBreakdown,
    };
  }

  private normalizeConsensus(value: string): StandardConsensus {
    const upper = value.toUpperCase();
    if (upper.includes("YES") || upper.includes("JA") || upper.includes("OUI") || upper.includes("SÍ") || upper.includes("SÌ")) {
      return "YES";
    }
    if (upper.includes("PARTIAL") || upper.includes("DELVIS") || upper.includes("TEILWEISE") || upper.includes("PARTIEL") || upper.includes("PARCIAL") || upper.includes("PARZIALE")) {
      return "PARTIAL";
    }
    return "NO";
  }

  private normalizeConfidence(value: string): ConfidenceLevel {
    const upper = value.toUpperCase();
    if (upper.includes("HIGH") || upper.includes("HÖG") || upper.includes("HOCH") || upper.includes("HAUTE") || upper.includes("ALTA") || upper.includes("ALTO")) {
      return "HIGH";
    }
    if (upper.includes("MEDIUM") || upper.includes("MEDEL") || upper.includes("MITTEL") || upper.includes("MOYENNE") || upper.includes("MEDIA") || upper.includes("MEDIO")) {
      return "MEDIUM";
    }
    return "LOW";
  }

  private countConfidenceLevels(
    phases: (StandardPhase1 | StandardPhase2 | StandardPhase3 | StandardPhase4 | StandardPhase5)[]
  ): ConfidenceBreakdown {
    const breakdown: ConfidenceBreakdown = { HIGH: 0, MEDIUM: 0, LOW: 0 };

    const phase4 = phases.find(p => p.number === 4) as StandardPhase4 | undefined;
    if (phase4) {
      for (const msg of phase4.messages) {
        if (msg.confidence === "HIGH") breakdown.HIGH++;
        else if (msg.confidence === "MEDIUM") breakdown.MEDIUM++;
        else if (msg.confidence === "LOW") breakdown.LOW++;
      }
    }

    return breakdown;
  }
}
