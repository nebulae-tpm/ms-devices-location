import { Subscription } from 'rxjs/Subscription';
import { Injectable } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  RouterStateSnapshot
} from '@angular/router';
import { GatewayService } from '../../../api/gateway.service';
import { Observable } from 'rxjs/Observable';
import { HttpClient } from '@angular/common/http';
import * as Rx from 'rxjs';
import { getDevicesLocation, getDevicesLocationWithLocationPath, deviceLocationEvent, deviceLocationWithLocationPathEvent, getDeviceGroups } from './gql/DevicesLocationGql';
import { map } from 'rxjs/operator/map';

@Injectable()
export class DevicesLocationService {

  constructor(private http: HttpClient, private gateway: GatewayService) { }

  getAllDevicesLocation(): Observable<any> {
    return this.gateway.apollo
      .query<any>({
        query: getDevicesLocation
      });
  }

  //getDevicesLocationByFilter(serial: String, hostname: String, groupName: String): Observable<any> {
  getDevicesLocationByFilter(filterText: String, groupName: String, limit: number): Observable<any> {
    return this.gateway.apollo
      .query<any>({
        query: getDevicesLocation,
        variables: {
          filterText: filterText,
          groupName: groupName,
          limit: limit
        },
        //errorPolicy: 'all'
      });
  }

  /**
   * Gets the devices with its current location and location path (Historial device location)
   * @param filterText
   * @param groupName
   * @param limit
   */
  getDevicesLocationWithLocationPath(filterText: String): Observable<any> {
    return this.gateway.apollo
      .query<any>({
        query: getDevicesLocationWithLocationPath,
        variables: {
          filterText: filterText,
          limit: 1
        },
        //errorPolicy: 'all'
      });
    }

  getDeviceGroups(): Observable<any> {
    return this.gateway.apollo
      .query<any>({
        query: getDeviceGroups,
        //errorPolicy: 'all'
      });
  }

  subscribeDeviceLocation(): Observable<any> {
    return this.gateway.apollo
      .subscribe({
        query: deviceLocationEvent
      });
  }

  subscribeDeviceLocationWithLocationPath(ids: String[]): Observable<any> {
    return this.gateway.apollo
      .subscribe({
        query: deviceLocationWithLocationPathEvent,
        variables: {
          ids: ids
        },
      });
  }

}
