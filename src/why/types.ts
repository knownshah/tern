export interface WhyDetectedInfo {
  [key: string]: string | number | undefined;
}

export interface WhyExplanation {
  matched: boolean;
  ruleId?: string;
  title: string;
  meaning: string;
  detected?: WhyDetectedInfo;
  suggestedFix: string;
  runCommand?: string;
  source: 'local-rule' | 'ai' | 'fallback';
}
