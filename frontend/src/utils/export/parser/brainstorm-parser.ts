/**
 * Brainstorm method parser.
 * 4 phases: Diverge (Wild Ideas) -> Build (Combine & Expand) -> Converge (Select & Refine) -> Synthesis
 */

import { BaseParser } from "./base-parser.js";
import type { ParsedRole } from "./types.js";
import { STRUCTURAL_PATTERNS } from "./types.js";
import {
  SCHEMA_VERSION,
  type ParseResult,
  type BrainstormExportDocument,
  type BrainstormMetadata,
  type BrainstormPhase1,
  type BrainstormPhase2,
  type BrainstormPhase3,
  type BrainstormPhase4,
  type IdeatorMessage,
  type BrainstormSynthesis,
  type SelectedIdea,
} from "../schemas/index.js";

export class BrainstormParser extends BaseParser<BrainstormExportDocument> {
  get methodName() {
    return "brainstorm" as const;
  }

  get expectedPhaseCount() {
    return 4;
  }

  get validRoles(): ParsedRole[] {
    return ["IDEATOR"];
  }

  parse(): ParseResult<BrainstormExportDocument> {
    const rawMetadata = this.parseRawMetadata();
    const question = this.parseQuestion();

    this.skipToDiscussion();
    const phases = this.parseAllPhases();

    // Parse synthesis and inject it into Phase 4
    this.skipToResult();
    const synthesisData = this.parseSynthesisData();

    // Find Phase 4 and populate it with synthesis
    const phase4 = phases.find(p => p.number === 4) as BrainstormPhase4 | undefined;
    if (phase4 && synthesisData) {
      phase4.messages = [{
        source: synthesisData.synthesizer,
        role: null,
        content: synthesisData.content,
        type: "synthesis",
        ideasSelected: synthesisData.ideasSelected,
        selectedIdeas: synthesisData.selectedIdeas,
        alternativeDirections: synthesisData.alternativeDirections,
      }];
    }

    const metadata: BrainstormMetadata = {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      method: "brainstorm",
      date: rawMetadata.date,
      models: rawMetadata.models,
      question,
    };

    const doc: BrainstormExportDocument = {
      metadata,
      phases: phases as [BrainstormPhase1, BrainstormPhase2, BrainstormPhase3, BrainstormPhase4],
      synthesis: synthesisData,
    };

    this.validate(doc);
    return { document: doc, warnings: this.warnings };
  }

  validate(doc: BrainstormExportDocument): void {
    if (doc.phases.length !== 4) {
      this.warn(`Expected 4 phases for Brainstorm method, found ${doc.phases.length}`);
    }

    if (doc.synthesis.ideasSelected === 0) {
      this.warn("No ideas selected in synthesis");
    }
  }

  private parseAllPhases(): (BrainstormPhase1 | BrainstormPhase2 | BrainstormPhase3 | BrainstormPhase4)[] {
    const phases: (BrainstormPhase1 | BrainstormPhase2 | BrainstormPhase3 | BrainstormPhase4)[] = [];

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
  ): BrainstormPhase1 | BrainstormPhase2 | BrainstormPhase3 | BrainstormPhase4 {
    switch (phaseNumber) {
      case 1: {
        const messages = this.parseIdeatorMessages(phaseNumber);
        return { number: 1, name: phaseTitle, messages } as BrainstormPhase1;
      }
      case 2: {
        const messages = this.parseIdeatorMessages(phaseNumber);
        return { number: 2, name: phaseTitle, messages } as BrainstormPhase2;
      }
      case 3: {
        const messages = this.parseIdeatorMessages(phaseNumber);
        return { number: 3, name: phaseTitle, messages } as BrainstormPhase3;
      }
      case 4:
        // Phase 4 is synthesis - content is in Result section
        this.skipPhaseContent();
        return { number: 4, name: phaseTitle, messages: [] } as BrainstormPhase4;
      default:
        this.warn(`Unexpected phase number ${phaseNumber} in Brainstorm method`);
        const messages = this.parseIdeatorMessages(phaseNumber);
        return { number: 1, name: phaseTitle, messages } as BrainstormPhase1;
    }
  }

  private skipPhaseContent(): void {
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
  }

  private parseIdeatorMessages(phaseNumber: number): IdeatorMessage[] {
    const messages: IdeatorMessage[] = [];

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
          type: "ideation",
          role: "IDEATOR",
          content,
        });
        continue;
      }

      this.consume();
    }

    return messages;
  }

  private parseSynthesisData(): BrainstormSynthesis {
    const raw = this.parseRawSynthesis();
    const ideasSelected = this.parseIdeasCount(raw.consensus);
    const selectedIdeas = this.parseSelectedIdeas(raw.synthesis);

    return {
      synthesizer: raw.synthesizer,
      content: raw.synthesis,
      ideasSelected,
      selectedIdeas,
      alternativeDirections: raw.differences || null,
    };
  }

  private parseIdeasCount(consensus: string): number {
    // Match patterns like "3 SELECTED", "3 IDEAS SELECTED", "3 Idéer valda"
    const match = consensus.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  private parseSelectedIdeas(synthesis: string): SelectedIdea[] {
    const ideas: SelectedIdea[] = [];

    // Try to extract structured ideas from synthesis
    // Look for numbered lists or "Idea X:" patterns
    const ideaPatterns = [
      /(?:^|\n)(?:##?\s*)?(?:Idea|Idé|Idee|Idée)\s*(\d+)[:\s]+([^\n]+)/gi,
      /(?:^|\n)(\d+)\.\s*\*\*([^*]+)\*\*/g,
      /(?:^|\n)(\d+)\.\s+([^\n]+)/g,
    ];

    for (const pattern of ideaPatterns) {
      let match;
      while ((match = pattern.exec(synthesis)) !== null) {
        const rank = parseInt(match[1]);
        const title = match[2].trim();

        // Avoid duplicates
        if (!ideas.find(i => i.rank === rank)) {
          ideas.push({
            rank,
            title,
            description: "", // Would need more context to extract
            contributors: [], // Would need to track from messages
          });
        }
      }
    }

    // Sort by rank
    ideas.sort((a, b) => a.rank - b.rank);

    return ideas;
  }
}
