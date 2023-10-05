const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwtToken = require("jsonwebtoken");

const app = express();
const databasePath = path.join(__dirname, "covid19IndiaPortal.db");

app.use(express.json());

let database = null;

const initializeDbAndServer = async () => {
  try {
    database = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

const authenticationToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "SECRET_KEY_IN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

const createStateDbObjectToResponseObject = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

const createDistrictDbObjectToResponseObject = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

//Login API

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT  * FROM  user  WHERE username = '${username}';`;
  const dbUser = await database.get(selectUserQuery);
  if (dbUser === undefined) {
    response.send(400);
    response.send("Invalid user");
  } else {
    const isMatchedPassword = await bcrypt.compare(password, dbUser.password);
    if (isMatchedPassword === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "SECRET_KEY_IN");
      response.send({ jwtToken });
    } else {
      response.send(400);
      response.send("Invalid password");
    }
  }
});

//Get all states API

app.get("/states/", authenticationToken, async (request, response) => {
  const getStatesQuery = `SELECT * FROM state;`;
  const stateArray = await database.all(getStatesQuery);
  response.send(
    stateArray.map((eachState) =>
      createStateDbObjectToResponseObject(eachState)
    )
  );
});

//Get state API

app.get("/states/:stateId/", authenticationToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `SELECT * FROM state WHERE state_id = '${stateId}';`;
  const state = await database.get(getStateQuery);
  response.send(createStateDbObjectToResponseObject(state));
});

//POST District API

app.post("/districts/", authenticationToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const addPostQuery = `
     INSERT INTO 
       district(district_name, state_id, cases, cured, active, deaths)
     VALUES('${districtName}', ${stateId}, '${cases}', '${cured}', '${active}', '${deaths}');`;
  const addDistrict = await database.run(addPostQuery);
  const lastAddedId = addDistrict.lastID;
  response.send("District Successfully Added");
});

//GET District API

app.get(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `SELECT * FROM district WHERE district_id = ${districtId};`;
    const district = await database.get(getDistrictQuery);
    response.send(createDistrictDbObjectToResponseObject(district));
  }
);

// DELETE District API

app.delete(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `DELETE FROM district WHERE district_id = ${districtId};`;
    await database.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

//UPDATE District API

app.put(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrictQuery = `
    UPDATE 
      district
    SET  
      district_name: '${districtName}',
      state_id: ${stateId},
      cases: ${cases},
      cured: ${cured},
      active: ${active},
      deaths: ${deaths};`;
    await database.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

//GET Specific stats details API

app.get(
  "/states/:stateId/stats/",
  authenticationToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateQuery = `
        SELECT 
          SUM(cases) AS totalCases,
          SUM(cured) AS totalCured,
          SUM(active) AS totalActive,
          SUM(deaths) AS totalDeaths
        FROM district
        WHERE state_id = ${stateId};`;
    const stats = await database.get(getStateQuery);
    response.send({
      totalCases: stats["SUM(cases)"],
      totalCured: stats["SUM(cured)"],
      totalActive: stats["SUM(active)"],
      totalDeaths: stats["SUM(deaths)"],
    });
  }
);

module.exports = app;
