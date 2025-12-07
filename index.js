const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// mongoDB Connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.oyyjehq.mongodb.net/?appName=Cluster0`;

// middleWare
app.use(express.json());
app.use(cors());


const admin = require("firebase-admin");

const serviceAccount = require("./styledecor-x11-firebase-adminsdk.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


const verifyFBToken = async (req , res , next) => { 
  const token = req.headers?.authorization
  if(!token) {
    return res.status(401).send({message : 'unauthorize access'})
    
  }

  try{
    const idToken = token.split(' ')[1]
    const decoded = await admin.auth().verifyIdToken(token)
    req.decoded_email = decoded.email
  }
  catch(err){
    return res.status(401).send({message : 'unauthorize access'})
  }
 
  next()
 }



app.get("/", (req, res) => {
  res.send("lets begin");
});

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    await client.connect();
    const db = client.db("servicesdb");
    const servicesCollection = db.collection("services");
    const decoratorsCollection = db.collection("decorators");
    const serviceCenterCollection = db.collection("serviceCenter");
    const bookingCollection = db.collection("bookings");

    //------------- services apis ------------
    app.get("/services", async (req, res) => {
      const cursor = servicesCollection.find().sort({ rating: -1 }).limit(6);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/allServices", async (req, res) => {
      const {
        search = "",
        type = "",
        minPrice = 0,
        maxPrice = 500000,
      } = req.query;

      const query = {};

      if (search) {
        query.name = { $regex: search, $options: "i" };
      }
      if (type && type !== "All") {
        query.type = { $regex: type, $options: "i" }
      }
      query.price = { $gte: +minPrice, $lte: +maxPrice };

      const result = await servicesCollection
        .find(query)
        .sort({ price: 1 })
        .limit(10)
        .toArray();
      res.send(result);
    });

      app.get("/servicesDetails/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await servicesCollection.findOne(query)
      res.send(result);
    });


    
    // -------------Decorator related Apis --------------
    app.get("/decorators", async (req, res) => {
      const cursor = decoratorsCollection.find().sort({ rating: -1 }).limit(6);
      const result = await cursor.toArray();
      res.send(result);
    });



    // booking Related Apis
    app.post('/booking' , async (req , res ) => { 
          const book = req.body;
          book.createAt = new Date()
          const result = await bookingCollection.insertOne(book)
          res.send(result)
     })


    
    // ---------------service center Apis --------------
    app.get("/serviceCenter", async (req, res) => {
      const cursor = serviceCenterCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

// --------------------------------------------
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
