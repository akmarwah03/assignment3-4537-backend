const express = require("express");
const router = express.Router();
const { asyncWrapper } = require("../asyncWrapper.js");
const userModel = require("../userModel.js");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const { PokemonDbError, PokemonAuthError } = require("../errors.js");

router.post(
  "/register",
  asyncWrapper(async (req, res) => {
    const { username, password, email } = req.body;
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const userWithHashedPassword = { ...req.body, password: hashedPassword };

    const user = await userModel.create(userWithHashedPassword);
    res.send(user);
  })
);

let refreshTokens = [];
router.post(
  "/requestNewAccessToken",
  asyncWrapper(async (req, res) => {
    const Authorization = req.header("Authorization");
    if (!Authorization) {
      throw new PokemonAuthError("No Token: Please provide a token.");
    }
    const isRefreshToken = Authorization.startsWith("Refresh ");
    if (!isRefreshToken) {
      throw new PokemonAuthError(
        "Invalid Token: Please provide a refresh token."
      );
    }
    const refreshToken = Authorization.split(" ")[1];
    if (!refreshTokens.includes(refreshToken)) {
      // replaced a db access
      throw new PokemonAuthError(
        "Invalid Token: Please provide a valid token."
      );
    }
    try {
      const payload = await jwt.verify(
        refreshToken,
        process.env.REFRESH_TOKEN_SECRET
      );
      const accessToken = jwt.sign(
        { user: payload.user },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "1d" }
      );
      const user = await userModel.findOneAndUpdate(
        { username: payload.user.username },
        { accessToken },
        { new: true }
      );
      res.header("Authorization", `Bearer ${accessToken}`);
      res.send("All good!");
    } catch (error) {
      throw new PokemonAuthError(
        "Invalid Token: Please provide a valid token."
      );
    }
  })
);

router.post(
  "/login",
  asyncWrapper(async (req, res) => {
    const { username, password } = req.body;
    let user = await userModel.findOne({ username });
    if (!user) throw new PokemonAuthError("User not found");
    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) throw new PokemonAuthError("Password is incorrect");
    const accessToken = jwt.sign(
      {
        user: {
          username,
          email: user.email,
          role: user.role,
        },
      },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "1d" }
    );
    const refreshToken = jwt.sign(
      {
        user: {
          username,
          email: user.email,
          role: user.role,
        },
      },
      process.env.REFRESH_TOKEN_SECRET
    );
    refreshTokens.push(refreshToken);
    res.header(
      "Authorization",
      `Bearer ${accessToken},Refresh ${refreshToken}`
    );
    user = await userModel.findOneAndUpdate(
      { username },
      { accessToken },
      { new: true }
    );
    res.send(user);
  })
);

const asyncFilter = async (arr, predicate) =>
  Promise.all(arr.map(predicate)).then((results) =>
    arr.filter((_v, index) => results[index])
  );

router.get(
  "/logout",
  asyncWrapper(async (req, res) => {
    const Authorization = req.header("Authorization");
    if (!Authorization) {
      throw new PokemonAuthError("No Token: Please provide a token.");
    }
    const isRefreshToken = Authorization.startsWith("Refresh ");
    if (isRefreshToken) {
      throw new PokemonAuthError(
        "Invalid Token: Please provide an access token."
      );
    }
    const accessToken = Authorization.split(" ")[1];
    const user = await userModel.findOne({ accessToken: accessToken });
    if (!user) {
      throw new PokemonAuthError("User not found");
    }
    refreshTokens = await asyncFilter(refreshTokens, async (token) => {
      const payload = await jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
      return payload.user.username !== user.username;
    });
    user.accessToken = undefined;
    await user.save((err) => {
      if (err) throw new PokemonDbError(err);
    });
    res.send("Logged out");
  })
);

module.exports = router;
