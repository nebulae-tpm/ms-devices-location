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
import {getDevicesLocation, deviceLocationReportedEvent}  from './gql/DevicesLocationGql';
import { map } from 'rxjs/operator/map';

@Injectable()
export class DevicesLocationService {

  constructor(private http: HttpClient, private gateway: GatewayService) { }

  getDevicesLocation(page, count): Observable<any> {
    return this.gateway.apollo
      .query<any>({
        query: getDevicesLocation,
        variables: {
          page: page,
          count: count
        },
      });
    }

  subscribeDeviceLocation(): Observable<any> {
    return this.gateway.apollo
      .subscribe({
        query: deviceLocationReportedEvent
      });
  }

}
