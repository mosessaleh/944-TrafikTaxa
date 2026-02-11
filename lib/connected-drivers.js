// In-memory storage for connected drivers
const connectedDrivers = global.connectedDrivers || new Map();
global.connectedDrivers = connectedDrivers;

module.exports = { connectedDrivers };
