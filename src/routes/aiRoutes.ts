import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { AIService } from '../services/aiService';
import { PersonService } from '../services/personService';
import { MapLocation } from '../types';

const router = Router();

// Validation middleware
const validateQuery = [
  body('query').notEmpty().trim().withMessage('Query is required'),
];

// POST /ai/query - Process natural language queries
router.post('/query', validateQuery, async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { query } = req.body;
    
    if (!query || typeof query !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Query must be a non-empty string'
      });
      return;
    }

    // Parse the query using AI
    const aiQuery = await AIService.parseQuery(query);
    
    // Execute the query
    const response = await AIService.executeQuery(aiQuery);
    
    res.json({
      success: true,
      data: response,
      originalQuery: query,
      parsedQuery: aiQuery
    });
  } catch (error) {
    console.error('Error processing AI query:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process query',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /ai/suggestions - Get intelligent suggestions
router.post('/suggestions', validateQuery, async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { query } = req.body;
    
    const suggestions = await AIService.generateFamilyTreeQuery(query);
    
    res.json({
      success: true,
      data: suggestions,
      originalQuery: query
    });
  } catch (error) {
    console.error('Error generating suggestions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate suggestions',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /ai/health - Check if AI service is working
router.get('/health', async (req: Request, res: Response): Promise<void> => {
  try {
    // Test with a simple query
    const testQuery = await AIService.parseQuery('Show family tree');
    
    res.json({
      success: true,
      message: 'AI service is operational',
      testQuery,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'AI service is not operational',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;

