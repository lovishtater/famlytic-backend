import { getSession } from '../config/database';
import { Relationship, CreateRelationshipRequest, RelationshipPath } from '../types';

export class RelationshipService {
  static async createRelationship(relationshipData: CreateRelationshipRequest): Promise<Relationship> {
    const session = getSession();
    
    try {
      // First verify both persons exist
      const personCheck = await session.run(`
        MATCH (a:Person {id: $personAId}), (b:Person {id: $personBId})
        RETURN a.id as aId, b.id as bId, a.name as aName, b.name as bName
      `, {
        personAId: relationshipData.personA,
        personBId: relationshipData.personB,
      });
      
      if (personCheck.records.length === 0) {
        throw new Error('One or both persons not found');
      }
      
      const record = personCheck.records[0];
      
      // Create the relationship
      const query = `
        MATCH (a:Person {id: $personAId}), (b:Person {id: $personBId})
        CREATE (a)-[r:${relationshipData.type} {
          id: apoc.create.uuid(),
          createdAt: datetime()
        }]->(b)
        RETURN r, a.name as personA, b.name as personB
      `;
      
      const result = await session.run(query, {
        personAId: relationshipData.personA,
        personBId: relationshipData.personB,
        type: relationshipData.type,
      });
      
      if (result.records.length === 0) {
        throw new Error('Failed to create relationship');
      }
      
      const relRecord = result.records[0];
      const rel = relRecord.get('r').properties;
      
      return {
        id: rel.id,
        type: relationshipData.type,
        personA: relRecord.get('personA'),
        personB: relRecord.get('personB'),
        createdAt: rel.createdAt,
      };
    } finally {
      await session.close();
    }
  }
  
  static async getChildren(personId: string): Promise<string[]> {
    const session = getSession();
    
    try {
      const query = `
        MATCH (p:Person {id: $personId})-[:PARENT_OF]->(child:Person)
        RETURN child.name as childName
        ORDER BY child.name
      `;
      
      const result = await session.run(query, { personId });
      
      return result.records.map((record: any) => record.get('childName'));
    } finally {
      await session.close();
    }
  }
  
  static async getParents(personId: string): Promise<string[]> {
    const session = getSession();
    
    try {
      const query = `
        MATCH (parent:Person)-[:PARENT_OF]->(p:Person {id: $personId})
        RETURN parent.name as parentName
        ORDER BY parent.name
      `;
      
      const result = await session.run(query, { personId });
      
      return result.records.map((record: any) => record.get('parentName'));
    } finally {
      await session.close();
    }
  }
  
  static async getSpouses(personId: string): Promise<string[]> {
    const session = getSession();
    
    try {
      const query = `
        MATCH (person:Person {id: $personId})-[:SPOUSE_OF]-(spouse:Person)
        RETURN spouse.name as spouseName
        ORDER BY spouse.name
      `;
      
      const result = await session.run(query, { personId });
      
      return result.records.map((record: any) => record.get('spouseName'));
    } finally {
      await session.close();
    }
  }
  
  static async getRelationshipPath(personAId: string, personBId: string): Promise<RelationshipPath> {
    const session = getSession();
    
    try {
      const query = `
        MATCH path = shortestPath((a:Person {id: $personAId})-[*..10]-(b:Person {id: $personBId}))
        RETURN path
      `;
      
      const result = await session.run(query, { personAId, personBId });
      
      if (result.records.length === 0) {
        return { path: [], description: 'No relationship found' };
      }
      
      const path = result.records[0].get('path');
      const pathElements: any[] = [];
      
      // Extract nodes and relationships from the path
      for (const segment of path.segments || []) {
        const startNode = segment.start.properties;
        const endNode = segment.end.properties;
        const relationship = segment.relationship.properties;
        
        pathElements.push({
          person: startNode.name,
          relationship: relationship.type || 'UNKNOWN',
        });
        
        // Add the end node of the last segment
        if (segment === path.segments[path.segments.length - 1]) {
          pathElements.push({
            person: endNode.name,
            relationship: 'END',
          });
        }
      }
      
      // Generate a readable description
      let description = `${pathElements[0]?.person || 'Person A'} is `;
      const relationships = [];
      
      for (let i = 0; i < pathElements.length - 1; i++) {
        relationships.push(pathElements[i].relationship.toLowerCase());
      }
      
      description += relationships.join(', ') + ` of ${pathElements[pathElements.length - 1]?.person || 'Person B'}`;
      
      return {
        path: pathElements,
        description,
      };
    } finally {
      await session.close();
    }
  }
  
  static async getAllRelationships(personId?: string): Promise<Relationship[]> {
    const session = getSession();
    
    try {
      let query: string;
      const params: Record<string, any> = {};
      
      if (personId) {
        query = `
          MATCH (a:Person)-[r]->(b:Person)
          WHERE a.id = $personId OR b.id = $personId
          RETURN r.id as id, r.type as type, a.id as personA, b.id as personB, r.createdAt as createdAt
          ORDER BY r.createdAt
        `;
        params.personId = personId;
      } else {
        query = `
          MATCH (a:Person)-[r]->(b:Person)
          RETURN r.id as id, r.type as type, a.id as personA, b.id as personB, r.createdAt as createdAt
          ORDER BY r.createdAt
        `;
      }
      
      const result = await session.run(query, params);
      
      return result.records.map((record: any) => ({
        id: record.get('id'),
        type: record.get('type'),
        personA: record.get('personA'),
        personB: record.get('personB'),
        createdAt: record.get('createdAt'),
      }));
    } finally {
      await session.close();
    }
  }
}