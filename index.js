const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// my middleware
const logger = async (req, res, next) => {
  // console.log("called", req.host, req.originalUrl);
  next();
};
const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
  // console.log("value of token : ", token);
  if (!token) {
    return res.status(401).send({ message: "not authorized" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    // error decoding
    if (err) {
      console.log(err);
      return res.status(401).send({ message: "unauthorized" });
    }
    // valid token
    req.user = decoded;
    next();
  });
};

// routes
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.girnwoz.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const servicesCollection = client.db("car-services").collection("services");
    const orderCollection = client.db("car-services").collection("orders");

    /****************************** auth related ************************************************/
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      // console.log(user);
      res
        .cookie("token", token, {
          // httpOnly: true,
          // secure: false,
          // sameSite: "none",
          httpOnly: true,
          sameSite: "none",
          secure: true,
          maxAge: 3 * 60 * 1000,
        })
        .send({ success: true });
    });
    /****************************** auth related ************************************************/

    /****************************** CRUD ************************************************/
    // all services
    app.get("/services", logger, async (req, res) => {
      const result = await servicesCollection.find().toArray();
      res.send(result);
    });
    // single service
    app.get("/services/:id", async (req, res) => {
      const result = await servicesCollection.findOne({
        _id: new ObjectId(req.params.id),
      });
      res.send(result);
    });

    // order
    app.post("/orders", async (req, res) => {
      const result = await orderCollection.insertOne(req.body);
      res.json(result);
    });

    // orders filter by email
    app.get("/orders", logger, verifyToken, async (req, res) => {
      // console.log("token : ", req.cookies.token);
      // console.log(req.user.user);

      if (req.query?.email !== req.user.user) {
        return res.status(403).send({ message: "forbidden access" });
      }

      let query = {};
      if (req.query?.email) {
        query = { customer_email: req.query.email };
      }
      const result = await orderCollection.find(query).toArray();
      res.send(result);
    });

    // delete
    app.delete("/orders/:id", async (req, res) => {
      const result = await orderCollection.deleteOne({
        _id: new ObjectId(req.params.id),
      });
      res.json(result);
    });
    /********************************* CRUD *********************************************/

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("car service server is available.");
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
