import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { RelationshipService } from '../services/relationshipService';
import { CreateRelationshipRequest } from '../types';

const router = Router();

// Validation middleware
const validateRelationship = [
  body('personA').notEmpty().trim().withMessage('Person A ID is required'),
  body('personB').notEmpty().trim().withMessage('Person B ID is required'),
  body('type').isIn(['PARENT_OF', 'CHILD_OF', 'SPOUSE_OF', 'SIBLING_OF', 'CUSTOM']).withMessage('Invalid relationship type'),
];

// POST /relation - Add a relationship between existing people
router.post('/', validateRelationship, async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
      return;
    }

    const relationshipData: CreateRelationshipRequest = req.body;
    const relationship = await RelationshipService.createRelationship(relationshipData);
    
    res.status(201).json({
      success: true,
      data: relationship,
      message: 'Relationship created successfully'
    });
  } catch (error) {
    console.error('Error creating relationship:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create relationship',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /children/:id - Return children of a person
router.get('/children/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const children = await RelationshipService.getChildren(id);
    
    res.json({
      success: true,
      data: children,
      personId: id,
      count: children.length
    });
  } catch (error) {
    console.error('Error fetching children:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch children',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /parents/:id - Return parents of a person
router.get('/parents/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const parents = await RelationshipService.getParents(id);
    
    res.json({
      success: true,
      data: parents,
      personId: id,
      count: parents.length
    });
  } catch (error) {
    console.error('Error fetching parents:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch parents',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /spouses/:id - Return spouses of a person
router.get('/spouses/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const spouses = await RelationshipService.getSpouses(id);
    
    res.json({
      success: true,
      data: spouses,
      personId: id,
      count: spouses.length
    });
  } catch (error) {
    console.error('Error fetching spouses:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch spouses',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /relation/:personAId/:personBId - Return path and relationship description
router.get('/relation/:personAId/:personBId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { personAId, personBId } = req.params;
    
    const relationship = await RelationshipService.getRelationshipPath(personAId, personBId);
    
    res.json({
      success: true,
      data: relationship,
      personAId,
      personBId
    });
  } catch (error) {
    console.error('Error fetching relationship path:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch relationship path',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /all - Get all relationships (optionally filtered by person)
router.get('/all', async (req: Request, res: Response): Promise<void> => {
  try {
    const { person } = req.query;
    
    const relationships = await RelationshipService.getAllRelationships(
      person ? String(person) : undefined
    );
    
    res.json({
      success: true,
      data: relationships,
      count: relationships.length,
      filter: person || 'all'
    });
  } catch (error) {
    console.error('Error fetching all relationships:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch relationships',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;