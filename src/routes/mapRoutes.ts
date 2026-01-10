import { Router, Request, Response } from 'express';
import { PersonService } from '../services/personService';
import { MapLocation } from '../types';

const router = Router();

// GET /map - Get locations of all people
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const allPeople = await PersonService.getAllPeople();
    
    const locations: MapLocation[] = allPeople
      .filter(person => person.location?.coordinates)
      .map(person => ({
        id: person.id,
        name: person.name,
        coordinates: person.location!.coordinates!,
        address: person.location!.address
      }));
    
    res.json({
      success: true,
      data: locations,
      count: locations.length,
      totalPeople: allPeople.length,
      hasLocationData: locations.length
    });
  } catch (error) {
    console.error('Error fetching map locations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch map locations',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /map/person/:name - Get location of a specific person
router.get('/person/:name', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.params;
    
    const person = await PersonService.getPersonByName(name);
    
    if (!person) {
      res.status(404).json({
        success: false,
        message: 'Person not found'
      });
      return;
    }
    
    if (!person.location?.coordinates) {
      res.status(404).json({
        success: false,
        message: 'Person has no location data'
      });
      return;
    }
    
    const location: MapLocation = {
      id: person.id,
      name: person.name,
      coordinates: person.location.coordinates,
      address: person.location.address
    };
    
    res.json({
      success: true,
      data: location
    });
  } catch (error) {
    console.error('Error fetching person location:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch person location',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /map/nearby - Get people within a radius of a location
router.get('/nearby', async (req: Request, res: Response): Promise<void> => {
  try {
    const { lat, lng, radius = 50 } = req.query; // radius in kilometers
    
    if (!lat || !lng) {
      res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
      return;
    }
    
    const centerLat = parseFloat(String(lat));
    const centerLng = parseFloat(String(lng));
    const radiusKm = parseInt(String(radius));
    
    if (isNaN(centerLat) || isNaN(centerLng) || isNaN(radiusKm)) {
      res.status(400).json({
        success: false,
        message: 'Invalid latitude, longitude, or radius'
      });
      return;
    }
    
    const allPeople = await PersonService.getAllPeople();
    
    const nearbyLocations: MapLocation[] = allPeople
      .filter(person => person.location?.coordinates)
      .map(person => ({
        id: person.id,
        name: person.name,
        coordinates: person.location!.coordinates!,
        address: person.location!.address
      }))
      .filter(location => {
        const distance = calculateDistance(
          centerLat,
          centerLng,
          location.coordinates.lat,
          location.coordinates.lng
        );
        return distance <= radiusKm;
      });
    
    res.json({
      success: true,
      data: nearbyLocations,
      count: nearbyLocations.length,
      center: { lat: centerLat, lng: centerLng },
      radius: `${radiusKm}km`
    });
  } catch (error) {
    console.error('Error fetching nearby locations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch nearby locations',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Helper function to calculate distance between two coordinates
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // Distance in kilometers
  return distance;
}

export default router;

