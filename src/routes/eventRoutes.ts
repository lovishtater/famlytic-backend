import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { EventService } from '../services/eventService';
import { CreateEventRequest } from '../types';

const router = Router();

// Validation middleware
const validateEvent = [
  body('type').notEmpty().trim().withMessage('Event type is required'),
  body('date').notEmpty().trim().withMessage('Event date is required'),
  body('description').notEmpty().trim().withMessage('Event description is required'),
  body('people').isArray().withMessage('People must be an array'),
  body('people.*').notEmpty().trim().withMessage('Person name cannot be empty'),
];

// POST /event - Add events (birth, marriage, custom events)
router.post('/', validateEvent, async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const eventData: CreateEventRequest = req.body;
    const event = await EventService.createEvent(eventData);
    
    res.status(201).json({
      success: true,
      data: event,
      message: 'Event created successfully'
    });
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create event',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /events - Get all events or filter by person/date
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { person, type, startDate, endDate } = req.query;
    
    let events;
    
    if (person) {
      events = await EventService.getAllEvents(String(person));
    } else if (type) {
      events = await EventService.getEventsByType(String(type));
    } else if (startDate && endDate) {
      events = await EventService.getEventsByDateRange(String(startDate), String(endDate));
    } else {
      events = await EventService.getAllEvents();
    }
    
    res.json({
      success: true,
      data: events,
      count: events.length,
      filters: { person, type, startDate, endDate }
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch events',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /events/person/:name - Get events for a specific person
router.get('/person/:name', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.params;
    
    const events = await EventService.getAllEvents(name);
    
    res.json({
      success: true,
      data: events,
      person: name,
      count: events.length
    });
  } catch (error) {
    console.error('Error fetching person events:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch person events',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /events/type/:type - Get events by type
router.get('/type/:type', async (req: Request, res: Response): Promise<void> => {
  try {
    const { type } = req.params;
    
    const events = await EventService.getEventsByType(type);
    
    res.json({
      success: true,
      data: events,
      type,
      count: events.length
    });
  } catch (error) {
    console.error('Error fetching events by type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch events by type',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// PUT /event/:id - Update an event
router.put('/:id', validateEvent, async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { id } = req.params;
    const updates = req.body;
    
    const event = await EventService.updateEvent(id, updates);
    
    if (!event) {
      res.status(404).json({
        success: false,
        message: 'Event not found'
      });
      return;
    }
    
    res.json({
      success: true,
      data: event,
      message: 'Event updated successfully'
    });
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update event',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// DELETE /event/:id - Delete an event
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    await EventService.deleteEvent(id);
    
    res.json({
      success: true,
      message: 'Event deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete event',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
