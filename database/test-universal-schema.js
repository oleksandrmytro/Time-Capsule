// Universal schema that works in both Mongoose (Node.js) and mongosh (MongoDB shell)

// Schema definition in a universal format
const userSchemaDefinition = {
  // Fields with their types and constraints
  login: { 
    type: "string", 
    required: true,
    mongooseType: String 
  },
  email: { 
    type: "string", 
    required: true,
    mongooseType: String 
  },
  passwordHash: { 
    type: "string", 
    required: true,
    mongooseType: String 
  },
  role: { 
    type: "string", 
    enum: ["admin", "regular"],
    default: "regular",
    mongooseType: String 
  },
  isActive: { 
    type: "boolean", 
    default: true,
    mongooseType: Boolean 
  },
  isOnline: { 
    type: "boolean", 
    default: false,
    mongooseType: Boolean 
  },
  authProviders: {
    type: "array",
    items: {
      type: "object",
      required: ["provider", "providerId"],
      properties: {
        provider: { type: "string", mongooseType: String },
        providerId: { type: "string", mongooseType: String }
      }
    },
    mongooseType: [{
      provider: { type: String, required: true },
      providerId: { type: String, required: true }
    }]
  },
  createdAt: { 
    type: "date", 
    default: "Date.now",
    mongooseType: Date 
  }
};

// For Mongoose (Node.js environment)
if (typeof require !== 'undefined') {
  const mongoose = require('mongoose');
  
  // Convert universal schema to Mongoose schema
  const mongooseSchemaObject = {};
  
  function convertToMongoose(fieldDef) {
    if (fieldDef.mongooseType) {
      const result = { type: fieldDef.mongooseType };
      if (fieldDef.required) result.required = true;
      if (fieldDef.enum) result.enum = fieldDef.enum;
      if (fieldDef.default && fieldDef.default !== "Date.now") result.default = fieldDef.default;
      if (fieldDef.default === "Date.now") result.default = Date.now;
      return result;
    }
    return fieldDef.mongooseType || fieldDef;
  }
  
  Object.entries(userSchemaDefinition).forEach(([key, fieldDef]) => {
    mongooseSchemaObject[key] = convertToMongoose(fieldDef);
  });
  
  const userSchema = new mongoose.Schema(mongooseSchemaObject);
  module.exports = mongoose.model('User', userSchema);
}

// For mongosh (MongoDB shell environment)  
if (typeof db !== 'undefined') {
  // Convert universal schema to MongoDB JSON Schema
  function convertToMongoSchema(schemaDef) {
    const required = [];
    const properties = { _id: { bsonType: "objectId" } };
    
    Object.entries(schemaDef).forEach(([key, fieldDef]) => {
      if (fieldDef.required) required.push(key);
      
      if (fieldDef.type === "array") {
        properties[key] = {
          bsonType: "array",
          items: fieldDef.items.type === "object" ? {
            bsonType: "object",
            required: fieldDef.items.required || [],
            properties: {}
          } : { bsonType: fieldDef.items.type }
        };
        
        if (fieldDef.items.properties) {
          Object.entries(fieldDef.items.properties).forEach(([subKey, subFieldDef]) => {
            properties[key].items.properties[subKey] = { 
              bsonType: subFieldDef.type === "string" ? "string" : subFieldDef.type 
            };
          });
        }
      } else {
        const bsonType = fieldDef.type === "string" ? "string" : 
                         fieldDef.type === "boolean" ? "bool" :
                         fieldDef.type === "date" ? "date" : fieldDef.type;
        
        properties[key] = { bsonType };
        if (fieldDef.enum) properties[key].enum = fieldDef.enum;
      }
    });
    
    return {
      bsonType: "object",
      required,
      properties
    };
  }
  
  var userMongoSchema = convertToMongoSchema(userSchemaDefinition);
}
