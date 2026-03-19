// MongoDB JSON Schema for tags collection
var tagSchema = {
  bsonType: "object",
  required: ["name", "isSystem"],
  properties: {
    _id: { bsonType: "objectId" },
    name: { bsonType: "string" },
    imageUrl: { bsonType: "string" },
    isSystem: { bsonType: "bool" },
    createdBy: { bsonType: "objectId" },
    createdAt: { bsonType: "date" }
  }
};

