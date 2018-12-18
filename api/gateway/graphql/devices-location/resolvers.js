const withFilter = require("graphql-subscriptions").withFilter;
const PubSub = require("graphql-subscriptions").PubSub;
const broker = require("../../broker/BrokerFactory")();
const pubsub = new PubSub();
const { of } = require("rxjs");
const { mergeMap, catchError, map } = require("rxjs/operators");

function getResponseFromBackEnd$(response) {
  return of(response).pipe(
    map(resp => {
      if (resp.result.code != 200) {
        const err = new Error();
        err.name = "Error";
        err.message = resp.result.error;
        Error.captureStackTrace(err, "Error");
        throw err;
      }
      return resp.data;
    })
  );
}

module.exports = {
  Query: {
    getDevicesLocation(root, args, context, fieldASTs) {
      return broker
        .forwardAndGetReply$(
          "Device",
          "gateway.graphql.query.getDevicesLocation",
          { root, args, jwt: context.encodedToken, fieldASTs },
          2000
        )
        .pipe(mergeMap(response => getResponseFromBackEnd$(response)))
        .toPromise();
    },
    getDeviceGroups(root, args, context) {
      return broker
        .forwardAndGetReply$(
          "Device",
          "gateway.graphql.query.getDeviceGroups",
          { root, args, jwt: context.encodedToken },
          2000
        )
        .pipe(mergeMap(response => getResponseFromBackEnd$(response)))
        .toPromise();
    }
  },
  Subscription: {
    deviceLocationEvent: {
      subscribe: withFilter(
        (payload, variables, context, info) => {
          return pubsub.asyncIterator("deviceLocationEvent");
        },
        (payload, variables, context, info) => {
          //If no variables were sent in the subscription, that means that all the device location events will be listened.
          return !variables.ids || variables.ids.length == 0
            ? true
            : variables.ids.filter(id => id == payload.deviceLocationEvent.id)
                .length > 0;
        }
      )
    }
  }
};

//// SUBSCRIPTIONS SOURCES ////

const eventDescriptors = [
  {
    backendEventName: "deviceLocationEvent",
    gqlSubscriptionName: "deviceLocationEvent",
    dataExtractor: evt => evt.data, // OPTIONAL, only use if needed
    onError: (error, descriptor) =>
      console.log(`Error processing ${descriptor.backendEventName}`), // OPTIONAL, only use if needed
    onEvent: (evt, descriptor) =>
      console.log(`Event of type  ${descriptor.backendEventName} arraived`) // OPTIONAL, only use if needed
  }
];

/**
 * Connects every backend event to the right GQL subscription
 */
eventDescriptors.forEach(descriptor => {
  broker.getMaterializedViewsUpdates$([descriptor.backendEventName]).subscribe(
    evt => {
      if (descriptor.onEvent) {
        descriptor.onEvent(evt, descriptor);
      }
      const payload = {};
      payload[descriptor.gqlSubscriptionName] = descriptor.dataExtractor
        ? descriptor.dataExtractor(evt)
        : evt.data;
      pubsub.publish(descriptor.gqlSubscriptionName, payload);
    },
    error => {
      if (descriptor.onError) {
        descriptor.onError(error, descriptor);
      }
      console.error(`Error listening ${descriptor.gqlSubscriptionName}`, error);
    },

    () => console.log(`${descriptor.gqlSubscriptionName} listener STOPED.`)
  );
});
