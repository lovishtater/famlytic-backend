import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { PersonService } from '../services/personService';
import { CreatePersonRequest } from '../types';

const router = Router();

// Validation middleware
const validatePerson = [
  body('name').notEmpty().trim().withMessage('Name is required'),
  body('firstName').optional().trim(),
  body('lastName').optional().trim(),
  body('nickname').optional().trim(),
  body('birthdate').optional().isISO8601().withMessage('Birthdate must be valid ISO8601 format'),
  body('deathdate').optional().isISO8601().withMessage('Deathdate must be valid ISO8601 format'),
  body('gender').optional().isIn(['male', 'female', 'other']).withMessage('Gender must be male, female, or other'),
  body('photo').optional().trim(),
  body('occupation').optional().trim(),
  body('description').optional().trim(),
  body('birthPlace').optional().trim(),
  body('deathPlace').optional().trim(),
  body('isAlive').optional().isBoolean().withMessage('isAlive must be a boolean'),
];

// POST /person - Add a new person
router.post('/', validatePerson, async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
      return;
    }

    const personData: CreatePersonRequest = req.body;
    const person = await PersonService.createPerson(personData);
    
    res.status(201).json({
      success: true,
      data: person,
      message: 'Person created successfully'
    });
  } catch (error) {
    console.error('Error creating person:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create person',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /person - Get all people or specific person
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, id } = req.query;
    
    if (id && typeof id === 'string') {
      const person = await PersonService.getPersonById(id);
      if (!person) {
        res.status(404).json({
          success: false,
          message: 'Person not found'
        });
        return;
      }
      
      res.json({
        success: true,
        data: person
      });
    } else if (name && typeof name === 'string') {
      const person = await PersonService.getPersonByName(name);
      if (!person) {
        res.status(404).json({
          success: false,
          message: 'Person not found'
        });
        return;
      }
      
      res.json({
        success: true,
        data: person
      });
    } else {
      const people = await PersonService.getAllPeople();
      res.json({
        success: true,
        data: people,
        count: people.length
      });
    }
  } catch (error) {
    console.error('Error fetching people:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch people',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /person/:id - Get specific person by ID
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const person = await PersonService.getPersonById(id);
    if (!person) {
      res.status(404).json({
        success: false,
        message: 'Person not found'
      });
      return;
    }
    
    res.json({
      success: true,
      data: person
    });
  } catch (error) {
    console.error('Error fetching person:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch person',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /person/:id/family-tree - Get family tree for a person
router.get('/:id/family-tree', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { depth } = req.query;
    
    const familyTree = await PersonService.getFamilyTree(id, depth ? parseInt(depth as string) : 3);
    if (!familyTree) {
      res.status(404).json({
        success: false,
        message: 'Person not found'
      });
      return;
    }
    
    res.json({
      success: true,
      data: familyTree
    });
  } catch (error) {
    console.error('Error fetching family tree:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch family tree',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// PUT /person/:id - Update a person
router.put('/:id', validatePerson, async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
      return;
    }

    const { id } = req.params;
    const updates = req.body;
    
    const person = await PersonService.updatePerson(id, updates);
    
    if (!person) {
      res.status(404).json({
        success: false,
        message: 'Person not found'
      });
      return;
    }
    
    res.json({
      success: true,
      data: person,
      message: 'Person updated successfully'
    });
  } catch (error) {
    console.error('Error updating person:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update person',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// DELETE /person/:id - Delete a person
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    await PersonService.deletePerson(id);
    
    res.json({
      success: true,
      message: 'Person deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting person:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete person',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;