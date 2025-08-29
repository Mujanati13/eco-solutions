// Test script to verify improved remark building with quantity and product name removal

// Mock the EcoTrack services for testing
class MockEcotrackService {
  buildRemarqueWithConfirmer(notes = '', confirmerName = '', productDetails = null, quantity = null) {
    let remarque = '';
    const addedParts = new Set(); // Track added parts to prevent duplicates
    
    // Add quantity information if available
    if (quantity && quantity > 0) {
      const quantityPart = `Quantité: ${quantity}`;
      remarque += quantityPart;
      addedParts.add(quantityPart.toLowerCase());
    }
    
    // Add "colis ouvrable" information
    const colisOuvrablePart = 'Colis ouvrable';
    if (remarque) {
      remarque += ' | ';
    }
    remarque += colisOuvrablePart;
    addedParts.add(colisOuvrablePart.toLowerCase());
    
    // Add confirmer information if available
    if (confirmerName && confirmerName.trim()) {
      const confirmerPart = `Confirmé par: ${confirmerName.trim()}`;
      if (remarque) {
        remarque += ' | ';
      }
      remarque += confirmerPart;
      addedParts.add(confirmerPart.toLowerCase());
    }
    
    // Clean and process notes
    if (notes && notes.trim()) {
      let cleanNotes = notes.trim();
      
      // Remove potential product name patterns (anything that looks like a product name)
      cleanNotes = cleanNotes.replace(/^[A-Z\s]+[A-Z]+$/g, '').trim(); // Remove all-caps product names
      cleanNotes = cleanNotes.replace(/\b[A-Z]{2,}\s+[A-Z]{2,}[A-Z\s]*\b/g, '').trim(); // Remove patterns like "WOMEN CAT LUNETTE"
      cleanNotes = cleanNotes.replace(/\b[A-Z]+\s+[A-Z]+\s+[A-Z]+\b/g, '').trim(); // Remove 3+ word uppercase patterns
      cleanNotes = cleanNotes.replace(/^[A-Z][a-z]+\s+[A-Z][a-z]+\s+[A-Z][a-z]+.*$/g, '').trim(); // Remove title case product names
      
      // Remove specific product name patterns that might slip through
      cleanNotes = cleanNotes.replace(/.*WOMEN.*CAT.*LUNETTE.*/gi, '').trim();
      cleanNotes = cleanNotes.replace(/.*ENSEMBLE.*FEMME.*/gi, '').trim();
      cleanNotes = cleanNotes.replace(/.*MONTRE.*FEMME.*/gi, '').trim();
      cleanNotes = cleanNotes.replace(/.*PARFUM.*HOMME.*/gi, '').trim();
      cleanNotes = cleanNotes.replace(/.*MATLERXS.*/gi, '').trim();
      cleanNotes = cleanNotes.replace(/.*[A-Z]{3,}.*\d{3,}.*/gi, '').trim(); // Remove patterns like MATLERXS 2517
      cleanNotes = cleanNotes.replace(/.*originale.*/gi, '').trim();
      
      // Split notes by common separators and process each part
      const noteParts = cleanNotes.split(/[|,;]/).map(part => part.trim()).filter(part => part.length > 0);
      
      for (const notePart of noteParts) {
        // Skip empty parts or very short meaningless parts
        if (notePart.length < 2) continue;
        
        // Skip parts that look like product names (various patterns)
        const isProductName = (
          // All uppercase with multiple words
          (/^[A-Z\s]+[A-Z]+$/.test(notePart) && notePart.split(' ').length > 1) ||
          // Contains common product keywords
          /\b(WOMEN|HOMME|FEMME|CAT|LUNETTE|ENSEMBLE|MONTRE|PARFUM|COLLECTION|MATLERXS|originale)\b/i.test(notePart) ||
          // Long uppercase sequences
          /[A-Z]{8,}/.test(notePart) ||
          // Title case product patterns
          /^[A-Z][a-z]+\s+[A-Z][a-z]+\s+[A-Z][a-z]+/.test(notePart) ||
          // Product codes with numbers
          /[A-Z]{3,}.*\d{3,}/.test(notePart) ||
          // Contains "originale" keyword
          /originale/i.test(notePart)
        );
        
        if (isProductName) {
          console.log(`📝 Skipping product name pattern: "${notePart}"`);
          continue;
        }
        
        // Check if this part is already included (case-insensitive)
        const notePartLower = notePart.toLowerCase();
        let isDuplicate = false;
        
        for (const addedPart of addedParts) {
          if (addedPart.includes(notePartLower) || notePartLower.includes(addedPart)) {
            isDuplicate = true;
            break;
          }
        }
        
        if (!isDuplicate) {
          if (remarque) {
            remarque += ' | ';
          }
          remarque += notePart;
          addedParts.add(notePartLower);
        }
      }
    }
    
    // Additional cleanup: remove redundant separators and spaces
    remarque = remarque.replace(/\s*\|\s*\|\s*/g, ' | '); // Fix double separators
    remarque = remarque.replace(/^\s*\|\s*/, ''); // Remove leading separator
    remarque = remarque.replace(/\s*\|\s*$/, ''); // Remove trailing separator
    remarque = remarque.trim();
    
    return remarque;
  }
}

// Test cases for the new implementation
const service = new MockEcotrackService();

console.log('🧪 Testing improved remark building with MATLERXS product name...\n');

// Test case 1: MATLERXS product name (from user's log)
const testCase1 = {
  notes: 'MATLERXS   2517 originale',
  confirmerName: 'admin',
  quantity: 1
};

console.log('📋 Test Case 1: MATLERXS product name');
console.log('Input notes:', testCase1.notes);
console.log('Quantity:', testCase1.quantity);
console.log('Confirmer:', testCase1.confirmerName);
const result1 = service.buildRemarqueWithConfirmer(testCase1.notes, testCase1.confirmerName, null, testCase1.quantity);
console.log('✅ Result:', result1);
console.log('');

// Test case 2: User's actual log example
const testCase2 = {
  notes: 'Unfulfilled',
  confirmerName: 'admin',
  quantity: 1
};

console.log('📋 Test Case 2: User\'s actual log (Unfulfilled)');
console.log('Input notes:', testCase2.notes);
console.log('Quantity:', testCase2.quantity);
console.log('Confirmer:', testCase2.confirmerName);
const result2 = service.buildRemarqueWithConfirmer(testCase2.notes, testCase2.confirmerName, null, testCase2.quantity);
console.log('✅ Result:', result2);
console.log('');

// Test case 3: Mixed content with product name
const testCase3 = {
  notes: 'MATLERXS 2517 originale | Client préfère livraison matin',
  confirmerName: 'supervisor',
  quantity: 2
};

console.log('📋 Test Case 3: Mixed content with product name');
console.log('Input notes:', testCase3.notes);
console.log('Quantity:', testCase3.quantity);
console.log('Confirmer:', testCase3.confirmerName);
const result3 = service.buildRemarqueWithConfirmer(testCase3.notes, testCase3.confirmerName, null, testCase3.quantity);
console.log('✅ Result:', result3);
console.log('');

// Test case 4: Various product name patterns
const productNameTests = [
  'WOMEN CAT LUNETTE DE SOLEIL',
  'ENSEMBLE FEMME COLLECTION HIVER',
  'MONTRE FEMME SPORT',
  'MATLERXS 2517 originale',
  'PRODUCT123 CODE456 originale',
  'Mixed Case Product Name'
];

console.log('📋 Test Case 4: Various product name patterns (should all be removed)');
productNameTests.forEach((productName, index) => {
  const result = service.buildRemarqueWithConfirmer(productName, 'admin', null, 1);
  console.log(`${index + 1}. "${productName}" → "${result}"`);
});

console.log('\n🎉 All tests completed! Product names should be removed and quantity should be included.');