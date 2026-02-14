const fs = require('fs');

// Simple print replacement for Node.js testing
function print(msg) {
  console.log(msg);
}

// Test function to parse schema fields from string
function testParseSchemaFields(schemaString) {
  const fields = {};
  let i = 0;
  
  // Remove outer braces
  schemaString = schemaString.trim();
  if (schemaString.startsWith('{') && schemaString.endsWith('}')) {
    schemaString = schemaString.slice(1, -1);
  }
  
  while (i < schemaString.length) {
    // Skip whitespace
    while (i < schemaString.length && /\s/.test(schemaString[i])) i++;
    if (i >= schemaString.length) break;
    
    // Extract field name
    let fieldName = '';
    if (schemaString[i] === '"' || schemaString[i] === "'") {
      const quote = schemaString[i++];
      while (i < schemaString.length && schemaString[i] !== quote) {
        fieldName += schemaString[i++];
      }
      i++; // Skip closing quote
    } else {
      while (i < schemaString.length && /[a-zA-Z_$][a-zA-Z0-9_$]*/.test(schemaString[i])) {
        fieldName += schemaString[i++];
      }
    }
    
    if (!fieldName) break;
    
    // Skip to field value
    while (i < schemaString.length && (/\s/.test(schemaString[i]) || schemaString[i] === ':')) i++;
    
    // Extract field value
    const fieldValue = extractFieldValue(schemaString, i);
    i = fieldValue.nextIndex;
    
    fields[fieldName] = fieldValue.value;
    
    // Skip to next field
    while (i < schemaString.length && (/\s/.test(schemaString[i]) || schemaString[i] === ',')) i++;
  }
  
  return fields;
}

function extractFieldValue(str, startIndex) {
  let i = startIndex;
  let value = '';
  let braceCount = 0;
  let bracketCount = 0;
  let parenCount = 0;
  let inString = false;
  let stringChar = null;
  
  while (i < str.length) {
    const char = str[i];
    
    if (!inString) {
      if (char === '"' || char === "'") {
        inString = true;
        stringChar = char;
      } else if (char === '{') {
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount < 0) break;
      } else if (char === '[') {
        bracketCount++;
      } else if (char === ']') {
        bracketCount--;
      } else if (char === '(') {
        parenCount++;
      } else if (char === ')') {
        parenCount--;
      } else if (char === ',' && braceCount === 0 && bracketCount === 0 && parenCount === 0) {
        break;
      }
    } else {
      if (char === stringChar && (i === 0 || str[i-1] !== '\\')) {
        inString = false;
        stringChar = null;
      }
    }
    
    value += char;
    i++;
  }
  
  return { value: value.trim(), nextIndex: i };
}

// Test with User schema
try {
  const userSchemaContent = fs.readFileSync('../schemas/User.js', 'utf8');
  console.log('✅ User.js file read successfully');
  
  // Extract schema definition
  const schemaMatch = userSchemaContent.match(/const\s+\w*Schema\s*=\s*new\s+mongoose\.Schema\(\s*(\{[\s\S]*?\})\s*\)/);
  
  if (schemaMatch) {
    console.log('✅ Schema definition found');
    const schemaDefString = schemaMatch[1];
    console.log('📝 Schema definition excerpt:', schemaDefString.substring(0, 100) + '...');
    
    const fields = testParseSchemaFields(schemaDefString);
    console.log('🎯 Parsed fields:', Object.keys(fields));
    
    // Show a few field examples
    Object.entries(fields).slice(0, 3).forEach(([name, def]) => {
      console.log(`  ${name}: ${def.substring(0, 50)}${def.length > 50 ? '...' : ''}`);
    });
    
  } else {
    console.log('❌ No schema definition found');
  }
  
} catch (error) {
  console.log('❌ Error:', error.message);
}
