const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion } = require('mongodb');

// mongoDB Connection 
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.oyyjehq.mongodb.net/?appName=Cluster0`;

// middleWare
app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
  res.send("lets begin");
});

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
async function run() {
  try {
    await client.connect();
    const db = client.db("servicesdb");
    const servicesCollection = db.collection("services");
    const decoratorsCollection = db.collection("decorators");
    const serviceCenterCollection = db.collection("serviceCenter");

    //------------- services apis ------------
    app.get('/services' , async (req , res ) => { 
        const cursor = servicesCollection.find().sort({rating : -1}).limit(6)
        const result = await cursor.toArray()
        res.send(result)
     })


    // -------------Decorator related Apis --------------
     app.get('/decorators' , async (req , res ) => { 
        const cursor = decoratorsCollection.find().sort({rating : -1 }).limit(6)
        const result = await cursor.toArray()
        res.send(result)
      })


// ---------------service center Apis --------------
   app.get('/serviceCenter' , async (req , res ) => { 
        const cursor = serviceCenterCollection.find()
        const result = await cursor.toArray()
        res.send(result)
      })









    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
  }
}
run().catch(console.dir);






















// --------------------------------------------
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
