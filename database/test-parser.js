// Production-ready test for Mongoose schema parser
const fs = require('fs');
const path = require('path');

// Import the enhanced parser functions from init_schemas.js
// Since we can't directly import from MongoDB shell script, we'll copy the functions

// Production-ready Mongoose schema field parser with full nested object and array support
function parseSchemaFields(schemaString) {
  const fields = {};
  let i = 0;
  
  // Remove outer braces if present
  schemaString = schemaString.trim();
  if (schemaString.startsWith('{') && schemaString.endsWith('}')) {
    schemaString = schemaString.slice(1, -1);
  }
  
  while (i < schemaString.length) {
    // Skip whitespace
    while (i < schemaString.length && /\s/.test(schemaString[i])) {
      i++;
    }
    
    if (i >= schemaString.length) break;
    
    // Extract field name
    let fieldName = '';
    if (schemaString[i] === '"' || schemaString[i] === "'") {
      const quote = schemaString[i];
      i++; // Skip opening quote
      while (i < schemaString.length && schemaString[i] !== quote) {
        fieldName += schemaString[i];
        i++;
      }
      i++; // Skip closing quote
    } else {
      while (i < schemaString.length && /[a-zA-Z_$][a-zA-Z0-9_$]*/.test(schemaString[i])) {
        fieldName += schemaString[i];
        i++;
      }
    }
    
    if (!fieldName) break;
    
    // Skip whitespace and colon
    while (i < schemaString.length && (/\s/.test(schemaString[i]) || schemaString[i] === ':')) {
      i++;
    }
    
    // Extract field value/definition
    const fieldValue = extractFieldValue(schemaString, i);
    i = fieldValue.nextIndex;
    
    fields[fieldName] = parseFieldDefinition(fieldValue.value, fieldName);
    
    // Skip comma and whitespace
    while (i < schemaString.length && (/\s/.test(schemaString[i]) || schemaString[i] === ',')) {
      i++;
    }
  }
  
  return fields;
}

// Extract field value (handles nested objects, arrays, functions)
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

// Parse individual field definition into MongoDB JSON Schema format
function parseFieldDefinition(fieldDefString, fieldName) {
  fieldDefString = fieldDefString.trim();
  
  // Handle direct type references (String, Number, etc.)
  if (/^(String|Number|Date|Boolean|ObjectId|mongoose\.Schema\.Types\.ObjectId)$/.test(fieldDefString)) {
    return convertTypeStringToJsonSchema(fieldDefString);
  }
  
  // Handle array definitions [Type] or [{ nested }]
  if (fieldDefString.startsWith('[') && fieldDefString.endsWith(']')) {
    const innerDef = fieldDefString.slice(1, -1).trim();
    return {
      bsonType: "array",
      items: parseFieldDefinition(innerDef, fieldName + '_item')
    };
  }
  
  // Handle object definitions with properties
  if (fieldDefString.startsWith('{') && fieldDefString.endsWith('}')) {
    // Check if it's a type definition object like { type: String, required: true }
    if (fieldDefString.includes('type:')) {
      return parseTypeDefinitionObject(fieldDefString);
    } else {
      // It's a nested schema object
      const nestedFields = parseSchemaFields(fieldDefString);
      const nestedRequired = [];
      const nestedProperties = {};
      
      Object.entries(nestedFields).forEach(([name, def]) => {
        nestedProperties[name] = def.schema;
        if (def.required) {
          nestedRequired.push(name);
        }
      });
      
      return {
        bsonType: "object",
        required: nestedRequired,
        properties: nestedProperties
      };
    }
  }
  
  // Default fallback
  return { bsonType: "string" };
}

// Parse type definition object like { type: String, required: true, enum: [...] }
function parseTypeDefinitionObject(objString) {
  const result = { bsonType: "string" };
  
  // Extract type
  const typeMatch = objString.match(/type:\s*([^,}]+)/);
  if (typeMatch) {
    const typeStr = typeMatch[1].trim();
    Object.assign(result, convertTypeStringToJsonSchema(typeStr));
  }
  
  // Extract enum
  const enumMatch = objString.match(/enum:\s*\[([^\]]+)\]/);
  if (enumMatch) {
    const enumValues = enumMatch[1]
      .split(',')
      .map(v => v.trim().replace(/['"]/g, ''))
      .filter(v => v.length > 0);
    result.enum = enumValues;
  }
  
  // Check if required
  const required = /required:\s*true/.test(objString);
  
  return { schema: result, required };
}

// Convert type string to JSON Schema format
function convertTypeStringToJsonSchema(typeString) {
  typeString = typeString.trim();
  
  switch (typeString) {
    case 'String':
      return { bsonType: "string" };
    case 'Number':
      return { bsonType: "number" };
    case 'Date':
      return { bsonType: "date" };
    case 'Boolean':
      return { bsonType: "bool" };
    case 'ObjectId':
    case 'mongoose.Schema.Types.ObjectId':
      return { bsonType: "objectId" };
    case 'Buffer':
      return { bsonType: "binData" };
    default:
      return { bsonType: "string" };
  }
}

// Main parser function
function parseMongooseSchemaFile(filePath) {
  try {
    console.log(`🔍 Parsing Mongoose schema: ${filePath}`);
    
    const content = fs.readFileSync(filePath, 'utf8');
    if (!content) {
      console.log(`❌ Empty or unreadable file: ${filePath}`);
      return null;
    }
    
    // Extract schema definition with comprehensive regex
    const schemaPatterns = [
      /const\s+(\w+Schema)\s*=\s*new\s+mongoose\.Schema\s*\(\s*(\{[\s\S]*?\})\s*(?:,\s*\{[\s\S]*?\})?\s*\)/,
      /new\s+mongoose\.Schema\s*\(\s*(\{[\s\S]*?\})\s*(?:,\s*\{[\s\S]*?\})?\s*\)/,
      /mongoose\.Schema\s*\(\s*(\{[\s\S]*?\})\s*(?:,\s*\{[\s\S]*?\})?\s*\)/
    ];
    
    let schemaDefinition = null;
    let schemaName = 'UnknownSchema';
    
    for (const pattern of schemaPatterns) {
      const match = content.match(pattern);
      if (match) {
        if (match[2]) {
          schemaDefinition = match[2];  // Schema definition is in group 2
          schemaName = match[1] || 'DetectedSchema';  // Schema name in group 1
        } else {
          schemaDefinition = match[1];  // Only schema definition found
        }
        break;
      }
    }
    
    if (!schemaDefinition) {
      console.log(`❌ No schema definition found in ${filePath}`);
      return null;
    }
    
    console.log(`📝 Found schema definition: ${schemaDefinition.substring(0, 100)}...`);
    
    // Parse the schema object string into a usable structure
    const jsonSchema = parseSchemaDefinition(schemaDefinition, filePath);
    
    if (jsonSchema) {
      console.log(`✅ Successfully parsed schema: ${schemaName}`);
      return jsonSchema;
    } else {
      console.log(`❌ Failed to parse schema definition in ${filePath}`);
      return null;
    }
    
  } catch (error) {
    console.log(`❌ Error parsing ${filePath}: ${error.message}`);
    return null;
  }
}

// Parse schema definition string into MongoDB JSON Schema
function parseSchemaDefinition(schemaDefString, filePath) {
  try {
    const jsonSchema = {
      bsonType: "object",
      required: [],
      properties: {
        _id: { bsonType: "objectId" }
      }
    };
    
    // Clean up the schema string
    const cleanedSchema = schemaDefString
      .replace(/\s+/g, ' ')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    
    console.log(`📝 Parsing cleaned schema: ${cleanedSchema.substring(0, 150)}...`);
    
    // Parse fields
    const fields = parseSchemaFields(cleanedSchema);
    
    // Convert fields to JSON Schema format
    Object.entries(fields).forEach(([fieldName, fieldDef]) => {
      if (fieldName === '_id') return; // Skip _id, already handled
      
      if (fieldDef.required) {
        jsonSchema.required.push(fieldName);
      }
      
      jsonSchema.properties[fieldName] = fieldDef.schema || fieldDef;
    });
    
    console.log(`📋 Parsed ${Object.keys(fields).length} fields, ${jsonSchema.required.length} required`);
    
    return jsonSchema;
    
  } catch (error) {
    console.log(`❌ Error parsing schema definition: ${error.message}`);
    console.log(`🔍 Schema string was: ${schemaDefString.substring(0, 200)}...`);
    return null;
  }
}

// Test the parser with all schemas
async function testParser() {
  console.log('🚀 Testing Production-Ready Mongoose Schema Parser\n');
  
  const schemasDir = path.join(__dirname, 'schemas');
  const schemaFiles = fs.readdirSync(schemasDir).filter(file => file.endsWith('.js'));
  
  console.log(`📁 Found ${schemaFiles.length} schema files\n`);
  
  for (const file of schemaFiles) {
    const filePath = path.join(schemasDir, file);
    const collectionName = path.basename(file, '.js').toLowerCase();
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📋 Testing: ${file} -> ${collectionName} collection`);
    console.log(`${'='.repeat(60)}`);
    
    const result = parseMongooseSchemaFile(filePath);
    
    if (result) {
      console.log('\n✅ Parsing Result:');
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('\n❌ Parsing failed - will use fallback schema');
    }
  }
  
  console.log('\n🎉 Parser testing completed!');
}

// Run the test
testParser().catch(console.error);
