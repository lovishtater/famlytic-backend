import { MongoClient, Db } from 'mongodb';

// Enhanced user contact schema with all Google Contacts data
interface UserContact {
  google_id: string;
  name: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  birthday?: string;
  address?: string;
  company?: string;
  job_title?: string;
  photo_url?: string;
  relations?: Array<{
    value?: string;
    type?: string;
    formattedType?: string;
  }>;
  events?: Array<{
    date?: {
      year?: number;
      month?: number;
      day?: number;
    };
    type?: string;
    formattedType?: string;
  }>;
  occupations?: Array<{
    value?: string;
  }>;
  interests?: Array<{
    value?: string;
  }>;
  import_status: 'pending' | 'added_to_tree' | 'ignored';
  created_at: Date;
  updated_at: Date;
}

// User document schema - user-centric approach
interface UserDocument {
  _id?: string;
  user_id: string;
  contacts: UserContact[];
  last_sync: Date;
  sync_count: number;
  created_at: Date;
  updated_at: Date;
}

export class MongoDBService {
  private client: MongoClient;
  private db: Db;
  private users: any;

  constructor(private uri: string, private dbName: string) {}

  async connect(): Promise<void> {
    try {
      this.client = new MongoClient(this.uri);
      await this.client.connect();
      this.db = this.client.db(this.dbName);
      
      // Single collection for user documents
      this.users = this.db.collection('users');
      
      // Create indexes
      await this.createIndexes();
      
      console.log('✅ MongoDB connected successfully');
    } catch (error) {
      console.error('❌ MongoDB connection failed:', error);
      throw error;
    }
  }

  private async createIndexes(): Promise<void> {
    try {
      // User ID index (unique)
      await this.users.createIndex({ user_id: 1 }, { unique: true });
      
      // Contacts array indexes for efficient querying
      await this.users.createIndex({ 'contacts.google_id': 1 });
      await this.users.createIndex({ 'contacts.import_status': 1 });
      await this.users.createIndex({ 'contacts.email': 1 });
      await this.users.createIndex({ 'contacts.phone': 1 });
      
      console.log('✅ MongoDB indexes created');
    } catch (error) {
      console.error('❌ Error creating indexes:', error);
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      console.log('✅ MongoDB disconnected');
    }
  }

  // INTELLIGENT UPSERT STRATEGY: Merge old and new contacts
  async upsertUserContacts(userId: string, newContacts: any[]): Promise<{
    created: number;
    updated: number;
    total: number;
    unchanged: number;
  }> {
    try {
      // Get existing user document
      const existingUserDoc = await this.users.findOne({ user_id: userId });
      
      let existingContacts: UserContact[] = [];
      
      if (existingUserDoc) {
        existingContacts = existingUserDoc.contacts || [];
        console.log(`📱 Found ${existingContacts.length} existing contacts for user ${userId}`);
      } else {
        console.log(`📱 No existing contacts found for user ${userId} - this is first sync`);
      }

      // Create lookup map for existing contacts (by google_id)
      const existingContactsMap = new Map<string, UserContact>();
      existingContacts.forEach(contact => {
        existingContactsMap.set(contact.google_id, contact);
      });

      // Process upsert logic
      const mergedContacts: UserContact[] = [];
      let createdCount = 0;
      let updatedCount = 0;
      let unchangedCount = 0;

      console.log(`🔄 Processing ${newContacts.length} contacts from Google...`);
      console.log('='.repeat(50));

      console.log('New Contacts:', newContacts[302]);

      for (const newContactData of newContacts) {
        const googleId = newContactData.google_id;
        const existingContact = existingContactsMap.get(googleId);

        if (existingContact) {
          // UPSERT: Contact exists - update it completely (replace with new data)
          
          const updatedContact: UserContact = {
            google_id: newContactData.google_id,
            name: newContactData.name,
            first_name: newContactData.first_name,
            last_name: newContactData.last_name,
            email: newContactData.email,
            phone: newContactData.phone,
            birthday: newContactData.birthday,
            address: newContactData.address,
            company: newContactData.company,
            job_title: newContactData.job_title,
            photo_url: newContactData.photo_url,
            relations: newContactData.relations,
            events: newContactData.events,
            occupations: newContactData.occupations,
            interests: newContactData.interests,
            // Preserve existing import_status unless explicitly changed
            import_status: existingContact.import_status,
            // Keep original created_at, update updated_at
            created_at: existingContact.created_at,
            updated_at: new Date()
          };

          mergedContacts.push(updatedContact);
          updatedCount++;
          
          // Check if contact data actually changed
          const hasSignificantChanges = this.hasSignificantChanges(existingContact, updatedContact);
          if (!hasSignificantChanges) {
            unchangedCount++;
          }
        } else {
          // CREATE: Contact doesn't exist - create new one
          
          const newContact: UserContact = {
            google_id: newContactData.google_id,
            name: newContactData.name,
            first_name: newContactData.first_name,
            last_name: newContactData.last_name,
            email: newContactData.email,
            phone: newContactData.phone,
            birthday: newContactData.birthday,
            address: newContactData.address,
            company: newContactData.company,
            job_title: newContactData.job_title,
            photo_url: newContactData.photo_url,
            relations: newContactData.relations,
            events: newContactData.events,
            occupations: newContactData.occupations,
            interests: newContactData.interests,
            import_status: 'pending', // New contacts start as pending
            created_at: new Date(),
            updated_at: new Date()
          };

          mergedContacts.push(newContact);
          createdCount++;
        }
      }

      // IGNORE: Existing contacts not in new list - keep them as-is (preserve their state)
      const newContactsMap = new Map<string, any>();
      newContacts.forEach(contact => {
        newContactsMap.set(contact.google_id, contact);
      });

      const preservedContacts = existingContacts.filter(existingContact => {
        // Keep contacts that are not in the new Google response
        // This handles deleted contacts from Google - we preserve them locally
        return !newContactsMap.has(existingContact.google_id);
      });

      const finalContacts = [...mergedContacts, ...preservedContacts];

      console.log(`📊 Upsert Summary:`);
      console.log(`   - New contacts created: ${createdCount}`);
      console.log(`   - Existing contacts updated: ${updatedCount}`);
      console.log(`   - Unchanged contacts: ${unchangedCount}`);
      console.log(`   - Preserved contacts: ${preservedContacts.length}`);
      console.log(`   - Total final contacts: ${finalContacts.length}`);

      // Upsert user document
      const updateResult = await this.users.updateOne(
        { user_id: userId },
        { 
          $set: { 
            contacts: finalContacts,
            last_sync: new Date(),
            updated_at: new Date()
          },
          $inc: { sync_count: 1 }
        },
        { upsert: true } // Create document if it doesn't exist
      );

      console.log(`✅ Upsert completed for user ${userId}`);
      console.log(`   - Document created: ${updateResult.upsertedCount === 1}`);
      console.log(`   - Document updated: ${updateResult.modifiedCount === 1}`);

      return {
        created: createdCount,
        updated: updatedCount,
        total: finalContacts.length,
        unchanged: unchangedCount
      };
      
    } catch (error) { 
      console.error('❌ Error during upsert:', error);
      throw error;
    }
  }

  private hasSignificantChanges(oldContact: UserContact, newContact: UserContact): boolean {
    // Check if significant contact data has changed
    const significantFields = [
      'name', 'first_name', 'last_name', 'email', 'phone', 
      'birthday', 'address', 'company', 'job_title', 'photo_url'
    ];

    return significantFields.some(field => {
      return oldContact[field] !== newContact[field];
    });
  }

  // Simple bulk replace for initial implementation (legacy)
  async replaceUserContacts(userId: string, contacts: any[]): Promise<void> {
    console.log('⚠️ Using legacy bulk replace - consider upgrading to upsert strategy');
    return this.upsertUserContacts(userId, contacts);
  }

  private async getOrCreateUserDocument(userId: string): Promise<string> {
    const existingUser = await this.users.findOne({ user_id: userId });
    
    if (!existingUser) {
      // Create new user document
      const newUser: UserDocument = { 
        user_id: userId,
        contacts: [],
        last_sync: new Date(),
        sync_count: 0,
        created_at: new Date(),
        updated_at: new Date()
      };
      
      const result = await this.users.insertOne(newUser);
      console.log(`✅ Created new user document for ${userId}`);
      return result.insertedId.toString();
    }
    
    return existingUser._id.toString();
  }

  // Get user's contacts
  async getUserContacts(userId: string, status?: string): Promise<UserContact[]> {
    const query: any = { user_id: userId };
    const projection: any = { contacts: 1 };
    
    const userDoc = await this.users.findOne(query, projection);
    
    if (!userDoc) return [];
    
    if (status) {
      return userDoc.contacts.filter((contact: UserContact) => contact.import_status === status);
    }
    
    return userDoc.contacts || [];
  }

  // Get pending contacts
  async getPendingContacts(userId: string): Promise<UserContact[]> {
    const contacts = await this.getUserContacts(userId);
    return contacts.filter(contact => contact.import_status === 'pending');
  }

  // Mark contacts for family tree (bulk update within document)
  async markContactsForFamilyTree(userId: string, contactIds: string[]): Promise<void> {
    const updateResult = await this.users.updateOne(
      { user_id: userId },
      { 
        $set: { 
          'contacts.$[elem].import_status': 'added_to_tree',
          'contacts.$[elem].updated_at': new Date(),
          updated_at: new Date()
        }
      },
      { 
        arrayFilters: [{ 'elem.google_id': { $in: contactIds } }]
      }
    );

    console.log(`✅ Marked ${contactIds.length} contacts for family tree`);
    console.log(`   - Modified document: ${updateResult.modifiedCount === 1}`);
  }

  // Get user contact statistics with sync info
  async getUserContactStats(userId: string): Promise<{
    total: number;
    pending: number;
    added_to_tree: number;
    ignored: number;
    last_sync?: Date;
    sync_count?: number;
    new_since_sync?: number;
  }> {
    const userDoc = await this.users.findOne(
      { user_id: userId },
      { 
        projection: { 
          contacts: 1, 
          last_sync: 1, 
          sync_count: 1 
        } 
      }
    );

    if (!userDoc || !userDoc.contacts) {
      return {
        total: 0,
        pending: 0,
        added_to_tree: 0,
        ignored: 0,
        sync_count: 0
      };
    }

    const contacts = userDoc.contacts;
    const stats = {
      total: contacts.length,
      pending: contacts.filter(c => c.import_status === 'pending').length,
      added_to_tree: contacts.filter(c => c.import_status === 'added_to_tree').length,
      ignored: contacts.filter(c => c.import_status === 'ignored').length,
      last_sync: userDoc.last_sync,
      sync_count: userDoc.sync_count,
      // Count contacts created/updated since last sync
      new_since_sync: contacts.filter(c => 
        c.created_at >= userDoc.last_sync || 
        c.updated_at >= userDoc.last_sync
      ).length
    };

    return stats;
  }

  // Check if user has synced contacts before
  async hasSyncedBefore(userId: string): Promise<boolean> {
    const userDoc = await this.users.findOne(
      { user_id: userId },
      { projection: { sync_count: 1 } }
    );
    
    return userDoc && userDoc.sync_count > 0;
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.db.command({ ping: 1 });
      return true;
    } catch (error) {
      return false;
    }
  }

  // Migration helper: Convert from old schema to new schema
  async migrateOldContactsSchema(oldCollectionName: string = 'user_contacts'): Promise<void> {
    console.log(`🔄 Starting migration from ${oldCollectionName} to new user-centric schema...`);
    
    try {
      const oldCollection = this.db.collection(oldCollectionName);
      const oldDocs = await oldCollection.find({}).toArray();
      
      for (const userContacts of oldDocs) {
        const userId = userContacts.user_id;
        const contacts = userContacts.contacts || [userContacts]; // Handle both array and single doc
        
        await this.upsertUserContacts(userId, contacts);
      }
      
      console.log(`✅ Migration completed: ${oldDocs.length} user documents migrated`);
      
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }
}