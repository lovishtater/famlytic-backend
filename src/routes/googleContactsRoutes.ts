import express, { Request, Response } from 'express';
import { MongoDBService } from '../services/mongodbService';
import { GoogleContactsService } from '../services/googleContactsService';

const router = express.Router();

// Initialize MongoDB service
let mongoService: MongoDBService | null = null;
let googleContactsService: GoogleContactsService | null = null;

// Lazy initialization function
async function getServices() {
  if (!mongoService) {
    mongoService = new MongoDBService();
    await mongoService.connect();
  }
  if (!googleContactsService) {
    googleContactsService = new GoogleContactsService(mongoService);
  }
  return { mongoService, googleContactsService };
}

// POST /api/google-contacts/sync - Sync contacts (intelligent upsert)
router.post('/sync', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, accessToken } = req.body;

    if (!userId || !accessToken) {
      res.status(400).json({
        success: false,
        error: 'Missing userId or accessToken in request'
      });
      return;
    }

    // Get services
    const { googleContactsService } = await getServices();

    // Initialize Google Contacts service with the access token
    await googleContactsService.initializeForUser(accessToken);

    // Perform intelligent upsert sync
    const result = await googleContactsService.importContacts(userId);

    res.json({
      success: true,
      message: 'Contacts synced successfully',
      data: result
    });

  } catch (error: unknown) {
    console.error('❌ Sync contacts error:', error);
    
    // Enhanced error handling
    let errorMessage = 'Failed to sync contacts';
    let debugInfo: any = {};

    if ((error as any).code === 401) {
      errorMessage = 'Google authentication failed. Your session has expired. Please refresh the page to re-authenticate.';
      debugInfo = {
        errorCode: (error as any).code,
        authIssue: 'Invalid or expired access token',
        solution: 'User needs to refresh session'
      };
    } else if (error instanceof Error) {
      errorMessage = error.message;
      debugInfo = { originalError: error.message };
    }

    res.status(500).json({
      success: false,
      error: errorMessage,
      debug: debugInfo
    });
  }
});

// GET /api/google-contacts/sync-status/:userId - Check if user has synced before
router.get('/sync-status/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    if (!userId) {
      res.status(400).json({
        success: false,
        error: 'Missing userId parameter'
      });
      return;
    }

    const { googleContactsService } = await getServices();
    const hasSyncedBefore = await googleContactsService.hasSyncedBefore(userId);
    const stats = await googleContactsService.getUserStats(userId);

    res.json({
      success: true,
      data: {
        has_synced_before: hasSyncedBefore,
        sync_count: stats.sync_count || 0,
        last_sync: stats.last_sync,
        total_contacts: stats.total,
        pending_contacts: stats.pending,
        added_to_tree: stats.added_to_tree
      }
    });

  } catch (error: unknown) {
    console.error('❌ Get sync status error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get sync status'
    });
  }
});

// POST /api/google-contacts/import - Import contacts (legacy endpoint)
router.post('/import', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, accessToken } = req.body;

    if (!userId || !accessToken) {
      res.status(400).json({
        success: false,
        error: 'Missing userId or accessToken in request'
      });
      return;
    }

    // Get services
    const { googleContactsService } = await getServices();

    // Initialize Google Contacts service with the access token
    await googleContactsService.initializeForUser(accessToken);

    // Import contacts using the new intelligent upsert strategy
    const result = await googleContactsService.importContacts(userId);

    res.json({
      success: true,
      message: 'Contacts imported successfully',
      data: result
    });

  } catch (error: unknown) {
    console.error('❌ Import contacts error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to import contacts'
    });
  }
});

// GET /api/google-contacts/user/:userId - Get user's contacts
router.get('/user/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    if (!userId) {
      res.status(400).json({
        success: false,
        error: 'Missing userId parameter'
      });
      return;
    }

    const { googleContactsService } = await getServices();
    const contacts = await googleContactsService.getUserContacts(userId);

    res.json({
      success: true,
      data: contacts
    });

  } catch (error: unknown) {
    console.error('❌ Get user contacts error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get user contacts'
    });
  }
});

// GET /api/google-contacts/pending/:userId - Get pending contacts for family tree
router.get('/pending/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    if (!userId) {
      res.status(400).json({
        success: false,
        error: 'Missing userId parameter'
      });
      return;  
    }

    const { googleContactsService } = await getServices();
    const pendingContacts = await googleContactsService.getPendingContacts(userId);

    res.json({
      success: true,
      data: pendingContacts
    });

  } catch (error: unknown) {
    console.error('❌ Get pending contacts error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get pending contacts'
    });
  }
});

// POST /api/google-contacts/select-for-family-tree - Mark contacts for family tree
router.post('/select-for-family-tree', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, selectedContactIds } = req.body;

    if (!userId || !selectedContactIds || !Array.isArray(selectedContactIds)) {
      res.status(400).json({
        success: false,
        error: 'Missing userId or selectedContactIds in request'
      });
      return;
    }

    const { googleContactsService } = await getServices();
    await googleContactsService.markContactsForFamilyTree(userId, selectedContactIds);

    res.json({
      success: true,
      message: 'Contacts marked for family tree successfully',
      data: {
        selected_count: selectedContactIds.length
      }
    });

  } catch (error: unknown) {
    console.error('❌ Select contacts for family tree error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to select contacts for family tree'
    });
  }
});

// GET /api/google-contacts/stats/:userId - Get user's contact statistics
router.get('/stats/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    if (!userId) {
      res.status(400).json({
        success: false,
        error: 'Missing userId parameter'
      });
      return;
    }

    const { googleContactsService: service } = await getServices();
    const stats = await service.getUserStats(userId);

    res.json({
      success: true,
      data: stats
    });

  } catch (error: unknown) {
    console.error('❌ Get user stats error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get user stats'
    });
  }
});

export default router;