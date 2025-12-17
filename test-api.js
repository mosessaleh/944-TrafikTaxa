// Test available-vehicles API with strategy
async function testAPI() {
  try {
    const params = new URLSearchParams({
      pickupLat: '55.830844',
      pickupLon: '12.072812',
      vehicleTypeId: '1'
    });

    const response = await fetch(`http://localhost:3000/api/available-vehicles?${params}`);
    const data = await response.json();
    console.log('Available Vehicles Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

testAPI();