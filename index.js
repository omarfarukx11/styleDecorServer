const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE);

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.oyyjehq.mongodb.net/?appName=Cluster0`;

// middleWare
app.use(express.json());
app.use(cors());

var admin = require("firebase-admin");

const decoded = Buffer.from(process.env.FB_SERVICE_KEY, "base64").toString(
  "utf8"
);
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const verifyFBToken = async (req, res, next) => {
  const token = req.headers?.authorization;
  console.log(req.headers);
  if (!token) {
    return res.status(401).send({ message: "unauthorize access" });
  }

  try {
    const idToken = token.split(" ")[1];
    const decoded = await admin.auth().verifyIdToken(idToken);

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
    const db = client.db("servicesdb");
    const usersCollection = db.collection("users");
    const servicesCollection = db.collection("services");
    const decoratorsCollection = db.collection("decorators");
    const serviceCenterCollection = db.collection("serviceCenter");
    const bookingCollection = db.collection("bookings");
    const paymentCollection = db.collection("payments");
    const earningCollection = db.collection("earning");

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded_email;
      const query = { email };
      const user = await usersCollection.findOne(query);

      if (!user || user.role !== "admin") {
        return res.status(403), send({ message: "forbidden access" });
      }
      next();
    };

    const verifyDecorator = async (req, res, next) => {
      const email = req.decoded_email;
      const query = { email };
      const user = await usersCollection.findOne(query);

      if (!user || user.role !== "decorator") {
        return res.status(403).send({ message: "forbidden access" });
      }

      next();
    };

    //------------------ users related apis --------------
    app.get("/users/:email/role", verifyFBToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded_email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      const query = { email };
      const user = await usersCollection.findOne(query);
      res.send({ role: user?.role || "user" });
    });

    app.get("/user/:email", verifyFBToken, async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      res.send(user);
    });
    app.get("/users", verifyFBToken, async (req, res) => {
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

    app.patch("/users/:id", verifyFBToken, async (req, res) => {
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
    app.get("/allServices",  async (req, res) => {
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

    app.post("/newServices", verifyFBToken, verifyAdmin, async (req, res) => {
      const newService = req.body;
      newService.createAt = new Date();
      const result = await servicesCollection.insertOne(newService);
      res.send(result);
    });

    app.patch("/servicesDetails/:id", verifyFBToken, verifyAdmin, async (req, res) => {
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

    app.delete("/deleteService/:id", verifyFBToken, verifyAdmin, async (req, res) => {
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

    app.get("/allDecorators", verifyFBToken, verifyAdmin, async (req, res) => {
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
    app.get("/assignDecorators", verifyFBToken, verifyAdmin, async (req, res) => {
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
    app.get("/decorator/:email", verifyFBToken, verifyDecorator,  async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await decoratorsCollection.findOne(query);
      res.send(user);
    });

    app.post("/newDecorators", verifyFBToken, verifyAdmin,  async (req, res) => {
      const decorator = req.body;
      decorator.createAt = new Date();
      const result = await decoratorsCollection.insertOne(decorator);
      res.send(result);
    });

    app.patch("/updateDecoratorsWorkStatus/:id", verifyFBToken, verifyDecorator,
      async (req, res) => {
        const id = req.params.id;
        const { status } = req.body;
        const query = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            status: status,
          },
        };

        const result = await decoratorsCollection.updateOne(query, updateDoc);
        res.send(result);
      }
    );

    app.delete("/deleteDecorators/:id", verifyFBToken , verifyAdmin, async (req, res) => {
    try {
      const id = req.params.id;
      const decorator = await decoratorsCollection.findOne({ _id: new ObjectId(id) });

      if (!decorator) {
        return res.status(404).send({ message: "Decorator not found" });
      }
      const deleteResult = await decoratorsCollection.deleteOne({ _id: new ObjectId(id) });
      if (deleteResult.deletedCount > 0 && decorator.email) {
        const userUpdateResult = await usersCollection.updateOne(
          { email: decorator.email },
          { $set: { role: "user" } }
        );
        console.log("User patch result:", userUpdateResult);
      }
      res.send({ deleted: deleteResult.deletedCount > 0 });
    } catch (err) {
      console.error(err);
      res.status(500).send({ message: "Internal Server Error" });
    }
  });




    //// ----------------decorator earning api
    app.get(
      "/decorator-earnings/:email",
      verifyFBToken,
      verifyDecorator,
      async (req, res) => {
        const email = req.params.email;
        const query = {};
        if (email) {
          query.decoratorEmail = email;
        }
        const earnings = await earningCollection.find(query).toArray();
        res.send(earnings);
      }
    );




    // booking Related Apis
    app.get("/allBooking", verifyFBToken, verifyAdmin, async (req, res) => {
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

    app.get("/booking", verifyFBToken, async (req, res) => {
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

    app.get(
      "/booking/:email",
      verifyFBToken,
      verifyDecorator,
      async (req, res) => {
        const email = req.params.email;
        const query = { decoratorEmail: email };

        const bookings = await bookingCollection
          .find(query)
          .sort({ assignAt: 1 })
          .toArray();
        res.send(bookings);
      }
    );

    app.post("/booking", verifyFBToken, async (req, res) => {
      const book = req.body;
      book.createAt = new Date();
      book.decoratorStatus = "Assign Pending";
      const result = await bookingCollection.insertOne(book);
      res.send(result);
    });

    app.patch("/booking/:id", verifyFBToken, async (req, res) => {
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

    app.patch(
      "/afterAssign/:id",
      verifyFBToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const {
          decoratorName,
          decoratorEmail,
          decoratorId,
          serviceId,
          bookingRegion,
          bookingDistrict,
          decoratorID,
        } = req.body;
        const query = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            decoratorName: decoratorName,
            decoratorEmail: decoratorEmail,
            decoratorId: decoratorId,
            decoratorStatus: "decorator Assigned",
            bookingRegion: bookingRegion,
            bookingDistrict: bookingDistrict,
            assignAt: new Date(),
          },
        };

        const result = await bookingCollection.updateOne(query, updateDoc);
        res.send(result);
        const decoratorQuery = { _id: new ObjectId(decoratorID) };
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
        res.send(decoratorResult);
      }
    );

    app.patch("/booking/:id/status",
      verifyFBToken,
      verifyDecorator,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };

        const booking = await bookingCollection.findOne(query);

        const updateDoc = {
          $set: {
            decoratorStatus: req.body.decoratorStatus,
          },
        };

        const result = await bookingCollection.updateOne(query, updateDoc);

        if (req.body.decoratorStatus === "completed") {
          const percent = 0.3;
          const earningAmount = booking.serviceCost * percent;
          await earningCollection.insertOne({
            decoratorEmail: booking.decoratorEmail,
            amount: earningAmount,
            serviceName: booking.serviceName,
            clientEmail: booking.userEmail,
            bookingId: booking._id,
            date: new Date(),
          });
        }

        res.send(result);
      }
    );

    app.delete("/booking/:id", verifyFBToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingCollection.deleteOne(query);
      res.send(result);
    });
  


    // payment related apis-------------
    app.get("/payment-history", verifyFBToken, async (req, res) => {
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

    app.get("/all-payment-history", verifyFBToken , verifyDecorator, async (req, res) => {
      const result = await paymentCollection.find().toArray();
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


    app.patch("/payment-success", verifyFBToken, async (req, res) => {
      try {
        const sessionId = req.query.session_id;
        if (!sessionId) {
          return res
            .status(400)
            .send({ success: false, message: "Session ID missing" });
        }

        const session = await stripe.checkout.sessions.retrieve(sessionId);

        let bookingUpdate = null;
        let paymentResult = null;

        if (session.payment_status === "paid") {
          const existingPayment = await paymentCollection.findOne({
            transactionId: session.payment_intent,
          });

          if (existingPayment) {
            return res.send({
              success: true,
              message: "Payment already recorded",
              bookingUpdate: null,
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

          bookingUpdate = await bookingCollection.updateOne(query, update);

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

          paymentResult = await paymentCollection.insertOne(payment);
        }

        return res.send({
          success: true,
          message: "Payment processed",
          bookingUpdate,
          payment: paymentResult,
        });
      } catch (error) {
        console.error("Payment Error:", error);
        return res.status(500).send({ success: false, error: error.message });
      }
    });

    // ---------------service center Apis --------------
    app.get("/serviceCenter", async (req, res) => {
      const cursor = serviceCenterCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });
  } finally {
  }
}
run().catch(console.dir);

// --------------------------------------------
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
