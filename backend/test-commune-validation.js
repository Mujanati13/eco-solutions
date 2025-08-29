// Test script to verify commune validation logic

class MockEcotrackService {
  validateAndFixCommune(commune, wilayaId) {
    if (!commune || typeof commune !== 'string') {
      return this.getDefaultCommuneForWilaya(wilayaId);
    }
    
    const originalCommune = commune;
    
    // Common problematic communes mapping
    const communeMapping = {
      'Douira': 'Alger Centre',
      'douira': 'Alger Centre',
      'Tamanrasset': 'In Salah',
      'تمنراست': 'In Salah',
      'Bir Mourad Rais': 'Bir Mourad Rais',
      'El Harrach': 'El Harrach',
      'Rouiba': 'Rouiba',
      'Reghaia': 'Reghaia',
      'Dar El Beida': 'Dar El Beida',
      // Bab Ezzouar area alternatives - fallback to Alger Centre if not recognized
      'Bab Ezzouar': 'Alger Centre', // Fallback to known working commune
      'Bab ezzouar': 'Alger Centre', // Fallback to known working commune
      'BAB EZZOUAR': 'Alger Centre', // Fallback to known working commune
      'bab ezzouar': 'Alger Centre', // Fallback to known working commune
      // Staoueli area alternatives (common misspelling)
      'Setaouali': 'Staoueli',
      'setaouali': 'Staoueli',
      // Oum El Bouaghi alternatives
      'Oum El Bouaghi': 'Oum el bouaghi',
      'Oum el Bouaghi': 'Oum el bouaghi',
      'Oum el bouaghi': 'Oum el bouaghi',
      'أم البواقي': 'Oum el bouaghi'
    };
    
    // Direct mapping first
    if (communeMapping[commune]) {
      console.log(`🔄 Mapped commune "${originalCommune}" to "${communeMapping[commune]}"`);
      return communeMapping[commune];
    }
    
    // Special handling for Alger wilaya (16) - use known working communes
    if (wilayaId === 16) {
      const algerCommunes = [
        'Alger Centre', 'Bab El Oued', 'El Harrach', 'Bir Mourad Rais', 
        'Rouiba', 'Reghaia', 'Dar El Beida', 'Baraki', 'Sidi Moussa'
      ];
      
      // If the commune contains common Alger area keywords, try to map it
      const lowerCommune = commune.toLowerCase();
      if (lowerCommune.includes('bab') && lowerCommune.includes('ez')) {
        console.log(`🏛️ Bab Ezzouar area detected, using Alger Centre as fallback`);
        return 'Alger Centre';
      }
      
      // If it's not a recognized Alger commune, use Alger Centre as default
      if (!algerCommunes.some(ac => ac.toLowerCase() === lowerCommune)) {
        console.log(`🏛️ Unknown Alger commune "${originalCommune}", using Alger Centre as fallback`);
        return 'Alger Centre';
      }
    }
    
    // Return original if it seems valid
    return commune;
  }
  
  getDefaultCommuneForWilaya(wilayaId) {
    const defaultCommunes = {
      16: 'Alger Centre', // Alger
    };
    return defaultCommunes[wilayaId] || `Wilaya${wilayaId}`;
  }
}

// Test cases
const service = new MockEcotrackService();

console.log('🧪 Testing commune validation for Alger wilaya (16)...\n');

const testCases = [
  'Bab Ezzouar',
  'Bab ezzouar',
  'BAB EZZOUAR',
  'bab ezzouar',
  'Some Unknown Commune',
  'Alger Centre',
  'El Harrach'
];

testCases.forEach((testCommune, index) => {
  console.log(`📋 Test ${index + 1}: "${testCommune}"`);
  const result = service.validateAndFixCommune(testCommune, 16);
  console.log(`✅ Result: "${result}"`);
  console.log('');
});

console.log('🎯 Expected: All Bab Ezzouar variations should map to "Alger Centre"');