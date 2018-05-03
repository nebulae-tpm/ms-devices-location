import gql from 'graphql-tag';

// This query gets the devices location
export const getDevicesLocation = gql`
    query getDevicesLocation($page: Int!, $count:Int!){
        getDevicesLocation(page: $page, count: $count){
            id
            timestamp
            lng
            lat
            hostname
        }
    }
`;

// This subscription reports information about the location of each device
export const deviceLocationReportedEvent = gql`
    subscription{
        deviceLocationReportedEvent{
            id
            timestamp
            lng
            lat
            hostname
        }
    }
`;

