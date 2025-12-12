const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE);
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
    auth_provider_x509_cert_url:
      process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
    client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
  }),
});

const verifyFBToken = async (req, res, next) => {
  const token = req.headers?.authorization;
  if (!token) {
    return res.status(401).send({ message: "unauthorize access" });
  }

  try {
    const idToken = token.split(" ")[1];
    const decoded = await admin.auth().verifyIdToken(token);
    req.decoded_email = decoded.email;
  } catch (err) {
    return res.status(401).send({ message: "unauthorize access" });
  }

  next();
};

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
    const paymentCollection = db.collection("payments");

    //------------------ users related apis --------------
    app.get("/users/:email/role", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      res.send({ role: user?.role || "user" });
    });
    app.get("/users", async (req, res) => {
      const query = { role: "user" };
      const users = await usersCollection.find(query).toArray();
      res.send(users);
    });
    app.post("/users", async (req, res) => {
      const user = req.body;
      const email = user.email;
      user.role = "user";
      user.createAt = new Date();

      const userExist = await usersCollection.findOne({ email });
      if (userExist) {
        return res.send({ message: "user exist" });
      }

      const result = usersCollection.insertOne(user);
      res.send(result);
    });
    app.patch("/users/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: { role: "decorator" },
      };

      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });



    //------------- services apis ------------
    app.get("/services", async (req, res) => {
      const cursor = servicesCollection
        .find()
        .project({ description: 0 })
        .sort({ rating: -1 })
        .limit(6);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/allServices", async (req, res) => {
      let { search, type, minPrice, maxPrice, page, limit } = req.query;

      page = parseInt(page) || 1;
      limit = parseInt(limit) || 20;
      const skip = (page - 1) * limit;

      const query = {};

      if (search) query.name = { $regex: search, $options: "i" };
      if (type && type !== "All")
        query.type = { $regex: `^${type}$`, $options: "i" };
      if (minPrice) query.price = { ...query.price, $gte: parseInt(minPrice) };
      if (maxPrice) query.price = { ...query.price, $lte: parseInt(maxPrice) };

      const total = await servicesCollection.countDocuments(query);

      const result = await servicesCollection
        .find(query)
        .skip(skip)
        .limit(limit)
        .toArray();

      res.send({ result, total });
    });

    app.get("/servicesDetails/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await servicesCollection.findOne(query);
      res.send(result);
    });

    app.post("/newServices", async (req, res) => {
      const newService = req.body;
      newService.createAt = new Date();
      const result = await servicesCollection.insertOne(newService);
      res.send(result);
    });

    app.patch("/servicesDetails/:id", async (req, res) => {
      const id = req.params.id;
      const updateInfo = req.body;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          ...updateInfo,
          updatedAt: new Date(),
        },
      };
      const result = await servicesCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    app.delete("/deleteService/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await servicesCollection.deleteOne(query);
      res.send(result);
    });









    // -------------Decorator related Apis --------------
    app.get("/topDecorators", async (req, res) => {
      const cursor = decoratorsCollection.find().sort({ rating: -1 }).limit(6);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/allDecorators", async (req, res) => {
      let { page, limit } = req.query;
      page = parseInt(page) || 1;
      limit = parseInt(limit) || 20;
      const skip = (page - 1) * limit;
      try {
        const total = await decoratorsCollection.countDocuments();
        const result = await decoratorsCollection
          .find()
          .sort({ createAt: -1 })
          .skip(skip)
          .limit(limit)
          .toArray();
        res.send({ result, total });
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server error" });
      }
    });

    app.get("/assignDecorators", async (req, res) => {
      const { status, district } = req.query;
      const query = {};
      if (status) {
        query.status = status;
      }
      if (district) {
        query.district = district;
      }
      const cursor = decoratorsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.post("/decorators", async (req, res) => {
      const decorator = req.body; 
      const result = await decoratorsCollection.insertOne(decorator);
      res.send(result);
    });


    app.delete("/deleteDecorators/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await decoratorsCollection.deleteOne(query);
      res.send(result);
    });








    // booking Related Apis

    app.get("/allBooking", async (req, res) => {
      let { page, limit } = req.query;
      page = parseInt(page) || 1;
      limit = parseInt(limit) || 20;

      const skip = (page - 1) * limit;

      try {
        const total = await bookingCollection.countDocuments();
        const result = await bookingCollection
          .find()
          .sort({ createAt: -1 })
          .skip(skip)
          .limit(limit)
          .toArray();
        res.send({ result, total });
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server error" });
      }
    });

    app.get("/booking", async (req, res) => {
      const email = req.query.email;
      const query = {};
      if (email) {
        query.userEmail = email;
      }
      const cursor = await bookingCollection
        .find(query)
        .sort({ createAt: -1 })
        .toArray();
      res.send(cursor);
    });

    app.post("/booking", async (req, res) => {
      const book = req.body;
      book.createAt = new Date();
      book.decoratorStatus = "Not Assign";
      const result = await bookingCollection.insertOne(book);
      res.send(result);
    });

    app.patch("/booking/:id", async (req, res) => {
      const id = req.params.id;
      const { updateInfo } = req.body;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          ...updateInfo,
          updatedAt: new Date(),
        },
      };
      const result = await bookingCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    app.patch("/afterAssign/:id", async (req, res) => {
      const id = req.params.id;
      const { decoratorName, decoratorEmail, decoratorId, serviceId ,bookingRegion ,bookingDistrict } =
        req.body;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          decoratorName: decoratorName,
          decoratorEmail: decoratorEmail,
          decoratorId: decoratorId,
          decoratorStatus: "decorator Assigned",
          bookingRegion : bookingRegion,
          bookingDistrict : bookingDistrict,
        },
      };
      const result = await bookingCollection.updateOne(query, updateDoc);

      const decoratorQuery = { _id: new ObjectId(decoratorId) };
      const updateDecoratorsDoc = {
        $set: {
          serviceId: serviceId,
          status: "On Service",
        },
      };
      const decoratorResult = await decoratorsCollection.updateOne(
        decoratorQuery,
        updateDecoratorsDoc
      );
      res.send(result , decoratorResult);
    });

    app.delete("/booking/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingCollection.deleteOne(query);
      res.send(result);
    });

    



    // payment related apis-------------
    app.get("/payment-history", async (req, res) => {
      const email = req.query.email;
      const query = {};
      if (email) {
        query.userEmail = email;
      }
      const result = await paymentCollection
        .find(query)
        .sort({ paidAt: -1 })
        .toArray();
      res.send(result);
    });
    app.post("/create-checkout-session", async (req, res) => {
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
          },
        ],
        customer_email: paymentInfo.userEmail,
        metadata: {
          userId: paymentInfo.userId,
          userName: paymentInfo.userName,
          serviceName: paymentInfo.serviceName,
        },
        mode: "payment",
        success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-history?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.SITE_DOMAIN}/dashboard/my-bookings`,
      });
      res.send({ url: session.url });
    });

    app.patch("/payment-success", async (req, res) => {
      try {
        const sessionId = req.query.session_id;
        if (!sessionId)
          return res
            .status(400)
            .send({ success: false, message: "Session ID missing" });

        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (session.payment_status !== "paid") {
          return res.send({ success: false, message: "Payment not completed" });
        }

        const existingPayment = await paymentCollection.findOne({
          transactionId: session.payment_intent,
          userId: session.metadata.userId,
        });

        if (existingPayment) {
          return res.send({
            success: true,
            message: "Payment already recorded",
            payment: existingPayment,
          });
        }

        const bookingId = session.metadata.userId;
        const query = { _id: new ObjectId(bookingId) };
        const update = {
          $set: {
            paymentStatus: "paid",
            bookingStatus: "Confirmed",
            decoratorStatus: "Assign Pending",
            paymentAt: new Date(),
          },
        };
        const result = await bookingCollection.updateOne(query, update);

        const payment = {
          amount: session.amount_total / 100,
          currency: session.currency,
          userEmail: session.customer_email,
          userId: session.metadata.userId,
          userName: session.metadata.userName,
          serviceName: session.metadata.serviceName,
          transactionId: session.payment_intent,
          paymentStatus: session.payment_status,
          paidAt: new Date(),
        };
        const paymentResult = await paymentCollection.insertOne(payment);

        return res.send({
          success: true,
          message: "Payment recorded successfully",
          bookingUpdate: result,
          payment: paymentResult,
        });
      } catch (error) {
        console.log("Payment Error:", error);
        return res.status(500).send({ success: false, error: error.message });
      }
    });

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
