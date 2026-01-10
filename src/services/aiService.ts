import OpenAI from 'openai';
import dotenv from 'dotenv';
import { PersonService } from './personService';
import { RelationshipService } from './relationshipService';
import { EventService } from './eventService';
import { AIQuery, AIResponse, MapLocation } from '../types';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export class AIService {
  static async parseQuery(query: string): Promise<AIQuery> {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are a family tree assistant. Parse user queries and extract information.
            Return a JSON object with:
            - task: 'get_children', 'get_parents', 'get_relationship', 'get_events', 'get_locations', or 'custom'
            - person: name of the person (if applicable)
            - personB: second person for relationship queries (if applicable)
            - parameters: any additional parameters
            
            Examples:
            "Who are John's children?" -> {"task": "get_children", "person": "John"}
            "Who are Mary's parents?" -> {"task": "get_parents", "person": "Mary"}
            "How are John and Mary related?" -> {"task": "get_relationship", "person": "John", "personB": "Mary"}
            "What events happened in 1990?" -> {"task": "get_events", "parameters": {"date": "1990"}}
            "Show me all family locations" -> {"task": "get_locations"}
            "Tell me about weddings" -> {"task": "get_events", "parameters": {"type": "wedding"}}
            `
          },
          {
            role: 'user',
            content: query
          }
        ],
        temperature: 0.1,
        max_tokens: 200,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from AI');
      }

      const parsed = JSON.parse(content) as AIQuery;
      return parsed;
    } catch (error) {
      console.error('Error parsing AI query:', error);
      return { task: 'custom', parameters: {} };
    }
  }

  static async executeQuery(aiQuery: AIQuery): Promise<AIResponse> {
    try {
      switch (aiQuery.task) {
        case 'get_children':
          const children = await RelationshipService.getChildren(aiQuery.person || '');
          return {
            answer: `${aiQuery.person} has ${children.length} children: ${children.join(', ')}.`,
            data: children,
            suggestions: children.map(child => `Tell me about ${child}`)
          };

        case 'get_parents':
          const parents = await RelationshipService.getParents(aiQuery.person || '');
          return {
            answer: `${aiQuery.person} has ${parents.length} parents: ${parents.join(', ')}.`,
            data: parents,
            suggestions: parents.map(parent => `Show ${parent}'s family tree`)
          };

        case 'get_relationship':
          if (!aiQuery.personB) {
            return { answer: 'Please specify two people to find their relationship.' };
          }
          const relationship = await RelationshipService.getRelationshipPath(aiQuery.person || '', aiQuery.personB);
          return {
            answer: relationship.description,
            data: relationship,
            suggestions: [`Show both ${aiQuery.person} and ${aiQuery.personB}'s ancestors`]
          };

        case 'get_events':
          let events;
          if (aiQuery.parameters?.type) {
            events = await EventService.getEventsByType(aiQuery.parameters.type);
          } else if (aiQuery.parameters?.date) {
            events = await EventService.getEventsByDateRange(
              aiQuery.parameters.date,
              aiQuery.parameters.endDate || aiQuery.parameters.date
            );
          } else if (aiQuery.person) {
            events = await EventService.getAllEvents(aiQuery.person);
          } else {
            events = await EventService.getAllEvents();
          }

          if (events.length === 0) {
            return { answer: 'No events found matching your criteria.' };
          }

          const eventList = events.slice(0, 5).map(event => `${event.type} - ${event.description} (${event.date})`);
          return {
            answer: `Found ${events.length} events: ${eventList.join('; ')}${events.length > 5 ? '...' : ''}`,
            data: events,
            suggestions: events.slice(0, 3).map(event => `Tell me more about ${event.type}`)
          };

        case 'get_locations':
          const allPeople = await PersonService.getAllPeople();
          const locations: MapLocation[] = allPeople
            .filter(person => person.location?.coordinates)
            .map(person => ({
              id: person.id,
              name: person.name,
              coordinates: person.location!.coordinates!,
              address: person.location!.address
            }));

          return {
            answer: `Found ${locations.length} family members with location data: ${locations.map(l => l.name).join(', ')}.`,
            data: locations,
            suggestions: ['Show map view', 'Compare locations']
          };

        default:
          return { answer: 'I can help you explore family relationships, events, and locations. What would you like to know?' };
      }
    } catch (error) {
      console.error('Error executing AI query:', error);
      return {
        answer: 'Sorry, I encountered an error while processing your request. Please try again.',
        suggestions: ['Show family tree', 'List all people', 'Find relationships']
      };
    }
  }

  static async generateFamilyTreeQuery(request: string): Promise<string[]> {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `Generate helpful family tree exploration suggestions based on user input.
            Return a JSON array of 3-5 suggested queries.
            These should be natural language questions users might ask.`
          },
          {
            role: 'user',
            content: request
          }
        ],
        temperature: 0.7,
        max_tokens: 200,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from AI');
      }

      const suggestions = JSON.parse(content) as string[];
      return suggestions;
    } catch (error) {
      console.error('Error generating suggestions:', error);
      return [
        'Show me the family tree',
        'Who are my ancestors?',
        'What events happened this year?'
      ];
    }
  }
}

