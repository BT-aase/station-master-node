const express = require("express");
const axios = require("axios");
const cors = require("cors");

const { username, password } = require("./secret");

const app = express();
app.use(cors());

const apiUrl = "https://api.rtt.io/api/v1/json";

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
      parseInt(service.locationDetail.gbttBookedDeparture) <
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
    .get(`${apiUrl}/search/${stationCode}`, { auth })
    .then((response) => {
      let trains = response.data.services;

      if (trains !== null) {
        trains = trains.slice(0, 10).map((service) => ({
          departTime: timeFormat(service.locationDetail.gbttBookedDeparture),
          destination: service.locationDetail.destination[0].description,
          operator: service.atocName,
          platform: service.locationDetail.platform,
          serviceId: service.serviceUid,
          serviceType: service.serviceType,
          status: status(
            service,
            stationStatus(service.locationDetail.serviceLocation)
          ),
        }));
      }

      res.json({ trains });
    })
    .catch((error) => {
      console.error("Error making API request:", error.message);
    });
});

const stopStatus = (station) => {
  let status = "";

  let action =
    station.realtimeDeparture === undefined ? "arrival" : "departure";
  if (action === "departure")
    status =
      parseInt(station.realtimeDeparture) >
      parseInt(station.gbttBookedDeparture)
        ? "late"
        : "ontime";
  else
    status =
      parseInt(station.realtimeArrival) > parseInt(station.gbttBookedArrival)
        ? "late"
        : "ontime";

  return status;
};

app.get("/station/:stationCode/service/:serviceId", (req, res) => {
  const serviceId = req.params.serviceId;
  console.log(req.params);
  axios
    .get(
      `${apiUrl}/service/${serviceId}/${new Date()
        .toJSON()
        .slice(0, 10)
        .replace(/-/g, "/")}`,
      { auth }
    )
    .then((response) => {
      let stops = [];

      for (var i = response.data.locations.length - 1; i >= 0; i--) {
        stops.unshift(response.data.locations[i]);
        if (response.data.locations[i].crs === req.params.stationCode) {
          break;
        }
      }

      stops = stops.map((station) => ({
        name: station.description,
        status: stopStatus(station),
        platform: station.platform,
        bookedTime:
          station.gbttBookedDeparture == undefined
            ? station.gbttBookedArrival
            : station.gbttBookedDeparture,
        realTime:
          station.realtimeDeparture === undefined
            ? station.realtimeArrival
            : station.realtimeDeparture,
      }));

      res.json({ stops });
    })
    .catch((error) => {
      console.error("Error making API request:", error.message);
    });
});

app.listen(3001, () => {
  console.log(`Server is listening on port 3001`);
});
