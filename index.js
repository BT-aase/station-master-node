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
          origin: service.locationDetail.origin[0].description,
          originTime: service.locationDetail.origin[0].publicTime,
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

const getStopDetails = (stops) => {
  stops = stops.map((station) => ({
    name: station.description,
    status: stopStatus(station),
    platform: station.platform,
    bookedTime:
      station.gbttBookedDeparture == undefined
        ? timeFormat(station.gbttBookedArrival)
        : timeFormat(station.gbttBookedDeparture),
    realTime:
      station.realtimeDeparture === undefined
        ? timeFormat(station.realtimeArrival)
        : timeFormat(station.realtimeDeparture),
  }));

  return stops;
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
      let service = {
        selected: "",
        origin: "",
        destination: "",
        priorStops: [],
        followingStops: [],
      };

      const stations = response.data.locations;

      service.origin = getStopDetails([stations[0]])[0];
      service.destination = getStopDetails([stations[stations.length - 1]])[0];

      const selectIndex = stations.findIndex(
        (station) => station.crs == req.params.stationCode
      );
      service.selected = getStopDetails([stations[selectIndex]])[0];
      service.priorStops = getStopDetails(stations.slice(1, selectIndex));
      service.followingStops = getStopDetails(
        stations.slice(selectIndex + 1, stations.length - 1)
      );

      console.log(service);

      res.json({ service });
    })
    .catch((error) => {
      console.error("Error making API request:", error.message);
    });
});

app.listen(3001, () => {
  console.log(`Server is listening on port 3001`);
});
