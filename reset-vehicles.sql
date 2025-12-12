UPDATE comVehicles SET
  lastLat = 55.6761 + (RAND() - 0.5) * 0.1,
  lastLon = 12.5683 + (RAND() - 0.5) * 0.1,
  lastLocationUpdate = CURRENT_TIMESTAMP;

