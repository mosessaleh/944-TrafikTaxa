const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

// City coordinates and driver counts
const cities = {
  copenhagen: { lat: 55.6761, lon: 12.5683, count: 8 },
  farum: { lat: 55.8127, lon: 12.3688, count: 5 },
  frederikssund: { lat: 55.8396, lon: 12.0686, count: 3 },
  roskilde: { lat: 55.6419, lon: 12.0878, count: 3 },
  odense: { lat: 55.4038, lon: 10.4024, count: 2 },
  hillerod: { lat: 55.9267, lon: 12.3109, count: 3 },
  frederiksvark: { lat: 55.9707, lon: 12.0225, count: 1 }
};

// Generate random locations within a city
function generateLocations(city, count) {
  const locations = [];
  for (let i = 0; i < count; i++) {
    // Add random offset within ~1km radius
    const latOffset = (Math.random() - 0.5) * 0.02;
    const lonOffset = (Math.random() - 0.5) * 0.02;
    locations.push({
      lat: city.lat + latOffset,
      lon: city.lon + lonOffset
    });
  }
  return locations;
}

// Generate all driver locations
function generateAllDriverLocations() {
  const allLocations = [];
  Object.values(cities).forEach(city => {
    allLocations.push(...generateLocations(city, city.count));
  });
  return allLocations;
}

// Fake Danish company data
const fakeCompanies = [
  {
    cvr: '11223344',
    comName: 'Nordic Taxi Service ApS',
    contactPerson: 'Lars Jensen',
    comAddress: 'Østerbrogade 123, 2100 København Ø',
    comPhone: '+4520304050',
    comEmail: 'contact@nordictaxi.dk',
    comBankInfo: 'Danske Bank 1234-567890',
    commissionRate: 12.5
  },
  {
    cvr: '22334455',
    comName: 'Capital Transport Ltd',
    contactPerson: 'Mette Nielsen',
    comAddress: 'Frederiksborggade 45, 1360 København K',
    comPhone: '+4520405060',
    comEmail: 'info@capitaltransport.dk',
    comBankInfo: 'Nordea 9876-543210',
    commissionRate: 10.0
  },
  {
    cvr: '33445566',
    comName: 'Zealand Chauffeur Service',
    contactPerson: 'Anders Petersen',
    comAddress: 'Algade 78, 4000 Roskilde',
    comPhone: '+4520506070',
    comEmail: 'anders@zealandchauffeur.dk',
    comBankInfo: 'Jyske Bank 4567-890123',
    commissionRate: 11.5
  },
  {
    cvr: '44556677',
    comName: 'Funen Taxi Company',
    contactPerson: 'Karen Hansen',
    comAddress: 'Kongensgade 234, 5000 Odense C',
    comPhone: '+4520607080',
    comEmail: 'karen@funentaxi.dk',
    comBankInfo: 'Sydbank 7890-123456',
    commissionRate: 13.0
  },
  {
    cvr: '55667788',
    comName: 'Northern Drivers Co',
    contactPerson: 'Thomas Christensen',
    comAddress: 'Slotsgade 56, 3400 Hillerød',
    comPhone: '+4520708090',
    comEmail: 'thomas@northerndrivers.dk',
    comBankInfo: 'Spar Nord 0123-456789',
    commissionRate: 9.5
  }
];

// Fake Danish driver data
const fakeDrivers = [
  { fname: 'Jens', lname: 'Andersen', sex: 'MALE' },
  { fname: 'Maria', lname: 'Jørgensen', sex: 'FEMALE' },
  { fname: 'Peter', lname: 'Rasmussen', sex: 'MALE' },
  { fname: 'Anna', lname: 'Larsen', sex: 'FEMALE' },
  { fname: 'Michael', lname: 'Pedersen', sex: 'MALE' },
  { fname: 'Louise', lname: 'Madsen', sex: 'FEMALE' },
  { fname: 'Christian', lname: 'Kristensen', sex: 'MALE' },
  { fname: 'Camilla', lname: 'Nielsen', sex: 'FEMALE' },
  { fname: 'Henrik', lname: 'Poulsen', sex: 'MALE' },
  { fname: 'Sofie', lname: 'Johansen', sex: 'FEMALE' },
  { fname: 'Martin', lname: 'Schmidt', sex: 'MALE' },
  { fname: 'Emma', lname: 'Holm', sex: 'FEMALE' },
  { fname: 'Lars', lname: 'Laursen', sex: 'MALE' },
  { fname: 'Ida', lname: 'Kjær', sex: 'FEMALE' },
  { fname: 'Anders', lname: 'Fischer', sex: 'MALE' },
  { fname: 'Maja', lname: 'Christensen', sex: 'FEMALE' },
  { fname: 'Thomas', lname: 'Knudsen', sex: 'MALE' },
  { fname: 'Freja', lname: 'Olsen', sex: 'FEMALE' },
  { fname: 'Daniel', lname: 'Thomsen', sex: 'MALE' },
  { fname: 'Caroline', lname: 'Henriksen', sex: 'FEMALE' },
  { fname: 'Rasmus', lname: 'Lund', sex: 'MALE' },
  { fname: 'Isabella', lname: 'Jakobsen', sex: 'FEMALE' },
  { fname: 'Simon', lname: 'Møller', sex: 'MALE' },
  { fname: 'Victoria', lname: 'Frederiksen', sex: 'FEMALE' },
  { fname: 'Oliver', lname: 'Sørensen', sex: 'MALE' }
];

// Fake vehicle data
const fakeVehicles = [
  { make: 'Volkswagen', model: 'Passat', color: 'Black', seats: 4 },
  { make: 'Toyota', model: 'Corolla', color: 'White', seats: 4 },
  { make: 'Mercedes-Benz', model: 'E-Class', color: 'Silver', seats: 4 },
  { make: 'BMW', model: '3 Series', color: 'Blue', seats: 4 },
  { make: 'Audi', model: 'A4', color: 'Grey', seats: 4 },
  { make: 'Skoda', model: 'Octavia', color: 'Red', seats: 4 },
  { make: 'Peugeot', model: '308', color: 'Green', seats: 4 },
  { make: 'Volvo', model: 'V70', color: 'Dark Blue', seats: 4 },
  { make: 'Ford', model: 'Focus', color: 'Yellow', seats: 4 },
  { make: 'Opel', model: 'Astra', color: 'Orange', seats: 4 },
  { make: 'Renault', model: 'Megane', color: 'Purple', seats: 4 },
  { make: 'Citroën', model: 'C4', color: 'Brown', seats: 4 },
  { make: 'Nissan', model: 'Qashqai', color: 'Light Blue', seats: 5 },
  { make: 'Hyundai', model: 'i30', color: 'Pink', seats: 4 },
  { make: 'Kia', model: 'Ceed', color: 'Turquoise', seats: 4 },
  { make: 'Mazda', model: '6', color: 'Burgundy', seats: 4 },
  { make: 'Honda', model: 'Civic', color: 'Beige', seats: 4 },
  { make: 'Seat', model: 'Leon', color: 'Dark Green', seats: 4 },
  { make: 'Fiat', model: 'Tipo', color: 'Light Grey', seats: 4 },
  { make: 'Dacia', model: 'Logan', color: 'Dark Red', seats: 4 },
  { make: 'Suzuki', model: 'Swift', color: 'Gold', seats: 4 },
  { make: 'Mitsubishi', model: 'Lancer', color: 'Copper', seats: 4 },
  { make: 'Subaru', model: 'Impreza', color: 'Champagne', seats: 4 },
  { make: 'Tesla', model: 'Model 3', color: 'Pearl White', seats: 4 },
  { make: 'Polestar', model: '2', color: 'Snow', seats: 4 }
];

async function createFakeData() {
  try {
    console.log('🚀 Starting creation of fake partners, drivers, and vehicles...');

    // Clear existing data first
    console.log('🧹 Clearing existing partner data...');
    await prisma.comVehicles.deleteMany({});
    await prisma.comDriver.deleteMany({});
    await prisma.partnerCompany.deleteMany({});
    console.log('✅ Existing data cleared');

    // Generate all driver locations
    const driverLocations = generateAllDriverLocations();
    console.log(`📍 Generated ${driverLocations.length} driver locations`);

    // Hash a default password for all
    const plainPassword = 'driver123';
    const hashedPassword = await bcrypt.hash(plainPassword, 12);

    // Create companies and their drivers
    for (let i = 0; i < fakeCompanies.length; i++) {
      const companyData = fakeCompanies[i];
      const companyPassword = await bcrypt.hash(`company${i + 1}pass`, 12);

      console.log(`\n🏢 Creating company: ${companyData.comName}`);

      const company = await prisma.partnerCompany.create({
        data: {
          ...companyData,
          comStatus: true,
          contractSigned: true,
          comUserName: `company${i + 1}`,
          comPass: companyPassword
        }
      });

      console.log(`✅ Company created with ID: ${company.id}`);

      // Create 5 vehicles for this company
      const companyVehicles = [];
      for (let j = 0; j < 5; j++) {
        const vehicleIndex = i * 5 + j;
        const vehicleData = fakeVehicles[vehicleIndex];

        // Generate Danish license plate format (e.g., AB 12 345)
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const plate = `${letters[Math.floor(Math.random() * 26)]}${letters[Math.floor(Math.random() * 26)]} ${String(Math.floor(Math.random() * 90) + 10)} ${String(Math.floor(Math.random() * 900) + 100)}`;

        const vehicle = await prisma.comVehicles.create({
          data: {
            comId: company.id,
            regNumber: plate,
            make: vehicleData.make,
            model: vehicleData.model,
            year: 2020 + Math.floor(Math.random() * 4), // 2020-2023
            seats: vehicleData.seats,
            color: vehicleData.color,
            fuel: 'Petrol',
            status: 1, // Active
            taxiPermitNumber: `TP${String(Math.floor(Math.random() * 900000) + 100000).padStart(6, '0')}`,
            vinNumber: `VIN${String(Math.floor(Math.random() * 900000000000) + 100000000000)}`
          }
        });

        companyVehicles.push(vehicle);
        console.log(`  🚗 Vehicle: ${vehicle.make} ${vehicle.model} - Plate: ${vehicle.regNumber}`);
      }

      // Create 5 drivers for this company
      for (let j = 0; j < 5; j++) {
        const driverIndex = i * 5 + j;
        const driverData = fakeDrivers[driverIndex];
        const location = driverLocations[driverIndex];
        const assignedVehicle = companyVehicles[j];

        const driver = await prisma.comDriver.create({
          data: {
            comId: company.id,
            cpr: `0101${String(Math.floor(Math.random() * 900000) + 100000).padStart(6, '0')}`, // Fake CPR
            drFname: driverData.fname,
            drLname: driverData.lname,
            sex: driverData.sex,
            drAddress: `${Math.floor(Math.random() * 200) + 1} ${['Østerbrogade', 'Nørrebrogade', 'Vesterbrogade', 'Amagerbrogade', 'Frederiksborggade'][Math.floor(Math.random() * 5)]}, ${[2100, 2200, 2300, 2400, 2450][Math.floor(Math.random() * 5)]} København`,
            drPhone: `+45${String(Math.floor(Math.random() * 90000000) + 10000000)}`,
            drEmail: `${driverData.fname.toLowerCase()}.${driverData.lname.toLowerCase()}@driver${i + 1}.dk`,
            licenceNr: `DL${String(Math.floor(Math.random() * 900000) + 100000).padStart(6, '0')}`,
            drCard: `DC${String(Math.floor(Math.random() * 900000) + 100000).padStart(6, '0')}`,
            car: assignedVehicle.regNumber, // Link driver to vehicle
            drUsername: `driver${i + 1}_${j + 1}`,
            drPass: hashedPassword,
            lastLocation: {
              lat: location.lat,
              lon: location.lon
            }
          }
        });

        console.log(`  👤 Driver: ${driver.drFname} ${driver.drLname} - Vehicle: ${assignedVehicle.regNumber} - Location: ${location.lat.toFixed(4)}, ${location.lon.toFixed(4)}`);
      }
    }

    console.log('\n🎉 All fake data created successfully!');
    console.log('\n📋 Summary:');
    console.log('- 5 companies created');
    console.log('- 25 vehicles created (5 per company)');
    console.log('- 25 drivers created (5 per company)');
    console.log('- Each driver linked to a vehicle');
    console.log('- Driver locations distributed across Danish cities');
    console.log('\n🔐 Default passwords:');
    console.log('- Company login: company{X}pass (where X is 1-5)');
    console.log('- Driver login: driver123');

  } catch (error) {
    console.error('❌ Error creating fake data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createFakeData();