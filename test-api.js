// Test API directly
async function testAPI() {
  try {
    const response = await fetch('http://localhost:3000/api/vehicle-selection', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pickupLat: 55.6761,
        pickupLon: 12.5683,
        dropoffLat: 55.6761,
        dropoffLon: 12.5683,
        vehicleTypeId: 1,
        maxVehicles: 3
      })
    });

    const data = await response.json();
    console.log('API Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

testAPI();