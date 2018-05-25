import gql from 'graphql-tag';

// This query gets the devices location
export const getDevicesLocation = gql`
    query getDevicesLocation($serial: String, $hostname:String){
        getDevicesLocation(serial: $serial, hostname: $hostname){
            id
            currentLocation{
              lat
              lng
              timestamp  
            }
            hostname
            groupName
            ramUsageAlarmActivated
            sdUsageAlarmActivated
            cpuUsageAlarmActivated
            temperatureAlarmActivated
            locationPath{
              lat
              lng
              timestamp  
            }
        }
    }
`;

// This subscription reports information about the location of each device
export const deviceLocationEvent = gql`
    subscription{
        deviceLocationEvent{
            id
            currentLocation{
              lat
              lng
              timestamp  
            }
            hostname
            groupName
            ramUsageAlarmActivated
            sdUsageAlarmActivated
            cpuUsageAlarmActivated
            temperatureAlarmActivated
            locationPath{
              lat
              lng
              timestamp  
            }
        }
    }
`;

