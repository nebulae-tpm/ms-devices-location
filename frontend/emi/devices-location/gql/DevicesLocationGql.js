import gql from 'graphql-tag';

// This query gets the devices location
export const getDevicesLocation = gql`
    query getDevicesLocation($page: Int!, $count:Int!){
        getDevicesLocation(page: $page, count: $count){
            deviceId
            timeStamp
            lng
            lat
            plate
        }
    }
`;

// This subscription reports information about the location of each device
export const deviceLocationReportedEvent = gql`
    subscription{
        deviceLocationReportedEvent{
            deviceId
            timeStamp
            lng
            lat
            plate
        }
    }
`;

