import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

const products = [
  {
    id: 'dogs-golden-retriever-puppy-a1b2c3',
    name: 'Golden Retriever Puppy',
    description: 'A healthy, well-socialised Golden Retriever puppy raised in a family home.\n\nVaccinated, dewormed, and vet-checked. Comes with health records and a starter feeding guide.',
    features: ['12 weeks old, fully vaccinated', 'Dewormed and vet-checked', 'Great with children and other pets', 'Health records included'],
    image: 'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=800&q=80',
    vendor: 'Green Valley Kennels', price: 250000, category: 'dogs', breed: 'Golden Retriever', age: '12 weeks', stock: 1, rating: 5.0,
  },
  {
    id: 'cats-british-shorthair-kitten-d4e5f6',
    name: 'British Shorthair Kitten',
    description: 'Calm, affectionate British Shorthair kitten with a dense plush coat.\n\nLitter-trained and used to being handled daily.',
    features: ['10 weeks old', 'Litter-trained', 'First vaccinations done', 'Very calm temperament'],
    image: 'https://images.unsplash.com/photo-1574158622682-e40e69881006?auto=format&fit=crop&w=800&q=80',
    vendor: 'Whisker Home', price: 180000, category: 'cats', breed: 'British Shorthair', age: '10 weeks', stock: 2, rating: 4.9,
  },
  {
    id: 'food-premium-salmon-cat-food-g7h8i9',
    name: 'Premium Salmon Cat Food (2kg)',
    description: 'Rich in Omega-3 to support a shiny coat and healthy digestion for indoor cats.',
    features: ['Real salmon as first ingredient', 'Omega-3 for coat health', 'No artificial colours', 'Suitable for adult indoor cats'],
    image: 'https://images.unsplash.com/photo-1589924691106-386769065963?auto=format&fit=crop&w=800&q=80',
    vendor: 'PetCare Central', price: 15000, category: 'food', breed: null, age: null, stock: 40, rating: 4.8,
  },
  {
    id: 'toys-luxury-cat-tree-j1k2l3',
    name: '4-Tier Luxury Cat Tree',
    description: 'Solid wood construction with sisal scratching posts and a plush hammock.',
    features: ['4 levels with plush hammock', 'Sisal scratching posts', 'Sturdy solid-wood base', 'Easy assembly, tools included'],
    image: 'https://images.unsplash.com/photo-1545249390-6bdfa286032f?auto=format&fit=crop&w=800&q=80',
    vendor: 'MeowDesign', price: 45000, category: 'toys', breed: null, age: null, stock: 12, rating: 4.9,
  },
  {
    id: 'small-pets-starter-aquarium-kit-m4n5o6',
    name: 'Starter Aquarium Kit (30L)',
    description: 'Everything you need to start your underwater world: filter, LED light, and gravel.',
    features: ['30L tank with LED lighting', 'Internal filter included', 'Natural gravel substrate', 'Beginner-friendly setup guide'],
    image: 'https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?auto=format&fit=crop&w=800&q=80',
    vendor: 'AquaLife', price: 85000, category: 'small-pets', breed: null, age: null, stock: 8, rating: 4.6,
  },
  {
    id: 'accessories-leather-dog-collar-p7q8r9',
    name: 'Handmade Leather Dog Collar',
    description: 'Durable, soft-lined leather collar with solid brass hardware. Ages beautifully with use.',
    features: ['Genuine full-grain leather', 'Solid brass buckle and D-ring', 'Soft lining, no chafing', 'Available for medium to large dogs'],
    image: 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?auto=format&fit=crop&w=800&q=80',
    vendor: 'PawCraft', price: 22000, category: 'accessories', breed: null, age: null, stock: 25, rating: 4.7,
  },
];

async function main() {
  console.log('Seeding MyPetshoppy demo data...');
  for (const p of products) {
    await prisma.product.upsert({ where: { id: p.id }, update: {}, create: p });
    console.log(`  ✓ ${p.name}`);
  }
  console.log('Seeding finished.');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
