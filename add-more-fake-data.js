const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

// Distribution of vehicles by region
const regions = {
  northZealand: { lat: 55.93, lon: 12.3, count: 5, name: 'North Zealand' },
  centralZealand: { lat: 55.68, lon: 12.3, count: 10, name: 'Central Zealand' },
  fyn: { lat: 55.4, lon: 10.4, count: 10, name: 'Fyn' }
};

// Generate random locations within a region
function generateLocations(region, count) {
  const locations = [];
  for (let i = 0; i < count; i++) {
    // Add random offset within ~5km radius
    const latOffset = (Math.random() - 0.5) * 0.09;
    const lonOffset = (Math.random() - 0.5) * 0.09;
    locations.push({
      lat: region.lat + latOffset,
      lon: region.lon + lonOffset
    });
  }
  return locations;
}

// Generate all vehicle locations
function generateAllVehicleLocations() {
  const allLocations = [];
  Object.values(regions).forEach(region => {
    allLocations.push(...generateLocations(region, region.count));
  });
  return allLocations;
}

// New fake Danish company data
const newFakeCompanies = [
  {
    cvr: '1234567890',
    comName: 'Scandinavian Ride Solutions',
    contactPerson: 'Erik Larsen',
    comAddress: 'Kongens Nytorv 5, 1050 København K',
    comPhone: '+4520809010',
    comEmail: 'erik@scandinavianride.dk',
    comBankInfo: 'Danske Bank 2345-678901',
    commissionRate: 11.0
  },
  {
    cvr: '2345678901',
    comName: 'Baltic Transport Group',
    contactPerson: 'Nina Sørensen',
    comAddress: 'Strøget 12, 1200 København K',
    comPhone: '+4520901020',
    comEmail: 'nina@baltictransport.dk',
    comBankInfo: 'Nordea 3456-789012',
    commissionRate: 12.0
  },
  {
    cvr: '3456789012',
    comName: 'Danish Mobility Services',
    contactPerson: 'Frederik Andersen',
    comAddress: 'Rådhuspladsen 1, 1550 København V',
    comPhone: '+4520102030',
    comEmail: 'frederik@danishmobility.dk',
    comBankInfo: 'Jyske Bank 5678-901234',
    commissionRate: 10.5
  },
  {
    cvr: '4567890123',
    comName: 'Nordic Chauffeur Network',
    contactPerson: 'Sofia Jensen',
    comAddress: 'Tivoli Gardens, 1631 København V',
    comPhone: '+4520203040',
    comEmail: 'sofia@nordicchauffeur.dk',
    comBankInfo: 'Sydbank 6789-012345',
    commissionRate: 13.5
  },
  {
    cvr: '5678901234',
    comName: 'Zealand Taxi Alliance',
    contactPerson: 'Magnus Nielsen',
    comAddress: 'Christiansborg Slotsplads 1, 1218 København K',
    comPhone: '+4520304050',
    comEmail: 'magnus@zealandtaxi.dk',
    comBankInfo: 'Spar Nord 7890-123456',
    commissionRate: 9.0
  }
];

// New fake Danish driver data
const newFakeDrivers = [
  { fname: 'Alexander', lname: 'Berg', sex: 'MALE' },
  { fname: 'Emilie', lname: 'Vestergaard', sex: 'FEMALE' },
  { fname: 'Sebastian', lname: 'Kofoed', sex: 'MALE' },
  { fname: 'Mathilde', lname: 'Winther', sex: 'FEMALE' },
  { fname: 'Victor', lname: 'Bjerregaard', sex: 'MALE' },
  { fname: 'Laura', lname: 'Haugaard', sex: 'FEMALE' },
  { fname: 'Oscar', lname: 'Villadsen', sex: 'MALE' },
  { fname: 'Clara', lname: 'Krogh', sex: 'FEMALE' },
  { fname: 'Felix', lname: 'Buch', sex: 'MALE' },
  { fname: 'Alma', lname: 'Dahl', sex: 'FEMALE' },
  { fname: 'William', lname: 'Hald', sex: 'MALE' },
  { fname: 'Ella', lname: 'Bech', sex: 'FEMALE' },
  { fname: 'Noah', lname: 'Storm', sex: 'MALE' },
  { fname: 'Signe', lname: 'Frost', sex: 'FEMALE' },
  { fname: 'Lucas', lname: 'Rye', sex: 'MALE' },
  { fname: 'Astrid', lname: 'Markussen', sex: 'FEMALE' },
  { fname: 'Benjamin', lname: 'Skov', sex: 'MALE' },
  { fname: 'Liv', lname: 'Birk', sex: 'FEMALE' },
  { fname: 'Oliver', lname: 'Due', sex: 'MALE' },
  { fname: 'Mille', lname: 'Koch', sex: 'FEMALE' },
  { fname: 'Carl', lname: 'Bonde', sex: 'MALE' },
  { fname: 'Rosa', lname: 'Hviid', sex: 'FEMALE' },
  { fname: 'August', lname: 'Krarup', sex: 'MALE' },
  { fname: 'Nora', lname: 'Skaaning', sex: 'FEMALE' },
  { fname: 'Theodor', lname: 'Buhl', sex: 'MALE' }
];

// New vehicle data
const newFakeVehicles = [
  { make: 'Volkswagen', model: 'Golf', color: 'Navy Blue', seats: 4 },
  { make: 'Toyota', model: 'Yaris', color: 'Silver', seats: 4 },
  { make: 'Mercedes-Benz', model: 'C-Class', color: 'Black', seats: 4 },
  { make: 'BMW', model: '5 Series', color: 'White', seats: 4 },
  { make: 'Audi', model: 'A6', color: 'Grey', seats: 4 },
  { make: 'Skoda', model: 'Superb', color: 'Blue', seats: 4 },
  { make: 'Peugeot', model: '508', color: 'Red', seats: 4 },
  { make: 'Volvo', model: 'XC60', color: 'Dark Blue', seats: 5 },
  { make: 'Ford', model: 'Mondeo', color: 'Green', seats: 4 },
  { make: 'Opel', model: 'Insignia', color: 'Orange', seats: 4 },
  { make: 'Renault', model: 'Talisman', color: 'Purple', seats: 4 },
  { make: 'Citroën', model: 'C5', color: 'Brown', seats: 4 },
  { make: 'Nissan', model: 'X-Trail', color: 'Light Blue', seats: 5 },
  { make: 'Hyundai', model: 'Tucson', color: 'Pink', seats: 5 },
  { make: 'Kia', model: 'Sportage', color: 'Turquoise', seats: 5 },
  { make: 'Mazda', model: 'CX-5', color: 'Burgundy', seats: 5 },
  { make: 'Honda', model: 'CR-V', color: 'Beige', seats: 5 },
  { make: 'Seat', model: 'Ateca', color: 'Dark Green', seats: 5 },
  { make: 'Fiat', model: '500X', color: 'Light Grey', seats: 4 },
  { make: 'Dacia', model: 'Duster', color: 'Dark Red', seats: 5 },
  { make: 'Suzuki', model: 'Vitara', color: 'Gold', seats: 4 },
  { make: 'Mitsubishi', model: 'Outlander', color: 'Copper', seats: 5 },
  { make: 'Subaru', model: 'Forester', color: 'Champagne', seats: 5 },
  { make: 'Tesla', model: 'Model Y', color: 'Pearl White', seats: 5 },
  { make: 'Polestar', model: '3', color: 'Snow', seats: 5 }
];

// Vehicle types to assign
const vehicleTypes = ['SEDAN5', 'SEVEN_NO_BAG', 'VAN', 'LIMO'];

async function addMoreFakeData() {
  try {
    console.log('🚀 Starting addition of more fake partners, drivers, and vehicles...');

    // Generate all vehicle locations
    const vehicleLocations = generateAllVehicleLocations();
    console.log(`📍 Generated ${vehicleLocations.length} vehicle locations`);

    // Hash a default password for all drivers
    const plainPassword = 'driver123';
    const hashedPassword = await bcrypt.hash(plainPassword, 12);

    // Create companies and their vehicles/drivers
    for (let i = 0; i < newFakeCompanies.length; i++) {
      const companyData = newFakeCompanies[i];
      const companyPassword = await bcrypt.hash(`company${i + 16}pass`, 12);

      console.log(`\n🏢 Creating company: ${companyData.comName}`);

      const company = await prisma.partnercompany.create({
        data: {
          ...companyData,
          comStatus: true,
          contractSigned: true,
          comUserName: `company${i + 16}`,
          comPass: companyPassword,
          updatedAt: new Date()
        }
      });

      console.log(`✅ Company created with ID: ${company.id}`);

      // Create 5 vehicles for this company
      const companyVehicles = [];
      for (let j = 0; j < 5; j++) {
        const vehicleIndex = i * 5 + j;
        const vehicleData = newFakeVehicles[vehicleIndex];
        const location = vehicleLocations[vehicleIndex];

        // Generate Danish license plate format (e.g., AB 12 345)
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const plate = `${letters[Math.floor(Math.random() * 26)]}${letters[Math.floor(Math.random() * 26)]} ${String(Math.floor(Math.random() * 90) + 10)} ${String(Math.floor(Math.random() * 900) + 100)}`;

        // Assign vehicle type randomly
        const vehicleType = vehicleTypes[Math.floor(Math.random() * vehicleTypes.length)];

        const vehicle = await prisma.comvehicles.create({
          data: {
            comId: company.id,
            regNumber: plate,
            make: vehicleData.make,
            model: vehicleData.model,
            year: 2021 + Math.floor(Math.random() * 3), // 2021-2023
            seats: vehicleData.seats,
            color: vehicleData.color,
            fuel: 'Petrol',
            status: 1, // Active
            vehicleType: vehicleType,
            taxiPermitNumber: `TP${String(Math.floor(Math.random() * 900000) + 100000).padStart(6, '0')}`,
            vinNumber: `VIN${String(Math.floor(Math.random() * 900000000000) + 100000000000)}`,
            lastLat: location.lat,
            lastLon: location.lon,
            lastLocationUpdate: new Date(),
            updatedAt: new Date()
          }
        });

        companyVehicles.push(vehicle);
        console.log(`  🚗 Vehicle: ${vehicle.make} ${vehicle.model} - Plate: ${vehicle.regNumber} - Type: ${vehicleType} - Location: ${location.lat.toFixed(4)}, ${location.lon.toFixed(4)}`);
      }

      // Create 5 drivers for this company
      for (let j = 0; j < 5; j++) {
        const driverIndex = i * 5 + j;
        const driverData = newFakeDrivers[driverIndex];
        const assignedVehicle = companyVehicles[j];

        const driver = await prisma.comdriver.create({
          data: {
            comId: company.id,
            cpr: `0202${String(Math.floor(Math.random() * 900000) + 100000).padStart(6, '0')}`, // Fake CPR
            drFname: driverData.fname,
            drLname: driverData.lname,
            sex: driverData.sex,
            drAddress: `${Math.floor(Math.random() * 200) + 1} ${['Østerbrogade', 'Nørrebrogade', 'Vesterbrogade', 'Amagerbrogade', 'Frederiksborggade'][Math.floor(Math.random() * 5)]}, ${[2100, 2200, 2300, 2400, 2450][Math.floor(Math.random() * 5)]} København`,
            drPhone: `+45${String(Math.floor(Math.random() * 90000000) + 10000000)}`,
            drEmail: `${driverData.fname.toLowerCase()}.${driverData.lname.toLowerCase()}@driver${i + 16}.dk`,
            licenceNr: `DL${String(Math.floor(Math.random() * 900000) + 100000).padStart(6, '0')}`,
            drCard: `DC${String(Math.floor(Math.random() * 900000) + 100000).padStart(6, '0')}`,
            car: assignedVehicle.regNumber, // Link driver to vehicle
            drUsername: `driver${i + 16}_${j + 1}`,
            drPass: hashedPassword,
            lastLocation: {
              lat: assignedVehicle.lastLat,
              lon: assignedVehicle.lastLon
            }
          }
        });

        // Update vehicle with driver ID
        await prisma.comvehicles.update({
          where: { id: assignedVehicle.id },
          data: { uId: driver.id }
        });

        console.log(`  👤 Driver: ${driver.drFname} ${driver.drLname} - Vehicle: ${assignedVehicle.regNumber} - ID: ${driver.id}`);
      }
    }

    console.log('\n🎉 Additional fake data created successfully!');
    console.log('\n📋 Summary:');
    console.log('- 5 additional companies created');
    console.log('- 25 additional vehicles created (5 per company)');
    console.log('- 25 additional drivers created (5 per company)');
    console.log('- Each driver linked to a vehicle');
    console.log('- Vehicles distributed: 5 North Zealand, 10 Central Zealand, 10 Fyn');
    console.log('- Vehicle types assigned randomly');
    console.log('\n🔐 Default passwords:');
    console.log('- Company login: company{X}pass (where X is 6-10)');
    console.log('- Driver login: driver123');

  } catch (error) {
    console.error('❌ Error adding fake data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addMoreFakeData();