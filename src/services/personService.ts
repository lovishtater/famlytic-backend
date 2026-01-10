import { getSession } from '../config/database';
import { Person, CreatePersonRequest } from '../types';

export class PersonService {
  static async createPerson(personData: CreatePersonRequest): Promise<Person> {
    const session = getSession();
    
    try {
      const query = `
        CREATE (p:Person {
          id: apoc.create.uuid(),
          name: $name,
          firstName: $firstName,
          lastName: $lastName,
          nickname: $nickname,
          birthdate: $birthdate,
          deathdate: $deathdate,
          gender: $gender,
          photo: $photo,
          occupation: $occupation,
          description: $description,
          birthPlace: $birthPlace,
          deathPlace: $deathPlace,
          isAlive: $isAlive,
          createdAt: datetime(),
          updatedAt: datetime()
        })
        RETURN p
      `;
      
      const result = await session.run(query, {
        name: personData.name,
        firstName: personData.firstName || null,
        lastName: personData.lastName || null,
        nickname: personData.nickname || null,
        birthdate: personData.birthdate || null,
        deathdate: personData.deathdate || null,
        gender: personData.gender || null,
        photo: personData.photo || null,
        occupation: personData.occupation || null,
        description: personData.description || null,
        birthPlace: personData.birthPlace || null,
        deathPlace: personData.deathPlace || null,
        isAlive: personData.isAlive !== false, // Default to true
      });
      
      if (result.records.length === 0) {
        throw new Error('Failed to create person');
      }
      
      const person = result.records[0].get('p').properties;
      return person as Person;
    } finally {
      await session.close();
    }
  }
  
  static async getPersonById(id: string): Promise<Person | null> {
    const session = getSession();
    
    try {
      const query = `
        MATCH (p:Person {id: $id})
        RETURN p
      `;
      
      const result = await session.run(query, { id });
      
      if (result.records.length === 0) {
        return null;
      }
      
      const person = result.records[0].get('p').properties;
      return person as Person;
    } finally {
      await session.close();
    }
  }
  
  static async getPersonByName(name: string): Promise<Person | null> {
    const session = getSession();
    
    try {
      const query = `
        MATCH (p:Person {name: $name})
        RETURN p
      `;
      
      const result = await session.run(query, { name });
      
      if (result.records.length === 0) {
        return null;
      }
      
      const person = result.records[0].get('p').properties;
      return person as Person;
    } finally {
      await session.close();
    }
  }
  
  static async getAllPeople(): Promise<Person[]> {
    const session = getSession();
    
    try {
      const query = `
        MATCH (p:Person)
        RETURN p
        ORDER BY p.name
      `;
      
      const result = await session.run(query);
      
      return result.records.map(record => {
        const person = record.get('p').properties;
        return person as Person;
      });
    } finally {
      await session.close();
    }
  }
  
  static async updatePerson(id: string, updates: Partial<CreatePersonRequest>): Promise<Person | null> {
    const session = getSession();
    
    try {
      const setClauses = [];
      const params: Record<string, any> = { id };
      
      if (updates.name !== undefined) {
        setClauses.push('p.name = $name');
        params.name = updates.name;
      }
      if (updates.firstName !== undefined) {
        setClauses.push('p.firstName = $firstName');
        params.firstName = updates.firstName || null;
      }
      if (updates.lastName !== undefined) {
        setClauses.push('p.lastName = $lastName');
        params.lastName = updates.lastName || null;
      }
      if (updates.nickname !== undefined) {
        setClauses.push('p.nickname = $nickname');
        params.nickname = updates.nickname || null;
      }
      if (updates.birthdate !== undefined) {
        setClauses.push('p.birthdate = $birthdate');
        params.birthdate = updates.birthdate || null;
      }
      if (updates.deathdate !== undefined) {
        setClauses.push('p.deathdate = $deathdate');
        params.deathdate = updates.deathdate || null;
      }
      if (updates.gender !== undefined) {
        setClauses.push('p.gender = $gender');
        params.gender = updates.gender || null;
      }
      if (updates.photo !== undefined) {
        setClauses.push('p.photo = $photo');
        params.photo = updates.photo || null;
      }
      if (updates.occupation !== undefined) {
        setClauses.push('p.occupation = $occupation');
        params.occupation = updates.occupation || null;
      }
      if (updates.description !== undefined) {
        setClauses.push('p.description = $description');
        params.description = updates.description || null;
      }
      if (updates.birthPlace !== undefined) {
        setClauses.push('p.birthPlace = $birthPlace');
        params.birthPlace = updates.birthPlace || null;
      }
      if (updates.deathPlace !== undefined) {
        setClauses.push('p.deathPlace = $deathPlace');
        params.deathPlace = updates.deathPlace || null;
      }
      if (updates.isAlive !== undefined) {
        setClauses.push('p.isAlive = $isAlive');
        params.isAlive = updates.isAlive;
      }
      
      setClauses.push('p.updatedAt = datetime()');
      
      const query = `
        MATCH (p:Person {id: $id})
        SET ${setClauses.join(', ')}
        RETURN p
      `;
      
      const result = await session.run(query, params);
      
      if (result.records.length === 0) {
        return null;
      }
      
      const person = result.records[0].get('p').properties;
      return person as Person;
    } finally {
      await session.close();
    }
  }
  
  static async deletePerson(id: string): Promise<boolean> {
    const session = getSession();
    
    try {
      const query = `
        MATCH (p:Person {id: $id})
        DETACH DELETE p
      `;
      
      const result = await session.run(query, { id });
      return true;
    } finally {
      await session.close();
    }
  }

  // Get family tree data for visualization
  static async getFamilyTree(focusPersonId: string, depth: number = 3): Promise<any> {
    const session = getSession();
    
    try {
      const query = `
        MATCH (focus:Person {id: $focusPersonId})
        OPTIONAL MATCH path = (focus)-[:PARENT_OF|CHILD_OF|SPOUSE_OF|SIBLING_OF*1..${depth}]-(relative:Person)
        WITH focus, collect(DISTINCT relative) as familyMembers
        
        // Get all relationships
        MATCH (p1:Person)-[r:PARENT_OF|CHILD_OF|SPOUSE_OF|SIBLING_OF]->(p2:Person)
        WHERE p1.id IN [focus.id] + [m.id IN familyMembers] OR p2.id IN [focus.id] + [m.id IN familyMembers]
        
        RETURN focus, familyMembers, collect(DISTINCT r) as relationships
      `;
      
      const result = await session.run(query, { focusPersonId });
      
      if (result.records.length === 0) {
        return null;
      }
      
      const record = result.records[0];
      return {
        focusPerson: record.get('focus').properties,
        familyMembers: record.get('familyMembers').map((p: any) => p.properties),
        relationships: record.get('relationships').map((r: any) => ({
          id: r.properties.id,
          type: r.type,
          fromPersonId: r.start.properties.id,
          toPersonId: r.end.properties.id,
          createdAt: r.properties.createdAt
        }))
      };
    } finally {
      await session.close();
    }
  }
}