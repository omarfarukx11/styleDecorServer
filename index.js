const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require('stripe')(process.env.STRIPE);
// mongoDB Connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.oyyjehq.mongodb.net/?appName=Cluster0`;

// middleWare
app.use(express.json());
app.use(cors());


const admin = require("firebase-admin");

admin.initializeApp({
  credential: admin.credential.cert({
    type: process.env.FIREBASE_TYPE,
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"), // important
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: process.env.FIREBASE_AUTH_URI,
    token_uri: process.env.FIREBASE_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
    client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
  }),
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
    const usersCollection = db.collection("users");
    const servicesCollection = db.collection("services");
    const decoratorsCollection = db.collection("decorators");
    const serviceCenterCollection = db.collection("serviceCenter");
    const bookingCollection = db.collection("bookings");


    //------------------ users related apis --------------
      app.get("/users/:email/role", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      res.send({ role: user?.role || "user" });
    });


    app.post('/users', async  (req , res ) => {
        const user = req.body;
        const email = user.email;
        user.role = "user"
        user.createAt = new Date()

        const userExist = await usersCollection.findOne({email})
        if(userExist) {
          return res.send({message : 'user exist'})
        }

        const result = usersCollection.insertOne(user)
        res.send(result)
    })








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

    app.get('/booking' , async (req , res ) => { 
      const email = req.query.email;
      const query = {}
      if(email) {
        query.userEmail = email
      }
      console.log(req.query)
        const cursor = await bookingCollection.find(query).toArray()
        res.send(cursor)
        
     })

    app.post('/booking' , async (req , res ) => { 
          const book = req.body;
          book.createAt = new Date()
          const result = await bookingCollection.insertOne(book)
          res.send(result)
     })

     app.patch('/booking/:id' , async (req , res) => { 
        const id = req.params.id
        const updateInfo = req.body
        const query = {_id : new ObjectId(id)}
        const updateDoc = {
      $set: {
        ...updateInfo,
        updatedAt: new Date(),
      },
    };
        const result = await bookingCollection.updateOne(query , updateDoc)
        res.send(result)
      })


    app.delete('/booking/:id' ,async (req , res ) => { 
        const id = req.params.id;
         const query = { _id: new ObjectId(id) };
        const result = await bookingCollection.deleteOne(query)
        res.send(result)
     })


    //------------- payment related apis-------------
    app.post('/create-checkout-session' , async (req , res ) => {
      const paymentInfo = req.body;
       const amount = parseInt(paymentInfo.cost) * 100;
      const session = await stripe.checkout.sessions.create({
            line_items: [
          {
             price_data: {
              currency: "USD",
              unit_amount: amount,
              product_data: {
              name: paymentInfo.serviceName,
              },
            },
            quantity: 1,
          }
        ],
        customer_email: paymentInfo.userEmail,
         metadata: {
          userId: paymentInfo.userId,
          serviceName: paymentInfo.userName,
        },
         mode: 'payment',
         success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-history?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.SITE_DOMAIN}/dashboard/my-bookings`,
      
      })
      res.send({url : session.url})
    }) 

    app.patch('/payment-success' , async (req ,res ) => { 
        const sessionId = req.query.session_id;
        const session = await stripe.checkout.sessions.retrieve(sessionId)
      if(session.payment_status === 'paid') {
        const id = session.metadata.userId
        const query = {_id : new ObjectId(id)}
        const update = {
            $set : {
              paymentStatus : 'paid',
              paymentAt : new Date()
            }
        }
        const result = await bookingCollection.updateOne(query , update)
        res.send(result)
      }
      res.send({ success : false})
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
