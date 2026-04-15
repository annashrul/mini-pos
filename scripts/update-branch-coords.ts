import { prisma } from "../src/lib/prisma";

// Koordinat akurat kota-kota Indonesia (pusat kota)
const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  "jakarta": { lat: -6.17511, lng: 106.86503 },
  "jakarta pusat": { lat: -6.18641, lng: 106.83415 },
  "jakarta selatan": { lat: -6.26138, lng: 106.81084 },
  "jakarta barat": { lat: -6.16830, lng: 106.75893 },
  "jakarta timur": { lat: -6.22513, lng: 106.90044 },
  "jakarta utara": { lat: -6.12174, lng: 106.93056 },
  "bandung": { lat: -6.91746, lng: 107.61912 },
  "surabaya": { lat: -7.25057, lng: 112.76831 },
  "medan": { lat: 3.59530, lng: 98.67244 },
  "semarang": { lat: -6.96618, lng: 110.41906 },
  "makassar": { lat: -5.14771, lng: 119.43278 },
  "yogyakarta": { lat: -7.79558, lng: 110.36949 },
  "denpasar": { lat: -8.65629, lng: 115.21635 },
  "malang": { lat: -7.97791, lng: 112.63455 },
  "palembang": { lat: -2.97614, lng: 104.77544 },
  "tangerang": { lat: -6.17831, lng: 106.63180 },
  "depok": { lat: -6.40254, lng: 106.79422 },
  "bekasi": { lat: -6.23837, lng: 106.97568 },
  "bogor": { lat: -6.59714, lng: 106.80600 },
  "solo": { lat: -7.57539, lng: 110.82432 },
  "surakarta": { lat: -7.57539, lng: 110.82432 },
  "balikpapan": { lat: -1.26754, lng: 116.82870 },
  "manado": { lat: 1.47488, lng: 124.84217 },
  "padang": { lat: -0.94714, lng: 100.41718 },
  "pontianak": { lat: -0.02628, lng: 109.34254 },
  "banjarmasin": { lat: -3.31863, lng: 114.59437 },
  "pekanbaru": { lat: 0.50714, lng: 101.44540 },
  "lampung": { lat: -5.42961, lng: 105.26105 },
  "bandar lampung": { lat: -5.42961, lng: 105.26105 },
  "mataram": { lat: -8.58377, lng: 116.11647 },
  "kupang": { lat: -10.17846, lng: 123.60706 },
  "ambon": { lat: -3.69594, lng: 128.18067 },
  "jayapura": { lat: -2.53724, lng: 140.72181 },
  "samarinda": { lat: -0.49468, lng: 117.14643 },
  "batam": { lat: 1.04580, lng: 104.03000 },
  "cirebon": { lat: -6.70619, lng: 108.55709 },
  "tasikmalaya": { lat: -7.32702, lng: 108.22024 },
  "sukabumi": { lat: -6.92274, lng: 106.92700 },
  "garut": { lat: -7.22729, lng: 107.90889 },
  "purwokerto": { lat: -7.42487, lng: 109.23440 },
  "tegal": { lat: -6.87943, lng: 109.14247 },
  "pekalongan": { lat: -6.88914, lng: 109.67523 },
  "magelang": { lat: -7.47059, lng: 110.21765 },
  "klaten": { lat: -7.70556, lng: 110.60693 },
  "kediri": { lat: -7.81609, lng: 112.01157 },
  "jember": { lat: -8.16879, lng: 113.70225 },
  "banyuwangi": { lat: -8.23340, lng: 114.35733 },
  "sidoarjo": { lat: -7.44731, lng: 112.71830 },
  "gresik": { lat: -7.16221, lng: 112.65390 },
  "mojokerto": { lat: -7.47241, lng: 112.43405 },
  "madiun": { lat: -7.62996, lng: 111.52284 },
  "blitar": { lat: -8.09972, lng: 112.16838 },
  "probolinggo": { lat: -7.75175, lng: 113.21521 },
  "pasuruan": { lat: -7.64523, lng: 112.90696 },
};

// Street-level offsets berdasarkan nama jalan
const STREET_OFFSETS: Record<string, { dlat: number; dlng: number }> = {
  "merdeka": { dlat: 0.002, dlng: -0.001 },
  "sudirman": { dlat: -0.003, dlng: 0.002 },
  "thamrin": { dlat: 0.001, dlng: 0.003 },
  "gatot subroto": { dlat: -0.004, dlng: -0.002 },
  "diponegoro": { dlat: 0.003, dlng: -0.003 },
  "asia afrika": { dlat: -0.001, dlng: 0.004 },
  "pahlawan": { dlat: 0.004, dlng: 0.001 },
  "kebon jeruk": { dlat: -0.002, dlng: -0.004 },
  "raya bogor": { dlat: 0.005, dlng: 0.002 },
  "industri": { dlat: -0.005, dlng: 0.003 },
};

function detectCity(text: string): string | null {
  const lower = text.toLowerCase();
  // Cek kota yang lebih spesifik dulu (e.g. "jakarta selatan" sebelum "jakarta")
  const sorted = Object.keys(CITY_COORDS).sort((a, b) => b.length - a.length);
  for (const city of sorted) {
    if (lower.includes(city)) return city;
  }
  return null;
}

function getStreetOffset(address: string): { dlat: number; dlng: number } {
  const lower = address.toLowerCase();
  for (const [street, offset] of Object.entries(STREET_OFFSETS)) {
    if (lower.includes(street)) return offset;
  }
  return { dlat: 0, dlng: 0 };
}

// Deterministic small offset based on string hash to spread markers
function hashOffset(str: string): { dlat: number; dlng: number } {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  const dlat = ((h & 0xffff) / 0xffff - 0.5) * 0.008;
  const dlng = (((h >> 16) & 0xffff) / 0xffff - 0.5) * 0.008;
  return { dlat, dlng };
}

async function main() {
  const branches = await prisma.branch.findMany({
    select: { id: true, name: true, address: true },
  });

  console.log(`Processing ${branches.length} branches...`);
  let updated = 0;

  for (const branch of branches) {
    const searchText = `${branch.address || ""} ${branch.name}`;
    const city = detectCity(searchText);
    if (!city) continue;

    const base = CITY_COORDS[city]!;
    const streetOff = getStreetOffset(branch.address || "");
    const hashOff = hashOffset(branch.id);

    const lat = Number((base.lat + streetOff.dlat + hashOff.dlat).toFixed(6));
    const lng = Number((base.lng + streetOff.dlng + hashOff.dlng).toFixed(6));

    await prisma.branch.update({
      where: { id: branch.id },
      data: { latitude: lat, longitude: lng },
    });
    updated++;
  }

  console.log(`Updated ${updated} / ${branches.length} branches`);
  process.exit(0);
}
main();
