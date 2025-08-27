const fs = require('fs');
const path = require('path');

console.log('🔍 Checking for common JSX/JavaScript syntax errors...');

const filePath = '../src/pages/OrderManagement/OrderManagement.jsx';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// Check for common syntax issues
let issues = [];

// 1. Check for mismatched brackets
let openBraces = 0;
let openParens = 0;
let openBrackets = 0;

// 2. Check for missing semicolons after function declarations
// 3. Check for missing commas in object literals
// 4. Check for unclosed JSX tags

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const lineNum = i + 1;
  
  // Count brackets
  for (let char of line) {
    if (char === '{') openBraces++;
    if (char === '}') openBraces--;
    if (char === '(') openParens++;
    if (char === ')') openParens--;
    if (char === '[') openBrackets++;
    if (char === ']') openBrackets--;
  }
  
  // Check for specific problematic patterns
  if (line.includes('handleBaladiaChange') && !line.includes('//')) {
    console.log(`📍 Line ${lineNum}: ${line.trim()}`);
  }
  
  if (line.includes('placeholder={t("delivery.selectBaladia")}')) {
    issues.push(`Line ${lineNum}: Translation key "delivery.selectBaladia" might not exist`);
  }
  
  // Check for missing commas in objects
  if (line.trim().match(/^[a-zA-Z_$][a-zA-Z0-9_$]*:\s*.*[^,]$/) && 
      i < lines.length - 1 && 
      lines[i + 1].trim().match(/^[a-zA-Z_$]/)) {
    issues.push(`Line ${lineNum}: Possible missing comma after object property`);
  }
}

console.log(`\n📊 Bracket counts at end of file:`);
console.log(`  Open braces: ${openBraces}`);
console.log(`  Open parentheses: ${openParens}`);
console.log(`  Open brackets: ${openBrackets}`);

if (issues.length > 0) {
  console.log(`\n❌ Potential issues found:`);
  issues.forEach(issue => console.log(`  - ${issue}`));
} else {
  console.log(`\n✅ No obvious syntax issues detected`);
}

console.log(`\n💡 If issues persist, try:`);
console.log(`  1. Check VS Code for red squiggly lines`);
console.log(`  2. Look for missing commas in function calls`);
console.log(`  3. Verify all brackets match properly`);
