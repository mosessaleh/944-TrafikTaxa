async function getCoordinates() {
  try {
    const response = await fetch('https://photon.komoot.io/api/?q=kocksvej%2038%2C%203600%20Frederikssund&limit=1&lang=en', {
      headers: {
        'Accept': 'application/json',
        'User-Agent': '944-Trafik-App/1.0'
      }
    });

    if (response.ok) {
      const data = await response.json();
      if (data.features && data.features.length > 0) {
        const item = data.features[0];
        console.log('Coordinates:', {
          lat: item.geometry.coordinates[1],
          lon: item.geometry.coordinates[0]
        });
      } else {
        console.log('No results found');
      }
    } else {
      console.log('API failed');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

getCoordinates();