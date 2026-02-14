// MongoDB JSON Schema for mongosh - geo markers (MVP)
var geoMarkerSchema = {
  bsonType: "object",
  required: ["capsuleId", "location"],
  properties: {
    _id: { bsonType: "objectId" },
    capsuleId: { bsonType: "objectId" },
    location: {
      bsonType: "object",
      required: ["type", "coordinates"],
      properties: {
        type: { enum: ["Point"] },
        coordinates: {
          bsonType: "array",
          items: { bsonType: "double" },
          minItems: 2,
          maxItems: 2
        }
      }
    },
    radiusMeters: { bsonType: "double" },
    visibility: { enum: ["public", "owner", "shared"] },
    createdAt: { bsonType: "date" },
    updatedAt: { bsonType: "date" },
    deletedAt: { bsonType: "date" }
  }
};

