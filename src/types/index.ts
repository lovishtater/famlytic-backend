export interface Person {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  nickname?: string;
  birthdate?: string;
  deathdate?: string;
  gender?: 'male' | 'female' | 'other';
  photo?: string;
  occupation?: string;
  description?: string;
  birthPlace?: string;
  deathPlace?: string;
  isAlive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePersonRequest {
  name: string;
  firstName?: string;
  lastName?: string;
  nickname?: string;
  birthdate?: string;
  deathdate?: string;
  gender?: 'male' | 'female' | 'other';
  photo?: string;
  occupation?: string;
  description?: string;
  birthPlace?: string;
  deathPlace?: string;
  isAlive?: boolean;
}

export interface Event {
  id: string;
  type: string;
  date: string;
  description: string;
  people: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateEventRequest {
  type: string;
  date: string;
  description: string;
  people: string[];
}

export interface Relationship {
  id: string;
  type: 'PARENT_OF' | 'CHILD_OF' | 'SPOUSE_OF' | 'SIBLING_OF' | 'CUSTOM';
  personA: string; // Person ID
  personB: string; // Person ID
  createdAt: string;
}

export interface CreateRelationshipRequest {
  personA: string;
  personB: string;
  type: 'PARENT_OF' | 'CHILD_OF' | 'SPOUSE_OF' | 'SIBLING_OF' | 'CUSTOM';
}

export interface RelationshipPath {
  path: RelationshipT[];
  description: string;
}

export interface RelationshipT {
  person: string;
  relationship: string;
}

export interface MapLocation {
  id: string;
  name: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  address?: string;
}

export interface AIQuery {
  task: 'get_children' | 'get_parents' | 'get_relationship' | 'get_events' | 'get_locations' | 'custom';
  person?: string;
  personB?: string;
  parameters?: Record<string, any>;
}

export interface AIResponse {
  answer: string;
  data?: any;
  suggestions?: string[];
}

// Family Tree specific types
export interface FamilyTreeResponse {
  focusPerson: Person;
  familyMembers: Person[];
  relationships: Relationship[];
  generations: Generation[];
  events: Event[];
  locations: MapLocation[];
}

export interface Generation {
  level: number; // 0 = focus person, -1 = parents, +1 = children
  members: Person[];
}

// Frontend visualization types
export interface D3Node {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  deathDate?: string;
  gender?: 'male' | 'female' | 'other';
  profileImage?: string;
  isAlive: boolean;
  generation: number;
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
}

export interface D3Link {
  source: string | D3Node;
  target: string | D3Node;
  relationshipType: string;
  strength: number;
}

export interface D3FamilyTreeData {
  nodes: D3Node[];
  links: D3Link[];
  generations: D3Generation[];
}

export interface D3Generation {
  level: number;
  nodes: D3Node[];
  yPosition: number;
}