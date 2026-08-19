/**
 * Tradeoff analysis method parser.
 * 4 phases: Frame (Define Alternatives) -> Criteria -> Evaluate -> Decision
 */

import { BaseParser } from "./base-parser.js";
import type { ParsedRole } from "./types.js";
import { STRUCTURAL_PATTERNS } from "./types.js";
import {
  SCHEMA_VERSION,
  type ParseResult,
  type TradeoffExportDocument,
  type TradeoffMetadata,
  type TradeoffPhase1,
  type TradeoffPhase2,
  type TradeoffPhase3,
  type TradeoffPhase4,
  type EvaluatorMessage,
  type TradeoffEvaluation,
  type TradeoffDecision,
  type TradeoffAgreement,
} from "../schemas/index.js";

export class TradeoffParser extends BaseParser<TradeoffExportDocument> {
  get methodName() {
    return "tradeoff" as const;
  }

  get expectedPhaseCount() {
    return 4;
  }

  get validRoles(): ParsedRole[] {
    return ["EVALUATOR"];
  }

  parse(): ParseResult<TradeoffExportDocument> {
    const rawMetadata = this.parseRawMetadata();
    const question = this.parseQuestion();

    this.skipToDiscussion();
    const phases = this.parseAllPhases();

    // Extract alternatives and criteria from phases
    const { alternatives, criteria } = this.extractFramework(phases);

    // Parse decision and inject it into Phase 4
    this.skipToResult();
    const decisionData = this.parseDecisionData();

    // Find Phase 4 and populate it with decision
    const phase4 = phases.find(p => p.number === 4) as TradeoffPhase4 | undefined;
    if (phase4 && decisionData) {
      phase4.messages = [{
        source: decisionData.synthesizer,
        role: null,
        content: decisionData.content,
        type: "decision",
        agreement: decisionData.agreement,
        recommendation: decisionData.recommendation,
        keyTradeoffs: decisionData.keyTradeoffs,
      }];
    }

    const metadata: TradeoffMetadata = {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      method: "tradeoff",
      date: rawMetadata.date,
      models: rawMetadata.models,
      question,
      alternatives,
      criteria,
    };

    const doc: TradeoffExportDocument = {
      metadata,
      phases: phases as [TradeoffPhase1, TradeoffPhase2, TradeoffPhase3, TradeoffPhase4],
      synthesis: decisionData,
    };

    this.validate(doc);
    return { document: doc, warnings: this.warnings };
  }

  validate(doc: TradeoffExportDocument): void {
    if (doc.phases.length !== 4) {
      this.warn(`Expected 4 phases for Tradeoff method, found ${doc.phases.length}`);
    }

    if (doc.metadata.alternatives.length < 2) {
      this.warn("Tradeoff analysis should have at least 2 alternatives");
    }

    if (doc.metadata.criteria.length === 0) {
      this.warn("No evaluation criteria identified");
    }

    if (!doc.synthesis.recommendation) {
      this.warn("Decision missing recommendation");
    }
  }

  private parseAllPhases(): (TradeoffPhase1 | TradeoffPhase2 | TradeoffPhase3 | TradeoffPhase4)[] {
    const phases: (TradeoffPhase1 | TradeoffPhase2 | TradeoffPhase3 | TradeoffPhase4)[] = [];

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
  ): TradeoffPhase1 | TradeoffPhase2 | TradeoffPhase3 | TradeoffPhase4 {
    switch (phaseNumber) {
      case 1:
        return this.parsePhase1(phaseTitle);
      case 2:
        return this.parsePhase2(phaseTitle);
      case 3:
        return this.parsePhase3(phaseTitle);
      case 4:
        return { number: 4, name: phaseTitle, messages: [] } as TradeoffPhase4;
      default:
        this.warn(`Unexpected phase number ${phaseNumber} in Tradeoff method`);
        return this.parsePhase1(phaseTitle);
    }
  }

  private parsePhase1(title: string): TradeoffPhase1 {
    const messages = this.parseEvaluatorMessages(1);
    return { number: 1, name: title, messages };
  }

  private parsePhase2(title: string): TradeoffPhase2 {
    const messages = this.parseEvaluatorMessages(2);
    return { number: 2, name: title, messages };
  }

  private parsePhase3(title: string): TradeoffPhase3 {
    const messages = this.parseEvaluationMessages(3);
    return { number: 3, name: title, messages };
  }

  private parseEvaluatorMessages(phaseNumber: number): EvaluatorMessage[] {
    const messages: EvaluatorMessage[] = [];

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
          type: "evaluation",
          role: "EVALUATOR",
          content,
        });
        continue;
      }

      this.consume();
    }

    return messages;
  }

  private parseEvaluationMessages(phaseNumber: number): TradeoffEvaluation[] {
    const messages: TradeoffEvaluation[] = [];

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
        const scores = this.extractScores(content);

        messages.push({
          source: msgHeader.source,
          type: "evaluation",
          role: "EVALUATOR",
          content,
          scores: Object.keys(scores).length > 0 ? scores : undefined,
        });
        continue;
      }

      this.consume();
    }

    return messages;
  }

  private extractScores(content: string): Record<string, Record<string, number>> {
    const scores: Record<string, Record<string, number>> = {};

    // Try to extract scores from patterns like:
    // "Alternative A: Criterion 1: 8/10, Criterion 2: 7/10"
    // or markdown tables
    const scorePatterns = [
      /(\w+(?:\s+\w+)*):\s*(\d+)(?:\/10)?/g,
      /\|([^|]+)\|([^|]+)\|.*?(\d+)/g,
    ];

    // This is a simplified extraction - real implementation would need
    // more sophisticated parsing based on actual markdown format
    const matches = content.match(/(\d+)(?:\/10)?/g);
    if (matches) {
      // Just capture that scores exist, without full structure
      // Real implementation would parse tables properly
    }

    return scores;
  }

  private extractFramework(
    phases: (TradeoffPhase1 | TradeoffPhase2 | TradeoffPhase3 | TradeoffPhase4)[]
  ): { alternatives: string[]; criteria: string[] } {
    const alternatives: string[] = [];
    const criteria: string[] = [];

    // Extract from phase 1 (alternatives) and phase 2 (criteria)
    const phase1 = phases.find(p => p.number === 1);
    const phase2 = phases.find(p => p.number === 2);

    if (phase1) {
      for (const msg of phase1.messages) {
        // Look for bullet points or numbered lists as alternatives
        const altMatches = msg.content.match(/[-*]\s*\*\*([^*]+)\*\*/g);
        if (altMatches) {
          for (const match of altMatches) {
            const alt = match.replace(/[-*]\s*\*\*|\*\*/g, "").trim();
            if (!alternatives.includes(alt)) {
              alternatives.push(alt);
            }
          }
        }
      }
    }

    if (phase2) {
      for (const msg of phase2.messages) {
        // Look for criteria patterns
        const critMatches = msg.content.match(/[-*]\s*\*\*([^*]+)\*\*/g);
        if (critMatches) {
          for (const match of critMatches) {
            const crit = match.replace(/[-*]\s*\*\*|\*\*/g, "").trim();
            if (!criteria.includes(crit)) {
              criteria.push(crit);
            }
          }
        }
      }
    }

    return { alternatives, criteria };
  }

  private parseDecisionData(): TradeoffDecision {
    const raw = this.parseRawSynthesis();
    const recommendation = this.extractRecommendation(raw.synthesis);

    return {
      synthesizer: raw.synthesizer,
      content: raw.synthesis,
      agreement: this.normalizeAgreement(raw.consensus),
      recommendation,
      keyTradeoffs: raw.differences || null,
    };
  }

  private normalizeAgreement(value: string): TradeoffAgreement {
    const upper = value.toUpperCase();
    if (upper.includes("YES") || upper.includes("JA") || upper.includes("OUI") || upper.includes("SÍ")) {
      return "YES";
    }
    return "NO";
  }

  private extractRecommendation(synthesis: string): string {
    // Try to extract the recommendation from patterns like:
    // "**Recommendation:** X" or "**Rekommendation:** X"
    const recMatch = synthesis.match(
      /\*\*(?:Recommendation|Rekommendation|Empfehlung|Recommandation|Recomendación|Raccomandazione):\*\*\s*([^\n]+)/i
    );
    if (recMatch) {
      return recMatch[1].trim();
    }

    // Fall back to first line if no explicit recommendation
    const firstLine = synthesis.split("\n")[0];
    return firstLine?.trim() || "";
  }
}
