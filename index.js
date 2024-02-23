const express = require("express");
const axios = require("axios");
const cors = require("cors");

const { username, password } = require("./secret");

const app = express();
app.use(cors());

const apiUrl = "https://api.rtt.io/api/v1/json/search/";

const auth = {
  username: username,
  password: password,
};

const timeFormat = (time) => {
  return `${time.substr(0, 2)}:${time.substr(2)}`;
};

const stationStatus = (status) => {
  switch (status) {
    case "APPR_STAT":
      return "Approaching Station";
    case " APPR_PLAT":
      return "Arriving";
    case "AT_PLAT":
      return "At Platform";
    case "DEP_PREP":
      return "Preparing To Depart";
    case "DEP_READY":
      return "Ready To Depart";
    default:
      return null;
  }
};

const status = (service, status) => {
  if (status == null) {
    if (
      parseInt(service.locationDetail.gbttBookedArrival) <
      parseInt(service.locationDetail.realtimeArrival)
    ) {
      status = `Expected at ${timeFormat(
        service.locationDetail.realtimeArrival
      )}`;
    } else {
      status = "On Time";
    }
  }
  return status;
};

app.get("/station/:stationCode", (req, res) => {
  const stationCode = req.params.stationCode;
  axios
    .get(apiUrl + stationCode, { auth })
    .then((response) => {
      const trains = response.data.services.slice(0, 10).map((service) => ({
        departTime: timeFormat(service.locationDetail.gbttBookedDeparture),
        destination: service.locationDetail.destination[0].description,
        operator: service.atocName,
        platform: service.locationDetail.platform,
        status: status(
          service,
          stationStatus(service.locationDetail.serviceLocation)
        ),
      }));

      res.json({ trains });
    })
    .catch((error) => {
      console.error("Error making API request:", error.message);
    });
});

app.listen(3001, () => {
  console.log(`Server is listening on port 3001`);
});
