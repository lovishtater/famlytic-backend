import { getSession } from '../config/database';
import { Event, CreateEventRequest } from '../types';

export class EventService {
  static async createEvent(eventData: CreateEventRequest): Promise<Event> {
    const session = getSession();
    
    try {
      // Start a transaction to create event and link to people
      const result = await session.run(`
        MATCH (p:Person)
        WHERE p.name IN $people
        WITH collect(p) as people
        
        CREATE (e:Event {
          id: randomUUID(),
          type: $type,
          date: $date,
          description: $description,
          createdAt: datetime(),
          updatedAt: datetime()
        })
        
        WITH e, people
        UNWIND people as person
        CREATE (person)-[:HAS_EVENT]->(e)
        
        RETURN e
      `, {
        type: eventData.type,
        date: eventData.date,
        description: eventData.description,
        people: eventData.people,
      });
      
      if (result.records.length === 0) {
        throw new Error('Failed to create event');
      }
      
      const event = result.records[0].get('e').properties;
      return {
        ...event,
        people: eventData.people,
      } as Event;
    } finally {
      await session.close();
    }
  }
  
  static async getAllEvents(personName?: string): Promise<Event[]> {
    const session = getSession();
    
    try {
      let query: string;
      const params: Record<string, any> = {};
      
      if (personName) {
        query = `
          MATCH (e:Event)<-[:HAS_EVENT]-(p:Person {name: $personName})
          RETURN e,
            [(e)<-[:HAS_EVENT]-(person:Person) | person.name] as people
          ORDER BY e.date DESC
        `;
        params.personName = personName;
      } else {
        query = `
          MATCH (e:Event)
          RETURN e,
            [(e)<-[:HAS_EVENT]-(person:Person) | person.name] as people
          ORDER BY e.date DESC
        `;
      }
        
      const result = await session.run(query, params);
      
      return result.records.map(record => {
        const event = record.get('e').properties;
        
        return {
          id: event.id,
          type: event.type,
          date: event.date,
          description: event.description,
          people: record.get('people') || [],
          createdAt: event.createdAt,
          updatedAt: event.updatedAt,
        } as Event;
      });
    } finally {
      await session.close();
    }
  }
  
  static async getEventsByType(type: string): Promise<Event[]> {
    const session = getSession();
    
    try {
      const query = `
        MATCH (e:Event {type:'$type})
        RETURN e,
          [(e)<-[:HAS_EVENT]-(person:Person) | person.name] as people
        ORDER BY e.date DESC
      `;
        
      const result = await session.run(query, { type });
      
      return result.records.map(record => {
        const event = record.get('e').properties;
        return {
          ...event,
          people: record.get('people'),
        } as Event;
      });
    } finally {
      await session.close();
    }
  }
  
  static async getEventsByDateRange(startDate: string, endDate: string): Promise<Event[]> {
    const session = getSession();
    
    try {
      const query = `
        MATCH (e:Event)
        WHERE e.date >= $startDate AND e.date <= $endDate
        RETURN e,
          [(e)<-[:HAS_EVENT]-(person:Person) | person.name] as people
        ORDER BY e.date DESC
      `;
        
      const result = await session.run(query, { startDate, endDate });
      
      return result.records.map(record => {
        const event = record.get('e').properties;
        return {
          ...event,
          people: record.get('people'),
        } as Event;
      });
    } finally {
      await session.close();
    }
  }
  
  static async updateEvent(id: string, updates: Partial<CreateEventRequest>): Promise<Event | null> {
    const session = getSession();
    
    try {
      const setClauses = [];
      const params: Record<string, any> = { id };
      
      if (updates.type !== undefined) {
        setClauses.push('e.type = $type');
        params.type = updates.type;
      }
      if (updates.date !== undefined) {
        setClauses.push('e.date = $date');
        params.date = updates.date;
      }
      if (updates.description !== undefined) {
        setClauses.push('e.description = $description');
        params.description = updates.description;
      }
      
      setClauses.push('e.updatedAt = datetime()');
      
      if (setClauses.length === 1) { // Only updatedAt
        return null;
      }
      
      const query = `
        MATCH (e:Event {id: $id})
        SET ${setClauses.join(', ')}
        RETURN e,
          [(e)<-[:HAS_EVENT]-(person:Person) | person.name] as people
      `;
      
      const result = await session.run(query, params);
      
      if (result.records.length === 0) {
        return null;
      }
      
      const event = result.records[0].get('e').properties;
      return {
        ...event,
        people: result.records[0].get('people'),
      } as Event;
    } finally {
      await session.close();
    }
  }
  
  static async deleteEvent(id: string): Promise<boolean> {
    const session = getSession();
    
    try {
      const query = `
        MATCH (e:Event {id: $id})
        DETACH DELETE e
      `;
      
      await session.run(query, { id });
      return true;
    } finally {
      await session.close();
    }
  }
}
