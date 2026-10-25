// Approximate neighborhood centers [lng, lat], for "start from" presets.
export const NEIGHBORHOODS = [
  ['Manhattan', [
    ['Financial District', [-74.0090, 40.7075]], ['Tribeca', [-74.0086, 40.7163]], ['SoHo', [-74.0000, 40.7233]],
    ['Lower East Side', [-73.9881, 40.7150]], ['East Village', [-73.9840, 40.7265]], ['West Village', [-74.0037, 40.7358]],
    ['Greenwich Village', [-73.9973, 40.7336]], ['Chelsea', [-74.0014, 40.7465]], ['Flatiron', [-73.9897, 40.7401]],
    ['Gramercy', [-73.9845, 40.7368]], ['Murray Hill', [-73.9785, 40.7479]], ['Kips Bay', [-73.9780, 40.7420]],
    ['Midtown East', [-73.9720, 40.7549]], ['Midtown West', [-73.9870, 40.7590]], ["Hell's Kitchen", [-73.9918, 40.7638]],
    ['Upper West Side', [-73.9754, 40.7870]], ['Upper East Side', [-73.9566, 40.7736]], ['Yorkville', [-73.9493, 40.7762]],
    ['Morningside Heights', [-73.9626, 40.8090]], ['Harlem', [-73.9465, 40.8116]], ['Washington Heights', [-73.9396, 40.8417]],
  ]],
  ['Brooklyn', [
    ['Williamsburg', [-73.9573, 40.7143]], ['Greenpoint', [-73.9514, 40.7304]], ['Bushwick', [-73.9212, 40.6944]],
    ['DUMBO', [-73.9885, 40.7033]], ['Brooklyn Heights', [-73.9936, 40.6960]], ['Downtown Brooklyn', [-73.9860, 40.6928]],
    ['Fort Greene', [-73.9754, 40.6891]], ['Cobble Hill', [-73.9960, 40.6860]], ['Carroll Gardens', [-73.9990, 40.6795]],
    ['Park Slope', [-73.9800, 40.6710]], ['Prospect Heights', [-73.9680, 40.6775]], ['Crown Heights', [-73.9449, 40.6694]],
    ['Bay Ridge', [-74.0288, 40.6264]],
  ]],
  ['Queens', [
    ['Long Island City', [-73.9496, 40.7447]], ['Astoria', [-73.9230, 40.7644]], ['Sunnyside', [-73.9240, 40.7433]],
    ['Forest Hills', [-73.8448, 40.7185]],
  ]],
  ['Elsewhere', [
    ['Hoboken', [-74.0324, 40.7440]], ['Jersey City', [-74.0431, 40.7178]], ['Riverdale', [-73.9120, 40.8940]],
    ['St. George, Staten Island', [-74.0776, 40.6437]],
  ]],
];

export const DEFAULT_HOME = { label: 'Midtown West', coords: [-73.9870, 40.7590] };

export function findNeighborhood(label) {
  for (const [, places] of NEIGHBORHOODS) for (const [name, coords] of places) if (name === label) return { label: name, coords };
  return null;
}
