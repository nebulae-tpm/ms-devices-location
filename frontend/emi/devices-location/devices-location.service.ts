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
import { getDevicesLocation, deviceLocationEvent, getDeviceGroups } from './gql/DevicesLocationGql';
import { map } from 'rxjs/operator/map';

@Injectable()
export class DevicesLocationService {

  constructor(private http: HttpClient, private gateway: GatewayService) { }

  getAllDevicesLocation(): Observable<any> {
    console.log('test1');
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
      });
  }

  getDeviceGroups(): Observable<any> {
    return this.gateway.apollo
      .query<any>({
        query: getDeviceGroups
      });
  }

  subscribeDeviceLocation(): Observable<any> {
    return this.gateway.apollo
      .subscribe({
        query: deviceLocationEvent
      });
  }

}