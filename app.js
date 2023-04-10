const express = require("express");
const { connectDB } = require("./connectDB.js");
const morgan = require("morgan");
const cors = require("cors");
const userModel = require("./userModel.js");
const { asyncWrapper } = require("./asyncWrapper.js");
const bcrypt = require("bcrypt");

const { PokemonDbError } = require("./errors.js");

const apiRouter = require("./routers/api.js");
const authRouter = require("./routers/auth.js");

const dotenv = require("dotenv");
dotenv.config();

const app = express();

const start = asyncWrapper(async () => {
  await connectDB({ drop: false });
  const doc = await userModel.findOne({ username: "admin" });
  if (!doc)
    userModel.create({
      username: "admin",
      password: bcrypt.hashSync("admin", 10),
      role: "admin",
      email: "admin@admin.ca",
    });
  app.listen(process.env.pokeServerPORT, (err) => {
    if (err) throw new PokemonDbError(err);
    else
      console.log(
        `Phew! Server is running on port: ${process.env.pokeServerPORT}`
      );
  });
});
start();
app.use(express.json());
app.use(morgan(":method"));
app.use(cors());

app.use("/api", apiRouter);
app.use("/auth", authRouter);

app.use((err, req, res, next) => {
  if (err.pokeErrCode) res.status(err.pokeErrCode);
  else res.status(500);
  res.send({
    err: {
      message: err.message,
      type: err.name,
    },
  });
  console.log("####################");
  console.log(err);
  console.log("####################");
});
