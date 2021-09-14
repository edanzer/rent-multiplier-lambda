'use strict';

const { MongoClient } = require("mongodb");
const AWS = require('aws-sdk');

let cachedDb = null;

/*
 * Instantiate Secrets Manager
 */
const sm = new AWS.SecretsManager({
  region: "us-east-1"
});

/* 
 * Generic method for retrieving secrets from Secret Manager
 */
const getSecrets = async (SecretId) => {
  return await new Promise((resolve, reject) => {
    sm.getSecretValue( { SecretId }, (err, result) => {
      if(err) reject(err); 
      if(result) resolve(JSON.parse(result.SecretString));
    });
  });
}

/* 
 * Fetch MongoDB credentials, specifically
 */
const getMongoCredentials = async (event) => {
  const { mongoUri, mongoUser, mongoPass } = await getSecrets('mongoCredentials');
  return [ mongoUri, mongoUser, mongoPass ];
}

/*
 * Core function for connecting to database
 */
async function connectToDatabase() {
  
  // If already connected, return 
  if (cachedDb) {
    return cachedDb;
  }

  // Connect
  const [ mongoUri, mongoUser, mongoPass ] = await getMongoCredentials();
  const uri = `mongodb+srv://${mongoUser}:${mongoPass}${mongoUri}`;
  const client = new MongoClient(uri);
  await client.connect();
 
  // Select database, cache, and return
  const db = await client.db("data");
  cachedDb = db;
  return db;

}

/* 
 * Retrieve home value and rental data from database
 */
const retrievePrices = async() => {
  const db = await connectToDatabase();

  const prices = db.collection("prices");
  const all = await prices.find().toArray();

  return all;
}

/*
 * Main Lambda handler function
 */
module.exports.getData = async (event) => {
  const data = await retrievePrices();

  return {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin" : "*", // Required for CORS support to work
      "Access-Control-Allow-Credentials" : true // Required for cookies, authorization headers with HTTPS
    },
    body: JSON.stringify(
      data,
      null,
      2
    ),
  };
};