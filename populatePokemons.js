const mongoose = require("mongoose");
const https = require("https");
const ProgressBar = require("progress");

const populatePokemons = (pokeSchema) => {
  return new Promise((resolve, reject) => {
    pokeModel = mongoose.model("pokemons", pokeSchema); // unicorns is the name of the collection in db
    https.get(
      "https://raw.githubusercontent.com/fanzeyi/pokemon.json/master/pokedex.json",
      function (res) {
        var chunks = "";
        res.on("data", (chunk) => {
          chunks += chunk;
        });
        res.on("end", async () => {
          const arr = JSON.parse(chunks);
          var bar = new ProgressBar(
            "## inserting :pokeName [:bar]  :percent :etas ",
            {
              complete: "=",
              incomplete: " ",
              width: 20,
              total: arr.length,
            }
          );
          Promise.all(
            arr.map((element) => {
              return new Promise(async (resolve, reject) => {
                element["base"]["Speed Attack"] = element["base"]["Sp. Attack"];
                delete element["base"]["Sp. Attack"];
                element["base"]["Speed Defense"] =
                  element["base"]["Sp. Defense"];
                delete element["base"]["Sp. Defense"];
                try {
                  let doc = await pokeModel.findOne({ id: element.id });
                  if (!doc) {
                    await pokeModel.insert(element);
                  }
                  setTimeout(() => {
                    bar.tick({ pokeName: element.name.english });
                    resolve();
                  }, Math.random() * 2000);
                } catch (error) {
                  console.log(error);
                }
              });
            })
          ).then(() => {
            resolve(pokeModel);
          });
        });
      }
    );
  });
};

module.exports = { populatePokemons };
