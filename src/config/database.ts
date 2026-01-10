import neo4j from 'neo4j-driver';
import dotenv from 'dotenv';

dotenv.config();

const { NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD } = process.env;

if (!NEO4J_URI || !NEO4J_USER || !NEO4J_PASSWORD) {
  throw new Error('Missing Neo4j environment variables');
}

const driver = neo4j.driver(
  NEO4J_URI,
  neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD),
  {
    maxConnectionLifetime: 3 * 60 * 60 * 1000, // 3 hours
    maxConnectionPoolSize: 50,
    connectionAcquisitionTimeout: 2 * 60 * 1000, // 2 minutes
  }
);

export const getSession = (): neo4j.Session => {
  return driver.session();
};

export const initializeDatabase = async (): Promise<void> => {
  const session = getSession();
  
  try {
    // Create indexes for better query performance
    await session.run(`
      CREATE INDEX person_name IF NOT EXISTS 
      FOR (p:Person) ON (p.name)
    `);
    
    await session.run(`
      CREATE INDEX event_date IF NOT EXISTS 
      FOR (e:Event) ON (e.date)
    `);
    
    await session.run(`
      CREATE INDEX event_type IF NOT EXISTS 
      FOR (e:Event) ON (e.type)
    `);
    
    console.log('✅ Database indexes created successfully');
  } catch (error) {
    console.error('❌ Error creating database indexes:', error);
    throw error;
  } finally {
    await session.close();
  }
};

export const testConnection = async (): Promise<boolean> => {
  const session = getSession();
  
  try {
    const result = await session.run('RETURN 1 as test');
    return result.records.length > 0;
  } catch (error) {
    console.error('❌ Neo4j connection test failed:', error);
    return false;
  } finally {
    await session.close();
  }
};

export const closeConnection = async (): Promise<void> => {
  await driver.close();
};

