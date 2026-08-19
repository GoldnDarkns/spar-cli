/**
 * Abstract base parser class with shared functionality for all method parsers.
 */

import type { BaseExportDocument, ParseResult, DiscussionMethod } from "../schemas/index.js";
import {
  STRUCTURAL_PATTERNS,
  METADATA_PATTERNS,
  MESSAGE_TYPE_LABELS,
  type ParsedRole,
  type RawMetadata,
  ParserValidationError,
} from "./types.js";

/**
 * Abstract base parser that provides shared parsing functionality.
 * Each method-specific parser extends this class and implements its own validation.
 */
export abstract class BaseParser<T extends BaseExportDocument> {
  protected lines: string[];
  protected index: number;
  protected warnings: string[];

  constructor(markdown: string) {
    this.lines = markdown.split("\n");
    this.index = 0;
    this.warnings = [];
  }

  // ============ Abstract Methods ============

  /** Method name for validation messages */
  abstract get methodName(): DiscussionMethod;

  /** Expected phase count for this method */
  abstract get expectedPhaseCount(): number;

  /** Valid roles for this method */
  abstract get validRoles(): ParsedRole[];

  /** Parse the document with method-specific logic */
  abstract parse(): ParseResult<T>;

  /** Validate the parsed document against method constraints */
  abstract validate(doc: T): void;

  // ============ State Helpers ============

  protected peek(): string {
    return this.lines[this.index]?.trim() ?? "";
  }

  protected peekRaw(): string {
    return this.lines[this.index] ?? "";
  }

  protected consume(): string {
    return this.lines[this.index++] ?? "";
  }

  protected consumeRaw(): string {
    return this.lines[this.index++] ?? "";
  }

  protected skipEmpty(): void {
    while (this.index < this.lines.length && !this.lines[this.index]?.trim()) {
      this.index++;
    }
  }

  protected hasMore(): boolean {
    return this.index < this.lines.length;
  }

  protected savePosition(): number {
    return this.index;
  }

  protected restorePosition(pos: number): void {
    this.index = pos;
  }

  // ============ Validation Helpers ============

  /** Add a validation warning without failing */
  protected warn(message: string): void {
    this.warnings.push(message);
  }

  /** Throw validation error for fatal issues */
  protected error(message: string, phase?: number): never {
    throw new ParserValidationError(this.methodName, message, phase);
  }

  /** Validate role is valid for this method */
  protected validateRole(role: ParsedRole, phase: number): void {
    if (role !== null && !this.validRoles.includes(role)) {
      this.warn(`Unexpected role "${role}" in phase ${phase} for ${this.methodName} method`);
    }
  }

  // ============ Shared Parsing Methods ============

  /** Parse metadata section - shared across all methods */
  protected parseRawMetadata(): RawMetadata {
    const metadata: RawMetadata = { date: "", method: "", models: [] };

    while (this.hasMore()) {
      const line = this.peek();

      const dateMatch = line.match(METADATA_PATTERNS.DATE);
      if (dateMatch) {
        metadata.date = dateMatch[2].trim();
        this.consume();
        continue;
      }

      const methodMatch = line.match(METADATA_PATTERNS.METHOD);
      if (methodMatch) {
        metadata.method = methodMatch[2].trim();
        this.consume();
        continue;
      }

      const modelsMatch = line.match(METADATA_PATTERNS.MODELS);
      if (modelsMatch) {
        metadata.models = modelsMatch[2].trim().split(",").map(m => m.trim());
        this.consume();
        continue;
      }

      if (STRUCTURAL_PATTERNS.SEPARATOR.test(line) || STRUCTURAL_PATTERNS.QUESTION.test(line)) {
        break;
      }

      this.consume();
    }

    return metadata;
  }

  /** Parse question section - shared across all methods */
  protected parseQuestion(): string {
    // Skip to Question section
    while (this.hasMore() && !STRUCTURAL_PATTERNS.QUESTION.test(this.peek())) {
      this.consume();
    }
    this.consume(); // Skip "## Question"
    this.skipEmpty();

    // Parse question (blockquote)
    let question = "";
    if (this.peek().startsWith(">")) {
      question = this.consume().replace(/^>\s*/, "");
      while (this.hasMore() && this.peek().startsWith(">")) {
        question += " " + this.consume().replace(/^>\s*/, "");
      }
    }

    return question;
  }

  /** Skip to Discussion section */
  protected skipToDiscussion(): void {
    while (this.hasMore() && !STRUCTURAL_PATTERNS.DISCUSSION.test(this.peek())) {
      this.consume();
    }
    this.consume(); // Skip "## Discussion"
    this.skipEmpty();
  }

  /** Skip to Result section */
  protected skipToResult(): boolean {
    while (this.hasMore() && !STRUCTURAL_PATTERNS.RESULT.test(this.peek())) {
      this.consume();
    }
    return this.hasMore() && STRUCTURAL_PATTERNS.RESULT.test(this.peek());
  }

  /** Check if current line starts a new message or phase */
  protected isMessageOrPhaseEnd(): boolean {
    const line = this.peek();
    return (
      STRUCTURAL_PATTERNS.MESSAGE.test(line) ||
      STRUCTURAL_PATTERNS.PHASE.test(line) ||
      STRUCTURAL_PATTERNS.RESULT.test(line) ||
      (STRUCTURAL_PATTERNS.SEPARATOR.test(line) && this.looksLikeResultAhead())
    );
  }

  /** Look ahead to check if result section follows */
  protected looksLikeResultAhead(): boolean {
    let lookAhead = this.index + 1;
    while (lookAhead < this.lines.length && !this.lines[lookAhead]?.trim()) {
      lookAhead++;
    }
    return lookAhead < this.lines.length && STRUCTURAL_PATTERNS.RESULT.test(this.lines[lookAhead].trim());
  }

  /** Collect content until next section marker */
  protected collectUntilNextSection(): string {
    const contentLines: string[] = [];
    while (
      this.hasMore() &&
      !STRUCTURAL_PATTERNS.AGREEMENTS.test(this.peek()) &&
      !STRUCTURAL_PATTERNS.DISAGREEMENTS.test(this.peek()) &&
      !STRUCTURAL_PATTERNS.MISSING.test(this.peek()) &&
      !this.isMessageOrPhaseEnd()
    ) {
      contentLines.push(this.consume());
    }
    return contentLines.join("\n").trim();
  }

  /** Collect message content until next message/phase/result */
  protected collectMessageContent(): string {
    const contentLines: string[] = [];
    while (this.hasMore()) {
      const line = this.peek();

      if (
        STRUCTURAL_PATTERNS.MESSAGE.test(line) ||
        STRUCTURAL_PATTERNS.PHASE.test(line) ||
        STRUCTURAL_PATTERNS.RESULT.test(line) ||
        (STRUCTURAL_PATTERNS.SEPARATOR.test(line) && this.looksLikeResultAhead())
      ) {
        break;
      }

      contentLines.push(this.consume());
    }
    return contentLines.join("\n").trim();
  }

  /** Parse a phase header and return its components */
  protected parsePhaseHeader(): { number: number; title: string } | null {
    const line = this.peek();
    const match = line.match(STRUCTURAL_PATTERNS.PHASE);
    if (!match) return null;

    this.consume();
    this.skipEmpty();

    return {
      number: parseInt(match[2]),
      title: line.replace(/^###\s*/, ""),
    };
  }

  /** Parse a message header and return its components */
  protected parseMessageHeader(): { source: string; role: ParsedRole; messageType: string | null } | null {
    const line = this.peek();
    const match = line.match(STRUCTURAL_PATTERNS.MESSAGE);
    if (!match) return null;

    this.consume();
    this.skipEmpty();

    return {
      source: match[1].trim(),
      role: (match[2] as ParsedRole) || null,
      messageType: match[3] || null,
    };
  }

  /** Check if a message type label indicates a critique */
  protected isCritiqueType(messageType: string | null): boolean {
    return messageType !== null && MESSAGE_TYPE_LABELS.CRITIQUE.includes(messageType);
  }

  /** Check if a message type label indicates a final position */
  protected isPositionType(messageType: string | null): boolean {
    return messageType !== null && MESSAGE_TYPE_LABELS.POSITION.includes(messageType);
  }

  /** Parse critique fields (agreements/disagreements/missing) */
  protected parseCritiqueFields(): { agreements: string; disagreements: string; missing: string } {
    const fields = { agreements: "", disagreements: "", missing: "" };

    while (this.hasMore() && !this.isMessageOrPhaseEnd()) {
      const line = this.peek();

      if (STRUCTURAL_PATTERNS.AGREEMENTS.test(line)) {
        this.consume();
        this.skipEmpty();
        fields.agreements = this.collectUntilNextSection();
      } else if (STRUCTURAL_PATTERNS.DISAGREEMENTS.test(line)) {
        this.consume();
        this.skipEmpty();
        fields.disagreements = this.collectUntilNextSection();
      } else if (STRUCTURAL_PATTERNS.MISSING.test(line)) {
        this.consume();
        this.skipEmpty();
        fields.missing = this.collectUntilNextSection();
      } else {
        this.consume();
      }
    }

    return fields;
  }

  /** Parse position message with confidence */
  protected parsePositionContent(): { content: string; confidence: string } {
    const contentLines: string[] = [];
    let confidence = "";

    while (this.hasMore() && !this.isMessageOrPhaseEnd()) {
      const line = this.peek();
      const confMatch = line.match(STRUCTURAL_PATTERNS.CONFIDENCE);
      if (confMatch) {
        confidence = confMatch[2].trim();
        this.consume();
      } else {
        contentLines.push(this.consume());
      }
    }

    return {
      content: contentLines.join("\n").trim(),
      confidence,
    };
  }

  /** Parse synthesis/result section - returns raw fields for method-specific processing */
  protected parseRawSynthesis(): {
    resultLabel: string;
    consensusLabel: string;
    consensus: string;
    byLabel: string;
    synthesizer: string;
    synthesisLabel: string;
    synthesis: string;
    differencesLabel: string;
    differences: string;
  } {
    const result = {
      resultLabel: "",
      consensusLabel: "",
      consensus: "",
      byLabel: "",
      synthesizer: "",
      synthesisLabel: "",
      synthesis: "",
      differencesLabel: "",
      differences: "",
    };

    // Get result header
    const resultMatch = this.peek().match(STRUCTURAL_PATTERNS.RESULT);
    result.resultLabel = resultMatch ? resultMatch[1] : "Result";
    this.consume();
    this.skipEmpty();

    while (this.hasMore()) {
      const line = this.peek();

      if (STRUCTURAL_PATTERNS.SEPARATOR.test(line) || STRUCTURAL_PATTERNS.FOOTER.test(line)) {
        break;
      }

      const consMatch = line.match(STRUCTURAL_PATTERNS.CONSENSUS_LINE);
      if (consMatch) {
        result.consensusLabel = consMatch[1];
        result.consensus = consMatch[2].trim();
        this.consume();
        continue;
      }

      const synthMatch = line.match(STRUCTURAL_PATTERNS.SYNTHESIZER_LINE);
      if (synthMatch) {
        result.byLabel = synthMatch[1];
        result.synthesizer = synthMatch[2].trim();
        this.consume();
        continue;
      }

      const synthHeaderMatch = line.match(STRUCTURAL_PATTERNS.SYNTHESIS_HEADER);
      if (synthHeaderMatch) {
        result.synthesisLabel = synthHeaderMatch[1];
        this.consume();
        this.skipEmpty();
        const synthLines: string[] = [];
        while (
          this.hasMore() &&
          !STRUCTURAL_PATTERNS.DIFFERENCES_HEADER.test(this.peek()) &&
          !STRUCTURAL_PATTERNS.FOOTER.test(this.peek())
        ) {
          synthLines.push(this.consume());
        }
        result.synthesis = synthLines.join("\n").trim();
        continue;
      }

      const diffHeaderMatch = line.match(STRUCTURAL_PATTERNS.DIFFERENCES_HEADER);
      if (diffHeaderMatch) {
        result.differencesLabel = diffHeaderMatch[1];
        this.consume();
        this.skipEmpty();
        const diffLines: string[] = [];
        while (
          this.hasMore() &&
          !STRUCTURAL_PATTERNS.SEPARATOR.test(this.peek()) &&
          !STRUCTURAL_PATTERNS.FOOTER.test(this.peek())
        ) {
          diffLines.push(this.consume());
        }
        result.differences = diffLines.join("\n").trim();
        continue;
      }

      this.consume();
    }

    return result;
  }
}
