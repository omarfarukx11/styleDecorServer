const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const port = process.env.PORT || 3000;
const uri = "mongodb+srv://<db_username>:<db_password>@cluster0.oyyjehq.mongodb.net/?appName=Cluster0";


// middleWare
app.use(express.json());
app.use(cors());



app.get("/", (req, res) => {
  res.send("lets begin");
});


app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
