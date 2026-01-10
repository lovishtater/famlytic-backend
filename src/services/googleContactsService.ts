import { google, people_v1 } from 'googleapis';
import { MongoDBService } from './mongodbService';

export class GoogleContactsService {
  private contacts: people_v1.People | null = null;
  private mongoService: MongoDBService;

  constructor(mongoService: MongoDBService) {
    this.mongoService = mongoService;
  }

  async initializeForUser(accessToken: string): Promise<void> {
    // Validate token format first
    if (!accessToken || typeof accessToken !== 'string') {
      throw new Error('Invalid access token provided');
    }

    // Validate token format
    if (!accessToken.startsWith('ya29.') && !accessToken.startsWith('1//')) {
      throw new Error(`Invalid access token format. Expected 'ya29.' or '1//' but got: ${accessToken.substring(0, 10)}...`);
    }

    try {
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });
      
      // Test the token before proceeding
      try {
        const testAuth = google.people({ version: 'v1', auth });
        await testAuth.people.get({
          resourceName: 'people/me',
          personFields: 'names'
        });
        
      } catch (tokenError: unknown) {
        const error = tokenError as any;
        if (error.code === 401) {
          throw new Error(`Access token expired. Please refresh your session.`);
        }
        throw new Error(`Invalid access token: ${error.message}`);
      }
      
      this.contacts = google.people({ version: 'v1', auth });
      
    } catch (error: unknown) {
      throw new Error(`Failed to initialize Google Contacts service: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async importContacts(userId: string): Promise<{
    imported: number;
    upsert_summary: {
      created: number;
      updated: number;
      total: number;
      unchanged: number;
    };
    contacts: Array<{
      id: string;
      name: string;
      firstName?: string | null | undefined;
      lastName?: string | null | undefined;
      email?: string | null | undefined;
      phone?: string | null | undefined;
      birthday?: string | null | undefined;
      address?: string | null | undefined;
      company?: string | null | undefined;
      jobTitle?: string | null | undefined;
      has_conflicts?: boolean | undefined;
      conflicting_contacts?: Array<{ name: string; phone: string }> | undefined;
      is_new_contact?: boolean | undefined;
      is_updated_contact?: boolean | undefined;
    }>;
    has_synced_before: boolean;
  }> {
    try {
      // Check if user has synced before
      const hasSyncedBefore = await this.mongoService.hasSyncedBefore(userId);

      // Validate service is initialized
      if (!this.contacts) {
        throw new Error('Google Contacts service not initialized. Please provide a valid access token.');
      }

      // Fetch contacts from Google
      const googleContacts = await this.fetchContacts();

      // Process and extract contact data
      const processedContacts = googleContacts.map(contact => this.processGoogleContact(contact));

      // Use intelligent upsert strategy
      const upsertResult = await this.mongoService.upsertUserContacts(userId, processedContacts);
      
      // Check for conflicts within this user's contacts
      const contactsWithConflicts = processedContacts.map(contact => {
        if (contact.phone && contact.phone.length > 0) {
          const conflictingContacts = processedContacts.filter(c => 
            c.google_id !== contact.google_id && 
            c.phone === contact.phone
          );
          
          return {
            id: contact.google_id,
            name: contact.name,
            firstName: contact.first_name,
            lastName: contact.last_name,
            email: contact.email,
            phone: contact.phone,
            birthday: contact.birthday,
            address: contact.address,
            company: contact.company,
            jobTitle: contact.job_title,
            has_conflicts: conflictingContacts.length > 0,
            conflicting_contacts: conflictingContacts.map(c => ({
              name: c.name,
              phone: c.phone || 'N/A'
            })),
            is_new_contact: upsertResult.created > 0,
            is_updated_contact: upsertResult.updated > 0
          };
        }
        
        return {
          id: contact.google_id,
          name: contact.name,
          firstName: contact.first_name,
          lastName: contact.last_name,
          email: contact.email,
          phone: contact.phone,
          birthday: contact.birthday,
          address: contact.address,
          company: contact.company,
          jobTitle: contact.job_title,
          has_conflicts: false,
          is_new_contact: upsertResult.created > 0,
          is_updated_contact: upsertResult.updated > 0
        };
      });

      return {
        imported: googleContacts.length,
        upsert_summary: upsertResult,
        contacts: contactsWithConflicts,
        has_synced_before: hasSyncedBefore
      };

    } catch (error: unknown) {
      const err = error as any;
      
      if (err.code === 401) {
        throw new Error(`Google authentication failed. Your session has expired. Please refresh the page to re-authenticate.`);
      } else if (err.code === 403) {
        throw new Error(`Access denied. Please make sure you have granted contacts permission during sign-in.`);
      } else if (err.message?.includes('access token')) {
        throw new Error(`Authentication issue. Please refresh the page to re-authenticate.`);
      } else {
        throw new Error(`Failed to import contacts: ${err.message || 'Unknown error occurred'}`);
      }
    }
  }

  private processGoogleContact(googleContact: people_v1.Schema$Person): {
    google_id: string;
    name: string;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    phone?: string | null;
    birthday?: string | null;
    address?: string | null;
    company?: string | null;
    job_title?: string | null;
    photo_url?: string | null;
    relations: people_v1.Schema$Relation[];
    events: people_v1.Schema$Event[];
    occupations: people_v1.Schema$Occupation[];
    interests: people_v1.Schema$Interest[];
    created_at: Date;
    updated_at: Date;
  } {
    const name = googleContact.names?.[0];
    const primaryEmail = googleContact.emailAddresses?.[0];
    const primaryPhone = googleContact.phoneNumbers?.[0];
    const primaryAddress = googleContact.addresses?.[0];
    const primaryOrg = googleContact.organizations?.[0];
    const primaryPhoto = googleContact.photos?.[0];
    const primaryBirthday = googleContact.birthdays?.[0];
    
    // Extract birthday
    let birthday: string | null = null;
    if (primaryBirthday?.date) {
      const { year, month, day } = primaryBirthday.date;
      if (year && month && day) {
        birthday = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      }
    }

    // Extract address
    let address: string | null = null;
    if (primaryAddress) {
      address = primaryAddress.formattedValue || 
        [
          primaryAddress.streetAddress,
          primaryAddress.city,
          primaryAddress.region,
          primaryAddress.postalCode,
          primaryAddress.country
        ].filter(Boolean).join(', ');
    }

    return {
      google_id: googleContact.resourceName || '',
      name: name?.displayName || 
            `${name?.givenName || ''} ${name?.familyName || ''}`.trim() || 
            'Unknown Contact',
      first_name: name?.givenName || null,
      last_name: name?.familyName || null,
      email: primaryEmail?.value || null,
      phone: primaryPhone?.value || null,
      birthday: birthday,
      address: address,
      company: primaryOrg?.name || null,
      job_title: primaryOrg?.title || null,
      photo_url: primaryPhoto?.url || null,
      relations: googleContact.relations || [],
      events: googleContact.events || [],
      occupations: googleContact.occupations || [],
      interests: googleContact.interests || [],
      created_at: new Date(),
      updated_at: new Date()
    };
  }

  private async fetchContacts(): Promise<people_v1.Schema$Person[]> {
    try {
      if (!this.contacts) {
        throw new Error('Google Contacts service not initialized');
      }

      const response = await this.contacts.people.connections.list({
        resourceName: 'people/me',
        pageSize: 2000,
        personFields: [
          'names',
          'emailAddresses',
          'phoneNumbers', 
          'addresses',
          'organizations',
          'photos',
          'birthdays',
          'events',
          'relations',
          'occupations',
          'interests',
          'biographies',
        ].join(','),
        sortOrder: 'FIRST_NAME_ASCENDING',
      });

      return response.data.connections || [];
      
    } catch (error: unknown) {
      const err = error as any;
      
      if (err.code === 401) {
        throw new Error(`Token expired. Please refresh your session.`);
      } else if (err.code === 403) {
        throw new Error(`Permission denied. Please grant contacts permission.`);
      } else if (err.code === 429) {
        throw new Error(`Rate limit exceeded. Please try again in a few minutes.`);
      } else {
        throw new Error(`Google API error: ${err.message || 'Unknown error occurred'}`);
      }
    }
  }

  // Get user's contacts from our database
  getUserContacts(userId: string): Promise<any[]> {
    return this.mongoService.getUserContacts(userId);
  }

  // Get pending contacts ready for family tree selection
  async getPendingContacts(userId: string): Promise<Array<{
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    birthday?: string | null;
    company?: string | null;
    can_add_to_family_tree: boolean;
  }>> {
    const pendingContacts = await this.mongoService.getPendingContacts(userId);
    
    return pendingContacts.map(contact => ({
      id: contact.google_id,
      name: contact.name,
      email: contact.email || null,
      phone: contact.phone || null,
      birthday: contact.birthday || null,
      company: contact.company || null,
      can_add_to_family_tree: true
    }));
  }

  // Mark contacts as added to family tree
  async markContactsForFamilyTree(userId: string, selectedContactIds: string[]): Promise<void> {
    await this.mongoService.markContactsForFamilyTree(userId, selectedContactIds);
  }

  // Get comprehensive user stats including sync info
  async getUserStats(userId: string): Promise<{
    total: number;
    pending: number;
    added_to_tree: number;
    ignored: number;
    last_sync?: Date;
    sync_count?: number;
    new_since_sync?: number;
  }> {
    return await this.mongoService.getUserContactStats(userId);
  }

  // Check if user has synced before
  async hasSyncedBefore(userId: string): Promise<boolean> {
    return await this.mongoService.hasSyncedBefore(userId);
  }
}