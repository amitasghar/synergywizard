export type EntityType = "skill" | "support" | "passive";

export interface Entity {
  id: string;
  entity_type: EntityType;
  entity_slug: string;
  display_name: string;
  description?: string;
  class_tags: string[];
  mechanic_tags: string[];
  damage_tags: string[];
}

export interface SynergyEdge {
  from_entity_id: string;
  to_entity_id: string;
  interaction_type: "direct" | "extended" | "conditional";
  reason: string;
}

export interface ConversionOption {
  entity_id: string;
  display_name: string;
  current_tags: string[];
  can_convert_to: string[];
}

export interface AnalysisResult {
  direct_interactions: SynergyEdge[];
  extended_interactions: SynergyEdge[];
  loop_detected: boolean;
  damage_tags: string[];
  recommended_supports: string[];
  relevant_passives: string[];
  conversion_options: ConversionOption[];
  entities: Entity[];
}

export interface ConversionState {
  entityId: string;
  from: string;
  to: string;
}

export interface ExtendResult {
  skills: Entity[];
  supports: Entity[];
  passives: Entity[];
}

export interface SemanticSearchResult {
  entity_slug: string;
  display_name: string;
  entity_type: "skill" | "support" | "passive";
  mechanic_tags: string[];
  damage_tags: string[];
  class_tags: string[];
  similarity: number;
}
