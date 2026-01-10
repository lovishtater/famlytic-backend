import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Route imports
import personRoutes from './routes/personRoutes';
import relationRoutes from './routes/relationRoutes';
import eventRoutes from './routes/eventRoutes';
import aiRoutes from './routes/aiRoutes';
import mapRoutes from './routes/mapRoutes';
import googleContactsRoutes from './routes/googleContactsRoutes';

// Database imports
import { testConnection, initializeDatabase } from './config/database';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security and performance middleware
app.use(helmet());
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Log API requests
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.log(`🔍 ${req.method} - ${new Date().getTime()} - ${req.originalUrl}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.use('/api/person', personRoutes);
app.use('/api/relation', relationRoutes);
app.use('/api/event', eventRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/map', mapRoutes);
app.use('/api/google-contacts', googleContactsRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found',
    availableEndpoints: [
      'GET /health',
      'POST /api/person',
      'GET /api/person',
      'PUT /api/person/:id',
      'DELETE /api/person/:id',
      'POST /api/relation',
      'GET /api/relation/children/:name',
      'GET /api/relation/parents/:name',
      'GET /api/relation/spouses/:name',
      'GET /api/relation/relation/:personA/:personB',
      'GET /api/relation/all',
      'POST /api/event',
      'GET /api/event',
      'GET /api/event/person/:name',
      'GET /api/event/type/:type',
      'PUT /api/event/:id',
      'DELETE /api/event/:id',
      'POST /api/ai/query',
      'POST /api/ai/suggestions',
      'GET /api/ai/health',
      'GET /api/map',
      'GET /api/map/person/:name',
      'GET /api/map/nearby'
    ]
  });
});



// Global error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Global error handler:', err);
  
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('👋 SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (reason) => {
  console.error('Uncaught Exception:', reason);
  process.exit(1);
});

// Initialize database and start server
async function startServer(): Promise<void> {
  try {
    console.log('🔄 Testing Neo4j connection...');
    const isConnected = await testConnection();
    
    if (!isConnected) {
      console.error('❌ Failed to connect to Neo4j. Please check your database configuration.');
      process.exit(1);
    }
    
    console.log('✅ Neo4j connection successful');
    
    console.log('🔄 Initializing database...');
    await initializeDatabase();
    console.log('✅ Database initialization complete');
    
    app.listen(PORT, () => {
      console.log(`🚀 Famlytic Backend Server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log(`📚 API endpoints available at: http://localhost:${PORT}/api/`);
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

