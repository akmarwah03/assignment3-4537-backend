const mongoose = require("mongoose");
const express = require("express");
const router = express.Router();
const { asyncWrapper } = require("../asyncWrapper.js");
const userModel = require("../userModel.js");
const jwt = require("jsonwebtoken");
const { populatePokemons } = require("../populatePokemons.js");
const { getTypes } = require("../getTypes.js");
const ErrorModel = require("../errorModel.js");

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

const EndpointSchema = new mongoose.Schema({
  endpoint: { type: String, required: true },
  type: { type: String, required: true },
  user: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const EndpointModel = mongoose.model("Endpoint", EndpointSchema);

async function apiAnalytics(req, res, next) {
  try {
    const endpoint = req.originalUrl;
    const type = req.method;
    const AuthorizationHeader = req.header("authorization");
    let username;
    if (AuthorizationHeader) {
      let payload;
      let token = AuthorizationHeader.split(" ")[1];
      if (AuthorizationHeader.startsWith("Bearer ")) {
        payload = await jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      } else {
        payload = await jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
      }
      username = payload.user.username;
    }
    const endpointEntry = await EndpointModel.create({
      endpoint,
      type,
      user: username,
    });
    next();
  } catch (err) {
    next(err);
  }
}

router.use(apiAnalytics);

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
    const docs = await pokeModel.find({}).sort({ id: 1 });
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

router.get("/uniqueAPIUsers", async (req, res, next) => {
  try {
    const docs = await EndpointModel.find({});
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7); // Subtract 7 days from today

    const uniqueUsersPastWeekByDay = {};

    docs.forEach((item) => {
      const createdAt = new Date(item.createdAt);
      if (createdAt >= oneWeekAgo) {
        const day = createdAt.toDateString(); // Get date string (e.g. "Sat Apr 09 2023")
        const user = item.user;
        if (!uniqueUsersPastWeekByDay[day]) {
          console.log(user);
          uniqueUsersPastWeekByDay[day] = new Set();
        }
        uniqueUsersPastWeekByDay[day].add(user);
      }
    });
    for (const key in uniqueUsersPastWeekByDay) {
      if (uniqueUsersPastWeekByDay.hasOwnProperty(key)) {
        uniqueUsersPastWeekByDay[key] = uniqueUsersPastWeekByDay[key].size;
      }
    }
    res.send(`${JSON.stringify(uniqueUsersPastWeekByDay)}`);
  } catch (err) {
    next(err);
  }
});
function getPreviousWeekDate() {
  const today = new Date();
  const previousWeek = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - 7
  );
  return previousWeek.toISOString().slice(0, 10); // Return the date in YYYY-MM-DD format
}

router.get("/topAPIUsers", async (req, res, next) => {
  try {
    const docs = await EndpointModel.find({});
    const previousWeekDate = getPreviousWeekDate();
    const topUsersByDay = {};
    for (const request of docs) {
      const createdAtDate = new Date(request.createdAt);
      if (createdAtDate.toISOString().slice(0, 10) >= previousWeekDate) {
        const createdAtDateString = createdAtDate.toISOString().slice(0, 10);
        if (!topUsersByDay.hasOwnProperty(createdAtDateString)) {
          topUsersByDay[createdAtDateString] = [];
        }
        topUsersByDay[createdAtDateString].push(request.user);
      }
    }
    for (const day in topUsersByDay) {
      const userCounts = {};
      for (const user of topUsersByDay[day]) {
        if (!userCounts.hasOwnProperty(user)) {
          userCounts[user] = 0;
        }
        userCounts[user]++;
      }
      const sortedUsers = Object.keys(userCounts).sort(
        (a, b) => userCounts[b] - userCounts[a]
      );
      topUsersByDay[day] = sortedUsers.slice(0, 5);
    }
    console.log(topUsersByDay);
    res.send(`${JSON.stringify(topUsersByDay)}`);
  } catch (err) {
    next(err);
  }
});

router.get("/topEndpointUsers", async (req, res, next) => {
  try {
    const docs = await EndpointModel.find({});
    const transformedData = {};
    for (const item of docs) {
      if (!transformedData[item.endpoint]) {
        transformedData[item.endpoint] = { [item.type]: new Set([item.user]) };
      } else if (!transformedData[item.endpoint][item.type]) {
        transformedData[item.endpoint][item.type] = new Set([item.user]);
      } else {
        transformedData[item.endpoint][item.type].add(item.user);
      }
    }

    const result = {};
    for (const endpoint in transformedData) {
      result[endpoint] = {};
      for (const type in transformedData[endpoint]) {
        const users = Array.from(transformedData[endpoint][type])
          .sort()
          .slice(0, 3);
        result[endpoint][type] = users;
      }
    }

    console.log(result);
    res.send(`${JSON.stringify(result)}`);
  } catch (err) {
    next(err);
  }
});

router.get("/errorByEndPoint", async (req, res, next) => {
  try {
    const docs = await ErrorModel.find({});
    const errorData = {};
    docs.forEach((entry) => {
      if (entry.code.startsWith("4")) {
        if (errorData[entry.endpoint]) {
          errorData[entry.endpoint].push(`${entry.code}: ${entry.message}`);
        } else {
          errorData[entry.endpoint] = [`${entry.code}: ${entry.message}`];
        }
      }
    });
    res.send(errorData);
  } catch (err) {
    next(err);
  }
});

router.get("/recentErrors", async (req, res, next) => {
  try {
    const docs = await ErrorModel.find({});
    const recentErrors = docs.filter((item) => {
      const statusCode = parseInt(item.code);
      const now = new Date();
      const itemCreatedAt = new Date(item.createdAt);

      const isRecent = now.getTime() - itemCreatedAt.getTime() <= 3600000; // consider only last 1 hour errors

      return isRecent && statusCode >= 400 && statusCode <= 599;
    });

    recentErrors.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // sort by createdAt date in descending order
    res.send(recentErrors);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
