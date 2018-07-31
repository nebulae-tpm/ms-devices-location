import {MatSnackBar} from '@angular/material';
import { DevicesLocationService } from './../devices-location.service';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { DatePipe } from '@angular/common';
import { MapRef } from "../entities/agmMapRef";
import { MarkerRef, MarkerRefInfoWindowContent, MarkerRefTitleContent } from "../entities/markerRef";
/// <reference types="googlemaps" />
import {
  Component,
  Inject,
  OnInit,
  ViewChild,
  OnDestroy,
} from "@angular/core";

import * as Rx from "rxjs/Rx";
import { Subscription } from 'rxjs/Subscription';
import { Observable } from 'rxjs/Observable';
import { tap, mergeMap, filter, first } from 'rxjs/operators';
import { FuseTranslationLoaderService } from "../../../../core/services/translation-loader.service";
import { TranslateService } from "@ngx-translate/core";

@Component({
  selector: 'dialog-overview-example-dialog',
  templateUrl: './map-dialog.component.html',
  styleUrls: ["./map-dialog.component.scss"]
})
export class MapDialogComponent implements OnInit, OnDestroy {

  map: MapRef;
  bounds: google.maps.LatLngBounds;
  marker: MarkerRef;
  followedMarkerId: String;

  subscribers: Subscription[] = [];
  deviceLocationSubscriptionSubscription: Subscription;
  deviceLocationQuerySubscription: Subscription;
  showRoutePath: boolean = true;

  @ViewChild("vehicleViewer") gmapElement: any;

  constructor(public dialogRef: MatDialogRef<MapDialogComponent>, @Inject(MAT_DIALOG_DATA) public data: any,
    private devicesLocationService: DevicesLocationService, private datePipe: DatePipe,  public snackBar: MatSnackBar,
    private translate: TranslateService, private translationLoader: FuseTranslationLoaderService) {
    this.followedMarkerId = data.followedMarkerId;
  }

  ngOnInit(): void {
    this.initMap();

    this.getDeviceLocationQuery(this.followedMarkerId, undefined);

    this.subscribeDeviceLocationWithLocationPathEvent();

    this.subscribers.push(this.deviceLocationQuerySubscription);
    this.subscribers.push(this.deviceLocationSubscriptionSubscription);
  }

  /**
 * Sets default configurations to the map
 */
  initMap() {
    const mapOptions = {
      center: new google.maps.LatLng(6.1701312, -75.6058417),
      zoom: 14,
      mapTypeId: google.maps.MapTypeId.ROADMAP
    };
    this.map = new MapRef(this.gmapElement.nativeElement, mapOptions);
  }


  /**
   * get the device data, its current location and location path according to the filter
   * @param filterText
   */
  getDeviceLocationQuery(filterText: String, groupName: String, firstTime: Boolean = false) {
    this.bounds = new google.maps.LatLngBounds();
    this.deviceLocationQuerySubscription = this.devicesLocationService
      .getDevicesLocationWithLocationPath(filterText)
      .pipe(
        mergeMap(devicesLocation => Observable.from(devicesLocation.data.getDevicesLocation)),
        first(),
        mergeMap((deviceLocation: any) => {

          this.marker = new MarkerRef(
            {
              plate: deviceLocation.hostname,
              serial: deviceLocation.id,
              groupName: deviceLocation.groupName,
              lastLocationTimestamp: deviceLocation.currentLocation.timestamp,
              temperatureAlarmActivated: deviceLocation.temperatureAlarmActivated,
              cpuUsageAlarmActivated: deviceLocation.cpuUsageAlarmActivated,
              sdUsageAlarmActivated: deviceLocation.sdUsageAlarmActivated,
              ramUsageAlarmActivated: deviceLocation.ramUsageAlarmActivated,
              online: deviceLocation.online
            },
            {
              position: {
                lat: parseFloat(deviceLocation.currentLocation.lat),
                lng: parseFloat(deviceLocation.currentLocation.lng)
              }, map: null
            });

          return Observable.of(this.marker)
            .mergeMap(marker => this.updateMarkerInfoContent(marker))
            .mergeMap(marker => {
              return Rx.Observable.forkJoin(
                Rx.Observable.of(marker),
                Rx.Observable.of(deviceLocation)
              );
            });
        }),
        filter(([marker, deviceLocation]) => (marker as MarkerRef).lastTimeLocationReported < deviceLocation.currentLocation.timestamp)
      ).subscribe(([marker, deviceLocation]) => {
        if (!marker.getMap()) {
          marker.setMap(this.map);
          const loc = new google.maps.LatLng(marker.getPosition().lat(), marker.getPosition().lng());
          this.bounds.extend(loc);
          this.addMarkerToMap(marker);
        } else {
          marker.updateData(deviceLocation.currentLocation.lng,
            deviceLocation.currentLocation.lat, 1000,
            deviceLocation.currentLocation.timestamp,
            deviceLocation.ramUsageAlarmActivated,
            deviceLocation.sdUsageAlarmActivated,
            deviceLocation.cpuUsageAlarmActivated,
            deviceLocation.temperatureAlarmActivated,
            deviceLocation.online, true
          );
        }
        marker.updateRoutePath(this.map, deviceLocation.locationPath);
      },
        error => console.error(error),
        () => {
          this.map.setCenter(this.marker.getPosition())
        });
  }

  /**
   * Subscribes to graphQL to listen the device changes
   */
  subscribeDeviceLocationWithLocationPathEvent() {
    const ids = [this.followedMarkerId];

    this.deviceLocationSubscriptionSubscription = this.devicesLocationService
      .subscribeDeviceLocationWithLocationPath(ids)
      .pipe(
        mergeMap((deviceLocation: any) => {
          return Observable.of(this.marker)
            .mergeMap(marker => this.updateMarkerInfoContent(marker))
            .mergeMap(marker => {
              return Rx.Observable.forkJoin(
                Rx.Observable.of(marker),
                Rx.Observable.of(deviceLocation.data.deviceLocationEvent)
              );
            });
        }),
    ).subscribe(([marker, deviceLocation]) => {
      if (!marker.getMap()) {
        marker.setMap(this.map);
        this.addMarkerToMap(marker);
      } else {
        marker.putMap(this.map);
        marker.updateData(deviceLocation.currentLocation.lng,
          deviceLocation.currentLocation.lat, 1000,
          deviceLocation.currentLocation.timestamp,
          deviceLocation.ramUsageAlarmActivated,
          deviceLocation.sdUsageAlarmActivated,
          deviceLocation.cpuUsageAlarmActivated,
          deviceLocation.temperatureAlarmActivated,
          deviceLocation.online, true);
        marker.updateRoutePath(this.map, deviceLocation.locationPath);
      }
    });
  }

  /**
 * Updates the information shown on the InfoWindows of the marker passed as a parameter
 * @param marker marker to be updated
 */
  updateMarkerInfoContent(marker: MarkerRef) {
    return Rx.Observable.forkJoin(
      Rx.Observable.of(marker),
      this.translate.get('MARKER.INFOWINDOW.TITLE'),
      this.translate.get('MARKER.INFOWINDOW.PLATE'),
      this.translate.get('MARKER.INFOWINDOW.VEHICLE'),
      this.translate.get('MARKER.INFOWINDOW.GROUPNAME'),
      this.translate.get('MARKER.INFOWINDOW.LAST_LOCATION_TIMESTAMP'),
      this.translate.get('MARKER.INFOWINDOW.SEE_MORE'),
      this.translate.get('MARKER.INFOWINDOW.FOLLOW'),
    )
      .map(([marker, title, plate, vehicle, groupName, lastLocationTimestamp, seeMore, follow]) => {
        let infoWindowContent = MarkerRefInfoWindowContent;

        const serialStr = (marker.vehicle.serial ? marker.vehicle.serial + '' : '');
        const groupNameStr = (marker.vehicle.groupName ? marker.vehicle.groupName : '');
        const lastLocationTimestampStr = (marker.vehicle.lastLocationTimestamp ?
          this.datePipe.transform(new Date(marker.vehicle.lastLocationTimestamp), 'yyyy-MM-dd HH:mm') : '');
        const plateStr = (marker.vehicle.plate ? marker.vehicle.plate : '');

        infoWindowContent = infoWindowContent.toString().replace('{TITLE}', title);
        infoWindowContent = infoWindowContent.toString().replace('{PLATE}', plate);
        infoWindowContent = infoWindowContent.toString().replace('{VEHICLE}', vehicle);
        infoWindowContent = infoWindowContent.toString().replace('{GROUPNAME}', groupName);
        infoWindowContent = infoWindowContent.toString().replace('{LAST_LOCATION_TIMESTAMP}', lastLocationTimestamp);
        infoWindowContent = infoWindowContent.toString().replace('{SEE_MORE}', seeMore);
        infoWindowContent = infoWindowContent.toString().replace('{FOLLOW}', follow);
        infoWindowContent = infoWindowContent.toString().replace('$plate', plateStr);
        infoWindowContent = infoWindowContent.toString().replace('$serial', serialStr);
        infoWindowContent = infoWindowContent.toString().replace('$groupName', groupNameStr);
        infoWindowContent = infoWindowContent.toString().replace('$lastLocationTimestamp', lastLocationTimestampStr);
        marker.infoWindow.setContent(infoWindowContent);

        let titleContent = MarkerRefTitleContent;
        titleContent = titleContent.toString().replace('{PLATE}', plate);
        titleContent = titleContent.toString().replace('{VEHICLE}', vehicle);
        titleContent = titleContent.toString().replace('$plate', plateStr);
        titleContent = titleContent.toString().replace('$serial', serialStr);
        marker.setTitleMarker(titleContent);

        return marker;
      })
  }

  graphQlAlarmsErrorHandler$(response){
    return Rx.Observable.of(JSON.parse(JSON.stringify(response)))
    .pipe(
      tap(resp => {
        if (resp.errors){
          this.showMessageSnackbar('ERRORS.'+resp.errors[0].message.code);

          resp.data.getDevicesLocation = []
          return resp;
        }
      })
    )
  }

      /**
   * Shows a message snackbar on the bottom of the page
   * @param messageKey Key of the message to i18n
   * @param detailMessageKey Key of the detail message to i18n
   */
  showMessageSnackbar(messageKey, detailMessageKey?){
    let translationData = [];
    if(messageKey){
      translationData.push(messageKey);
    }

    if(detailMessageKey){
      translationData.push(detailMessageKey);
    }

    this.translate.get(translationData)
    .subscribe(data => {
      this.snackBar.open(
        messageKey ? data[messageKey]: '',
        detailMessageKey ? data[detailMessageKey]: '',
        {
          duration: 2000
        }
      );
    });
  }


  addMarkerToMap(marker: MarkerRef) {
    marker.inizialiteEvents();
    marker.clickEvent.subscribe(event => {
      this.onMarkerClick(marker, event);
    });

    this.marker = marker;
  }

  /**
 * Opens the infoWindow of the clicked marker and closes the other infoWindows in case that these were open.
 * @param marker clicked marker
 * @param event Event
 */
  onMarkerClick(marker: MarkerRef, event) {
    marker.infoWindow.close();
    marker.setAnimation(null);
    marker.setAnimation(google.maps.Animation.BOUNCE);
    marker.setAnimation(null);
    marker.infoWindow.open(this.map, marker);
  }

  /**
 * Centers map in the last position of the vehicle
 */
  centerMap() {
    if (this.marker) {
      this.map.setCenter(this.marker.getPosition())
    }
  }

  /**
   * Shows/Hides the route path of the device (Device location history)
   */
  showAndHideRoutePath() {
    this.showRoutePath = !this.showRoutePath;
    this.marker.changeRoutePathVisibility(this.showRoutePath);
  }

  closeDialog(): void {
    this.dialogRef.close();
  }

  /**
 * Executes when the page is being destroyed
 */
  ngOnDestroy(): void {
    if (this.subscribers) {
      this.subscribers.forEach(sub => {
        sub.unsubscribe();
      });
    }
  }

}
