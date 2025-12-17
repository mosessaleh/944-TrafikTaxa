// Test the driver ride status update endpoint
async function testStatusUpdate() {
  try {
    const response = await fetch('http://localhost:3000/api/driver/rides/1/status', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'accepted'
      })
    });

    const data = await response.json();
    console.log('Response status:', response.status);
    console.log('API Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

testStatusUpdate();