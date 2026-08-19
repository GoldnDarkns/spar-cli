/**
 * PDF rendering for Quorum discussion exports.
 * Uses method-aware parser structure for consistent rendering.
 */

import type {
  BaseExportDocument,
  BasePhase,
  BaseMessage,
  BaseSynthesis,
  DiscussionMethod,
} from "./schemas/base-schema.js";
import { getMethodTerminology } from "./method-terminology.js";
import { t } from "../../i18n/index.js";

// PDF page configuration
const PDF_CONFIG = {
  pageWidth: 595,
  contentWidth: 495, // 595 - 100 (margins)
  leftMargin: 50,
  pageBreakThreshold: 700,
  messagePageBreak: 680,
  colors: {
    title: "#1e3a8a",
    header: "#1e40af",
    metaBox: "#f3f4f6",
    metaText: "#374151",
    questionBg: "#eff6ff",
    questionAccent: "#3b82f6",
    questionText: "#1e3a8a",
    bodyText: "#374151",
    muted: "#6b7280",
    footer: "#9ca3af",
    footerLine: "#d1d5db",
    critique: "#8b5cf6",
    position: "#0891b2",
    agreements: "#16a34a",
    disagreements: "#dc2626",
    missing: "#ca8a04",
    differences: "#b45309",
    // Role colors
    for: "#22c55e",
    against: "#ef4444",
    questioner: "#06b6d4",
    respondent: "#eab308",
    panelist: "#a855f7",
    ideator: "#06b6d4",
    evaluator: "#3b82f6",
    neutral: "#6b7280",
  },
};

/**
 * Get role-specific color for message headers.
 */
function getRoleColor(role: string | null): string {
  const { colors } = PDF_CONFIG;
  switch (role) {
    case "FOR":
    case "DEFENDER":
      return colors.for;
    case "AGAINST":
    case "ADVOCATE":
      return colors.against;
    case "QUESTIONER":
      return colors.questioner;
    case "RESPONDENT":
      return colors.respondent;
    case "PANELIST":
      return colors.panelist;
    case "IDEATOR":
      return colors.ideator;
    case "EVALUATOR":
      return colors.evaluator;
    default:
      return colors.neutral;
  }
}

/**
 * Translate role to localized string.
 * Uses same keys as protocol-values.ts ROLE_KEYS.
 */
function translateRole(role: string): string {
  const roleMap: Record<string, string> = {
    FOR: t("role.for"),
    AGAINST: t("role.against"),
    ADVOCATE: t("role.advocate"),
    DEFENDER: t("role.defender"),
    QUESTIONER: t("role.questioner"),
    RESPONDENT: t("role.respondent"),
    PANELIST: t("role.panelist"),
    IDEATOR: t("role.ideator"),
    EVALUATOR: t("role.evaluator"),
  };
  return roleMap[role] || role;
}

/**
 * Translate confidence level to localized string.
 * Uses same keys as protocol-values.ts CONFIDENCE_KEYS.
 */
function translateConfidence(confidence: string): string {
  const confMap: Record<string, string> = {
    HIGH: t("msg.confidence.high"),
    MEDIUM: t("msg.confidence.medium"),
    LOW: t("msg.confidence.low"),
  };
  return confMap[confidence] || confidence;
}

/**
 * Translate consensus/decision value to localized string.
 * Uses same keys as protocol-values.ts CONSENSUS_KEYS.
 * Oxford decisions use role keys for FOR/AGAINST.
 */
function translateConsensusValue(method: DiscussionMethod, value: string): string {
  if (method === "oxford") {
    // Oxford uses FOR/AGAINST which are role values
    const map: Record<string, string> = {
      FOR: t("role.for"),
      AGAINST: t("role.against"),
      PARTIAL: t("consensus.partial"),
    };
    return map[value] || value;
  }
  const map: Record<string, string> = {
    YES: t("consensus.yes"),
    NO: t("consensus.no"),
    PARTIAL: t("consensus.partial"),
  };
  return map[value] || value;
}

/**
 * Check if a message is a synthesis/final message type.
 */
function isSynthesisMessage(msg: BaseMessage): boolean {
  const msgAny = msg as any;
  return (
    msgAny.type === "synthesis" ||
    msgAny.type === "judgement" ||
    msgAny.type === "verdict" ||
    msgAny.type === "aggregation" ||
    msgAny.type === "decision"
  );
}

/**
 * Check if a message is a critique type.
 */
function isCritiqueMessage(msg: BaseMessage): boolean {
  return (msg as any).type === "critique";
}

/**
 * Check if a message is a position type.
 */
function isPositionMessage(msg: BaseMessage): boolean {
  return (msg as any).type === "position";
}

/**
 * PDF Renderer for Quorum discussion documents.
 * Works with method-aware parser structure.
 */
export class PDFRenderer {
  private doc: PDFKit.PDFDocument;
  private formatModelName: (id: string) => string;
  private renderMarkdown: (doc: PDFKit.PDFDocument, text: string, width?: number) => void;
  private method: DiscussionMethod;

  constructor(
    doc: PDFKit.PDFDocument,
    formatModelName: (id: string) => string,
    renderMarkdown: (doc: PDFKit.PDFDocument, text: string, width?: number) => void
  ) {
    this.doc = doc;
    this.formatModelName = formatModelName;
    this.renderMarkdown = renderMarkdown;
    this.method = "standard";
  }

  /**
   * Render a complete discussion document to PDF.
   */
  render(document: BaseExportDocument): void {
    const { metadata, phases, synthesis } = document;
    this.method = metadata.method;

    this.renderHeader(metadata);
    this.renderQuestion(metadata.question);
    this.renderDiscussionHeader();
    this.renderPhases(phases, synthesis);
    this.renderFooter();
  }

  /**
   * Render document header with title and metadata box.
   */
  private renderHeader(metadata: { date: string; method: string; models: string[] }): void {
    const { leftMargin, contentWidth, colors } = PDF_CONFIG;

    // Title
    this.doc.fontSize(22).font("DejaVu-Bold").fillColor(colors.title)
      .text(t("export.doc.title"), { align: "center" });
    this.doc.fillColor("black").moveDown(0.5);

    // Metadata box
    const formattedModels = metadata.models
      .map(m => this.formatModelName(m.trim()))
      .join(", ");

    const metaY = this.doc.y;
    this.doc.rect(leftMargin, metaY, contentWidth, 50).fill(colors.metaBox);
    this.doc.fillColor(colors.metaText).fontSize(10).font("DejaVu");
    this.doc.text(`${t("export.doc.dateLabel")} ${metadata.date}`, leftMargin + 10, metaY + 10);
    this.doc.text(`${t("export.doc.methodLabel")} ${metadata.method}`, leftMargin + 10, metaY + 22);
    this.doc.text(`${t("export.doc.modelsLabel")} ${formattedModels}`, leftMargin + 10, metaY + 34);
    this.doc.y = metaY + 60;
  }

  /**
   * Render the question section with styled blockquote.
   */
  private renderQuestion(question: string): void {
    const { leftMargin, contentWidth, colors } = PDF_CONFIG;

    this.doc.moveDown(0.5);
    this.doc.fontSize(14).font("DejaVu-Bold").fillColor(colors.header).text(t("export.doc.questionHeader"));
    this.doc.fillColor("black").moveDown(0.3);

    const questionY = this.doc.y;
    this.doc.fontSize(11).font("DejaVu");
    const questionHeight = this.doc.heightOfString(question, { width: contentWidth - 24 }) + 16;

    this.doc.rect(leftMargin, questionY, contentWidth, questionHeight).fill(colors.questionBg);
    this.doc.rect(leftMargin, questionY, 4, questionHeight).fill(colors.questionAccent);
    this.doc.fillColor(colors.questionText);
    this.doc.text(question, leftMargin + 14, questionY + 8, { width: contentWidth - 24 });
    this.doc.y = questionY + questionHeight + 10;
  }

  /**
   * Render the "Discussion" section header.
   */
  private renderDiscussionHeader(): void {
    this.doc.fontSize(16).font("DejaVu-Bold").fillColor(PDF_CONFIG.colors.header).text(t("export.doc.discussionHeader"));
    this.doc.fillColor("black").moveDown(0.5);
  }

  /**
   * Render all phases with their messages.
   * The last phase contains synthesis which is rendered specially.
   */
  private renderPhases(phases: BasePhase[], synthesis: BaseSynthesis | null): void {
    const totalPhases = phases.length;

    for (let i = 0; i < phases.length; i++) {
      const phase = phases[i];
      const isLastPhase = i === totalPhases - 1;

      // Check if this phase contains only synthesis messages
      const hasSynthesisOnly = phase.messages.length > 0 &&
        phase.messages.every(msg => isSynthesisMessage(msg));

      if (isLastPhase && hasSynthesisOnly && synthesis) {
        // Render synthesis phase with special styling
        this.renderSynthesisPhase(phase, synthesis);
      } else if (phase.messages.length > 0) {
        // Render regular phase
        this.renderPhase(phase);
      }
    }
  }

  /**
   * Render a single phase with its messages.
   */
  private renderPhase(phase: BasePhase): void {
    const { leftMargin, contentWidth, pageBreakThreshold, colors } = PDF_CONFIG;

    if (this.doc.y > pageBreakThreshold) this.doc.addPage();
    this.doc.moveDown(0.8);

    // Phase banner
    this.doc.fontSize(12).font("DejaVu-Bold");
    const textHeight = this.doc.heightOfString(phase.name, { width: contentWidth - 30 });
    const bannerHeight = Math.max(30, textHeight + 16);

    const phaseY = this.doc.y;
    this.doc.rect(leftMargin, phaseY, contentWidth, bannerHeight).fill(colors.header);
    this.doc.fillColor("white");
    this.doc.text(phase.name, leftMargin + 15, phaseY + 8, { width: contentWidth - 30 });
    this.doc.y = phaseY + bannerHeight + 10;

    // Render messages (skip synthesis messages - they're rendered separately)
    for (const msg of phase.messages) {
      if (!isSynthesisMessage(msg)) {
        this.renderMessage(msg);
      }
    }
  }

  /**
   * Render a single message based on its type.
   */
  private renderMessage(msg: BaseMessage): void {
    const { messagePageBreak } = PDF_CONFIG;
    if (this.doc.y > messagePageBreak) this.doc.addPage();

    if (isCritiqueMessage(msg)) {
      this.renderCritiqueMessage(msg);
    } else if (isPositionMessage(msg)) {
      this.renderPositionMessage(msg);
    } else {
      this.renderAnswerMessage(msg);
    }
  }

  /**
   * Render a critique message with agreements/disagreements/missing sections.
   */
  private renderCritiqueMessage(msg: BaseMessage): void {
    const { leftMargin, contentWidth, colors } = PDF_CONFIG;
    const source = this.formatModelName(msg.source);
    const msgAny = msg as any;

    const msgY = this.doc.y;
    this.doc.rect(leftMargin, msgY, contentWidth, 22).fill(colors.critique);
    this.doc.fillColor("white").fontSize(10).font("DejaVu-Bold");
    this.doc.text(`${source} (${t("export.doc.critiqueLabel")})`, leftMargin + 10, msgY + 6);
    this.doc.y = msgY + 30;

    if (msgAny.agreements) {
      this.doc.font("DejaVu-Bold").fillColor(colors.agreements).text(`${t("export.doc.agreementsLabel")}`, leftMargin);
      this.doc.font("DejaVu").fillColor(colors.bodyText).fontSize(10);
      this.doc.x = leftMargin;
      this.renderMarkdown(this.doc, msgAny.agreements, contentWidth);
      this.doc.moveDown(0.3);
    }
    if (msgAny.disagreements) {
      this.doc.font("DejaVu-Bold").fillColor(colors.disagreements).text(`${t("export.doc.disagreementsLabel")}`, leftMargin);
      this.doc.font("DejaVu").fillColor(colors.bodyText).fontSize(10);
      this.doc.x = leftMargin;
      this.renderMarkdown(this.doc, msgAny.disagreements, contentWidth);
      this.doc.moveDown(0.3);
    }
    if (msgAny.missing) {
      this.doc.font("DejaVu-Bold").fillColor(colors.missing).text(`${t("export.doc.missingLabel")}`, leftMargin);
      this.doc.font("DejaVu").fillColor(colors.bodyText).fontSize(10);
      this.doc.x = leftMargin;
      this.renderMarkdown(this.doc, msgAny.missing, contentWidth);
    }
    this.doc.moveDown(1);
  }

  /**
   * Render a final position message with confidence indicator.
   */
  private renderPositionMessage(msg: BaseMessage): void {
    const { leftMargin, contentWidth, colors } = PDF_CONFIG;
    const source = this.formatModelName(msg.source);
    const msgAny = msg as any;

    const msgY = this.doc.y;
    this.doc.rect(leftMargin, msgY, contentWidth, 22).fill(colors.position);
    this.doc.fillColor("white").fontSize(10).font("DejaVu-Bold");
    this.doc.text(`${source} (${t("export.doc.finalPositionLabel")})`, leftMargin + 10, msgY + 6);

    const confidence = msgAny.confidence || "";
    const confColor = confidence === "HIGH" ? colors.agreements
      : confidence === "MEDIUM" ? colors.missing
      : colors.disagreements;

    this.doc.y = msgY + 28;
    this.doc.fillColor(confColor).fontSize(10).font("DejaVu-Bold");
    this.doc.text(`${t("export.doc.confidenceLabel")} ${translateConfidence(confidence)}`, leftMargin);

    this.doc.fillColor(colors.bodyText).font("DejaVu").fontSize(10);
    this.doc.moveDown(0.3);
    this.doc.x = leftMargin;
    this.renderMarkdown(this.doc, msg.content, contentWidth);
    this.doc.moveDown(1);
  }

  /**
   * Render a regular answer/chat message.
   */
  private renderAnswerMessage(msg: BaseMessage): void {
    const { leftMargin, contentWidth, colors } = PDF_CONFIG;
    const source = this.formatModelName(msg.source);
    const roleColor = getRoleColor(msg.role);

    const msgY = this.doc.y;
    this.doc.rect(leftMargin, msgY, contentWidth, 22).fill(roleColor);
    const roleTag = msg.role ? ` [${translateRole(msg.role)}]` : "";
    this.doc.fillColor("white").fontSize(10).font("DejaVu-Bold");
    this.doc.text(`${source}${roleTag}`, leftMargin + 10, msgY + 6, { width: contentWidth - 20 });

    this.doc.fillColor(colors.bodyText).font("DejaVu").fontSize(10);
    this.doc.y = msgY + 30;
    this.doc.x = leftMargin;
    this.renderMarkdown(this.doc, msg.content, contentWidth);
    this.doc.moveDown(1);
  }

  /**
   * Render the synthesis phase (last phase) with special result styling.
   */
  private renderSynthesisPhase(phase: BasePhase, synthesis: BaseSynthesis): void {
    const { leftMargin, contentWidth, colors } = PDF_CONFIG;

    if (this.doc.y > 600) this.doc.addPage();
    this.doc.moveDown(1);

    // Get method-specific terminology
    const term = getMethodTerminology(this.method);
    const bannerColor = term?.bannerColor || "#065f46";

    // Result banner (use phase name which contains the localized title)
    const resultY = this.doc.y;
    this.doc.rect(leftMargin, resultY, contentWidth, 35).fill(bannerColor);
    this.doc.fillColor("white").fontSize(14).font("DejaVu-Bold");
    this.doc.text(phase.name, leftMargin + 15, resultY + 10);
    this.doc.y = resultY + 45;

    // Get consensus/decision value from synthesis
    const consensusValue = this.getConsensusValue(synthesis);

    // Consensus line (skip for Advocate)
    if (this.method !== "advocate" && consensusValue) {
      const consensusColor = this.getConsensusColor(consensusValue);
      this.doc.fillColor(consensusColor).fontSize(12).font("DejaVu-Bold");
      this.doc.text(`${term.consensusLabel}: ${translateConsensusValue(this.method, consensusValue)}`, leftMargin);
    }

    // Synthesizer attribution
    if (synthesis.synthesizer) {
      this.doc.fillColor(colors.muted).fontSize(10).font("DejaVu");
      this.doc.text(`${term.byLabel}: ${this.formatModelName(synthesis.synthesizer)}`, leftMargin);
    }
    this.doc.moveDown(0.5);

    // Synthesis content
    if (synthesis.content) {
      this.doc.fillColor(colors.header).fontSize(12).font("DejaVu-Bold").text(term.synthesisLabel);
      this.doc.fillColor(colors.bodyText).fontSize(10).font("DejaVu").moveDown(0.3);
      this.doc.x = leftMargin;
      this.renderMarkdown(this.doc, synthesis.content, contentWidth);
    }

    // Differences section
    const differences = this.getDifferencesValue(synthesis);
    if (differences && differences !== "See verdict above for unresolved questions.") {
      this.doc.moveDown(0.8);
      this.doc.fillColor(colors.differences).fontSize(12).font("DejaVu-Bold").text(term.differencesLabel);
      this.doc.fillColor(colors.bodyText).fontSize(10).font("DejaVu").moveDown(0.3);
      this.doc.x = leftMargin;
      this.renderMarkdown(this.doc, differences, contentWidth);
    }
  }

  /**
   * Extract consensus/decision value from method-specific synthesis.
   */
  private getConsensusValue(synthesis: BaseSynthesis): string {
    const synthAny = synthesis as any;
    return (
      synthAny.consensus ||
      synthAny.decision ||
      synthAny.aporeaReached ||
      synthAny.convergence ||
      synthAny.agreement ||
      (synthAny.ideasSelected ? `${synthAny.ideasSelected} SELECTED` : "") ||
      ""
    );
  }

  /**
   * Extract differences value from method-specific synthesis.
   */
  private getDifferencesValue(synthesis: BaseSynthesis): string {
    const synthAny = synthesis as any;
    return (
      synthAny.differences ||
      synthAny.keyContentions ||
      synthAny.unresolvedQuestions ||
      synthAny.openQuestions ||
      synthAny.outlierPerspectives ||
      synthAny.alternativeDirections ||
      synthAny.keyTradeoffs ||
      ""
    );
  }

  /**
   * Get consensus color based on method and value.
   */
  private getConsensusColor(consensus: string): string {
    const { colors } = PDF_CONFIG;
    if (this.method === "oxford") {
      return consensus === "FOR" ? colors.agreements
        : consensus === "AGAINST" ? colors.disagreements
        : colors.missing;
    }
    if (this.method === "brainstorm") {
      return colors.position;
    }
    if (this.method === "tradeoff") {
      return consensus === "YES" ? colors.agreements : colors.missing;
    }
    // Standard/Socratic/Delphi
    return consensus === "YES" ? colors.agreements
      : consensus === "PARTIAL" ? colors.missing
      : colors.disagreements;
  }

  /**
   * Render the document footer.
   */
  private renderFooter(): void {
    const { leftMargin, contentWidth, colors } = PDF_CONFIG;

    this.doc.moveDown(2);
    this.doc.moveTo(leftMargin, this.doc.y).lineTo(leftMargin + contentWidth, this.doc.y).stroke(colors.footerLine);
    this.doc.moveDown(0.5);
    this.doc.fontSize(8).font("DejaVu").fillColor(colors.footer);
    this.doc.text(t("export.doc.footer"), { align: "center" });
  }
}

/** PDF configuration export for external use */
export { PDF_CONFIG };
