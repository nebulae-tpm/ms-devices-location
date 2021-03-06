import gql from 'graphql-tag';

// This query gets the devices location
export const getDevicesLocation = gql`
    query getDevicesLocation($filterText: String, $groupName: String, $limit: Int){
        getDevicesLocation(filterText: $filterText, groupName: $groupName, limit: $limit){
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
            online
        }
    }
`;

// This query gets the devices location with the location path
export const getDevicesLocationWithLocationPath = gql`
    query getDevicesLocation($filterText: String, $groupName: String, $limit: Int){
        getDevicesLocation(filterText: $filterText, groupName: $groupName, limit: $limit){
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
            online
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
            online
        }
    }
`;

// This subscription reports information about the location of each device and its location path (Historical device location)
export const deviceLocationWithLocationPathEvent = gql`
    subscription deviceLocationEvent($ids: [String]){
        deviceLocationEvent(ids: $ids){
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
            online
            locationPath{
              lat
              lng
              timestamp  
            }
        }
    }
`;

// This subscription reports information about the location of each device
export const getDeviceGroups = gql`
    query getDeviceGroups{
        getDeviceGroups{
            name
        }
    }
`;

