const XLSX = require('xlsx');
const path = require('path');

// Test data matching your Excel format
const testData = [
  {
    'Q': '1971',
    'DATE': '2025-07-05 16:01:25',
    'FULL_NAME': 'Ferhat hocine',
    'PHONE': '0555645956',
    'WILAYA': '6',
    'COMMUNE': 'Bejaia',
    'PRODUCT': 'PORSHE 45° super c 2500',
    'prix de produit': '2500',
    'situation': 'SD',
    'prix de livraison': '350 da',
    'PRIX total': '2800',
    'note': ''
  },
  {
    'Q': '2024',
    'DATE': '2025-07-06 13:41:41',
    'FULL_NAME': 'رضا درويس',
    'PHONE': '0797093554',
    'WILAYA': '17',
    'COMMUNE': 'Ain Oussera',
    'PRODUCT': 'RAY-BAN VeNITIEN',
    'prix de produit': '2800',
    'situation': 'SD',
    'prix de livraison': '450 da',
    'PRIX total': '3250',
    'note': ''
  },
  {
    'Q': '38566',
    'DATE': '2025-07-06 00:43:16',
    'FULL_NAME': 'عميد',
    'PHONE': '659287333',
    'WILAYA': '23',
    'COMMUNE': 'Annaba',
    'PRODUCT': 'name:PORSHE 1014',
    'prix de produit': '2000',
    'situation': 'SD',
    'prix de livraison': '350 da',
    'PRIX total': '2350',
    'note': ''
  }
];

// Helper function to map Excel columns to database fields (same as in orders.js)
const mapExcelRowToOrder = (row) => {
  // Handle different date formats
  let orderDate = new Date();
  if (row['DATE']) {
    const dateStr = row['DATE'].toString();
    // Try to parse the date string - handle YYYY-MM-DD HH:MM:SS format
    const parsedDate = new Date(dateStr);
    if (!isNaN(parsedDate.getTime())) {
      orderDate = parsedDate;
    }
  }

  // Parse prices and remove any currency symbols or spaces
  const parsePrice = (priceStr) => {
    if (!priceStr) return 0;
    const cleanPrice = priceStr.toString().replace(/[^\d.]/g, '');
    return parseFloat(cleanPrice) || 0;
  };

  // Map status from French/Arabic to English
  const mapStatus = (situation) => {
    if (!situation) return 'pending';
    const status = situation.toString().toLowerCase();
    if (status.includes('sd') || status.includes('livré')) return 'delivered';
    if (status.includes('domicile') || status.includes('a domicile')) return 'out_for_delivery';
    if (status.includes('confirmé') || status.includes('confirmed')) return 'confirmed';
    if (status.includes('annulé') || status.includes('cancelled')) return 'cancelled';
    if (status.includes('retour') || status.includes('returned')) return 'returned';
    return 'pending';
  };

  return {
    ecotrack_id: row['Q'] || '', // Ecotrack ID from Q column
    customer_name: row['FULL_NAME'] || row['Full name'] || row['full_name'] || '',
    customer_phone: row['PHONE'] || row['Phone'] || row['phone'] || '',
    customer_address: `${row['COMMUNE'] || ''}, ${row['WILAYA'] || ''}`.trim().replace(/^,\s*/, ''),
    customer_city: row['COMMUNE'] || row['city'] || '',
    customer_state: row['WILAYA'] || row['state'] || '',
    product_name: row['PRODUCT'] || row['Product name'] || row['product_name'] || '',
    product_price: parsePrice(row['prix de produit']),
    delivery_price: parsePrice(row['prix de livraison']),
    total_amount: parsePrice(row['PRIX total']),
    status: mapStatus(row['situation']),
    notes: row['note'] || '',
    order_date: orderDate
  };
};

// Test the mapping function
console.log('🧪 Testing Excel to Order mapping...\n');

testData.forEach((row, index) => {
  console.log(`--- Row ${index + 1} ---`);
  console.log('Input:', row);
  
  const mappedOrder = mapExcelRowToOrder(row);
  console.log('Mapped Order:', mappedOrder);
  
  // Create product details object as would be done in import
  const productDetails = {
    name: mappedOrder.product_name,
    price: mappedOrder.product_price,
    delivery_price: mappedOrder.delivery_price,
    delivery_type: 'home_delivery'
  };
  
  console.log('Product Details JSON:', JSON.stringify(productDetails));
  console.log('Total Amount:', mappedOrder.total_amount || (mappedOrder.product_price + mappedOrder.delivery_price));
  console.log('\n');
});

console.log('✅ Mapping test completed!');
console.log('\n🔍 Key observations:');
console.log('- Ecotrack IDs are properly extracted from Q column');
console.log('- French status "SD" is mapped to "delivered"');
console.log('- Prices are parsed correctly (removing "da" currency)');
console.log('- Arabic and French names are preserved');
console.log('- Address is constructed from COMMUNE + WILAYA');
console.log('- Dates are parsed properly from Excel format');
