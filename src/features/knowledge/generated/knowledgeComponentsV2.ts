// Generated from RTW goctl TypeScript; v2 history DTOs and their type dependencies.
export interface AcceptedAnswerV2 {
  answer_id: string;
  search_id: string;
  subject: AcceptedSubjectRefV2;
  session_id: string;
  status: string;
  accepted_ordinal: number;
  accepted_at: string;
  turn_json: string;
}

export interface AcceptedAnswerV2Envelope {
  code: number;
  msg: string;
  data: AcceptedAnswerV2;
}

export interface AcceptedAnswersPageV2 {
  items: Array<AcceptedAnswerV2>;
  next_ordinal?: number;
}

export interface AcceptedAnswersPageV2Envelope {
  code: number;
  msg: string;
  data: AcceptedAnswersPageV2;
}

export interface AcceptedSubjectRefV2 {
  issuer: string;
  subject_id: string;
}
