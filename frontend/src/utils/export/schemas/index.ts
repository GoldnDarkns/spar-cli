/**
 * Export schemas index - re-exports all schema types
 */

// Base schema
export {
  SCHEMA_VERSION,
  type DiscussionMethod,
  type BaseMetadata,
  type BaseMessage,
  type BasePhase,
  type BaseSynthesis,
  type BaseExportDocument,
  type ParseResult,
  type ConfidenceLevel,
  type ConfidenceBreakdown,
} from "./base-schema.js";

// Standard method
export {
  type StandardMetadata,
  type StandardIndependentAnswer,
  type StandardCritique,
  type StandardDiscussionMessage,
  type StandardFinalPosition,
  type StandardPhase1,
  type StandardPhase2,
  type StandardPhase3,
  type StandardPhase4,
  type StandardSynthesisMessage,
  type StandardPhase5,
  type StandardConsensus,
  type StandardSynthesis,
  type StandardExportDocument,
} from "./standard-schema.js";

// Oxford method
export {
  type OxfordRole,
  type OxfordRoundType,
  type OxfordDecision,
  type OxfordMetadata,
  type OxfordDebateMessage,
  type OxfordJudgementMessage,
  type OxfordPhase1,
  type OxfordPhase2,
  type OxfordPhase3,
  type OxfordPhase4,
  type OxfordJudgement,
  type OxfordExportDocument,
} from "./oxford-schema.js";

// Advocate method
export {
  type AdvocateRole,
  type AdvocateMetadata,
  type DefenderPosition,
  type CrossExaminationMessage,
  type AdvocateVerdictMessage,
  type AdvocatePhase1,
  type AdvocatePhase2,
  type AdvocatePhase3,
  type AdvocateVerdict,
  type AdvocateExportDocument,
} from "./advocate-schema.js";

// Socratic method
export {
  type SocraticRole,
  type AporeaReached,
  type SocraticMetadata,
  type SocraticMessage,
  type SocraticSynthesisMessage,
  type SocraticPhase1,
  type SocraticPhase2,
  type SocraticPhase3,
  type SocraticSynthesis,
  type SocraticExportDocument,
} from "./socratic-schema.js";

// Delphi method
export {
  type DelphiConvergence,
  type DelphiMetadata,
  type DelphiEstimate,
  type DelphiRound,
  type DelphiAggregationMessage,
  type DelphiAggregationPhase,
  type DelphiAggregation,
  type DelphiExportDocument,
} from "./delphi-schema.js";

// Brainstorm method
export {
  type BrainstormMetadata,
  type IdeatorMessage,
  type BrainstormSynthesisMessage,
  type BrainstormPhase1,
  type BrainstormPhase2,
  type BrainstormPhase3,
  type BrainstormPhase4,
  type SelectedIdea,
  type BrainstormSynthesis,
  type BrainstormExportDocument,
} from "./brainstorm-schema.js";

// Tradeoff method
export {
  type TradeoffAgreement,
  type TradeoffMetadata,
  type EvaluatorMessage,
  type TradeoffEvaluation,
  type TradeoffDecisionMessage,
  type TradeoffPhase1,
  type TradeoffPhase2,
  type TradeoffPhase3,
  type TradeoffPhase4,
  type TradeoffDecision,
  type TradeoffExportDocument,
} from "./tradeoff-schema.js";

/** Union of all export document types */
export type AnyExportDocument =
  | import("./standard-schema.js").StandardExportDocument
  | import("./oxford-schema.js").OxfordExportDocument
  | import("./advocate-schema.js").AdvocateExportDocument
  | import("./socratic-schema.js").SocraticExportDocument
  | import("./delphi-schema.js").DelphiExportDocument
  | import("./brainstorm-schema.js").BrainstormExportDocument
  | import("./tradeoff-schema.js").TradeoffExportDocument;
