const mongoose = require("mongoose");
const express = require("express");
const router = express.Router();
const { asyncWrapper } = require("../asyncWrapper.js");
const userModel = require("../userModel.js");
const jwt = require("jsonwebtoken");
const { populatePokemons } = require("../populatePokemons.js");
const { getTypes } = require("../getTypes.js");

const {
  PokemonBadRequestMissingID,
  PokemonNotFoundError,
  PokemonDuplicateError,
  PokemonAuthError,
} = require("../errors.js");

var pokeModel = null;

const start = asyncWrapper(async () => {
  const pokeSchema = await getTypes();
  pokeModel = mongoose.model("pokemons", pokeSchema);
  //   pokeModel = await populatePokemons(pokeSchema);
});
start();

const authUser = asyncWrapper(async (req, res, next) => {
  let token = req.header("Authorization");
  if (!token) {
    throw new PokemonAuthError(
      "No Token: Please provide the access token using the headers."
    );
  }
  let isAccess = token.startsWith("Bearer ");
  if (!isAccess) {
    throw new PokemonAuthError("Invalid Token passed.");
  }
  token = token.split(" ")[1];
  try {
    const verified = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const user = await userModel.findOne({ accessToken: token });
    if (!user) {
      throw new PokemonAuthError("Invalid Token Verification. Log in again.");
    }
    next();
  } catch (err) {
    throw new PokemonAuthError("Invalid Token Verification. Log in again.");
  }
});

const authAdmin = asyncWrapper(async (req, res, next) => {
  let token = req.header("Authorization");
  if (!token) {
    throw new PokemonAuthError(
      "No Token: Please provide the access token using the headers."
    );
  }
  let isAccess = token.startsWith("Bearer ");
  if (!isAccess) {
    throw new PokemonAuthError("Invalid Token passed.");
  }
  token = token.split(" ")[1];
  const payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
  console.log(payload);
  const user = await userModel.findOne({ accessToken: token });
  if (!user) {
    throw new PokemonAuthError("Invalid Token Verification. Log in again.");
  }
  if (payload?.user?.role == "admin") {
    return next();
  }
  throw new PokemonAuthError("Access denied");
});

router.use(authUser);
router.get(
  "/v1/pokemons",
  asyncWrapper(async (req, res) => {
    if (!req.query["count"]) req.query["count"] = 10;
    if (!req.query["after"]) req.query["after"] = 0;
    const docs = await pokeModel
      .find({})
      .sort({ id: 1 })
      .skip(req.query["after"])
      .limit(req.query["count"]);
    res.json(docs);
  })
);

router.get(
  "/v1/pokemon",
  asyncWrapper(async (req, res) => {
    const { id } = req.query;
    const docs = await pokeModel.find({ id: id });
    if (docs.length != 0) res.json(docs);
    else res.json({ errMsg: "Pokemon not found" });
  })
);

router.use(authAdmin);
router.post(
  "/v1/pokemon/",
  asyncWrapper(async (req, res) => {
    console.log(req.body);
    if (!req.body.id) throw new PokemonBadRequestMissingID();
    const poke = await pokeModel.find({ id: req.body.id });
    if (poke.length != 0) throw new PokemonDuplicateError();
    const pokeDoc = await pokeModel.create(req.body);
    res.json({
      msg: "Added Successfully",
    });
  })
);

router.delete(
  "/v1/pokemon",
  asyncWrapper(async (req, res) => {
    const docs = await pokeModel.findOneAndRemove({ id: req.query.id });
    if (docs)
      res.json({
        msg: "Deleted Successfully",
      });
    else throw new PokemonNotFoundError("");
  })
);

router.put(
  "/v1/pokemon/:id",
  asyncWrapper(async (req, res) => {
    const selection = { id: req.params.id };
    const update = req.body;
    const options = {
      new: true,
      runValidators: true,
      overwrite: true,
    };
    const doc = await pokeModel.findOneAndUpdate(selection, update, options);
    if (doc) {
      res.json({
        msg: "Updated Successfully",
        pokeInfo: doc,
      });
    } else {
      throw new PokemonNotFoundError("");
    }
  })
);

router.patch(
  "/v1/pokemon/:id",
  asyncWrapper(async (req, res) => {
    const selection = { id: req.params.id };
    const update = req.body;
    const options = {
      new: true,
      runValidators: true,
    };
    const doc = await pokeModel.findOneAndUpdate(selection, update, options);
    if (doc) {
      res.json({
        msg: "Updated Successfully",
        pokeInfo: doc,
      });
    } else {
      throw new PokemonNotFoundError("");
    }
  })
);

router.get("/report", (req, res) => {
  console.log("Report requested");
  res.send(`Table ${req.query.id}`);
});
module.exports = router;
