import { DevicesLocationService } from './../devices-location.service';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { DatePipe } from '@angular/common';
import { MapRef } from "../entities/agmMapRef";
import { MarkerRef, MarkerRefInfoWindowContent, MarkerRefTitleContent } from "../entities/markerRef";
import { } from "googlemaps";
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
import { toArray, tap, mergeMap, filter, map, first } from 'rxjs/operators';
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

  @ViewChild("vehicleViewer") gmapElement: any;

  constructor(public dialogRef: MatDialogRef<MapDialogComponent>, @Inject(MAT_DIALOG_DATA) public data: any,
  private devicesLocationService: DevicesLocationService, private datePipe: DatePipe, 
  private translate: TranslateService, private translationLoader: FuseTranslationLoaderService) {
    console.log("Dialog DATA ******* ", data);
    this.followedMarkerId = data.followedMarkerId;
  }

  ngOnInit(): void {
    console.log('ngOnInit');
    this.initMap();

    this.refreshDeviceLocationQuery(this.followedMarkerId, undefined);
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
    console.log('Initmap => ', this.gmapElement.nativeElement);
    this.map = new MapRef(this.gmapElement.nativeElement, mapOptions);
  }

  refreshDeviceLocationQuery(filterText: String, groupName: String, firstTime: Boolean = false) {
    this.bounds = new google.maps.LatLngBounds();
    this.deviceLocationQuerySubscription = this.devicesLocationService
      .getDevicesLocationByFilter(filterText, groupName, undefined)
      .pipe(
        tap(val => console.log('refreshDeviceLocationQuery ', val)),
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
            deviceLocation.currentLocation.ramUsageAlarmActivated,
            deviceLocation.currentLocation.sdUsageAlarmActivated,
            deviceLocation.currentLocation.cpuUsageAlarmActivated,
            deviceLocation.currentLocation.temperatureAlarmActivated,
            deviceLocation.currentLocation.online
          );
        }
      },
        error => console.error(error),
        () => {
          // this.map.fitBounds(this.bounds);
          // this.map.panToBounds(this.bounds);
          this.map.setCenter(this.marker.getPosition())
        });
  }

    /**
   * Updates the information shown on the InfoWindows of the marker passed as a parameter
   * @param marker marker to be updated
   */
  updateMarkerInfoContent(marker: MarkerRef) {
    console.log('updateMarkerInfoContent ==> ', marker);
    return Rx.Observable.forkJoin(
      Rx.Observable.of(marker),
      this.translate.get('MARKER.INFOWINDOW.TITLE'),
      this.translate.get('MARKER.INFOWINDOW.PLATE'),
      this.translate.get('MARKER.INFOWINDOW.VEHICLE'),
      this.translate.get('MARKER.INFOWINDOW.GROUPNAME'),
      this.translate.get('MARKER.INFOWINDOW.LAST_LOCATION_TIMESTAMP')
    )
      .map(([marker, title, plate, vehicle, groupName, lastLocationTimestamp]) => {
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
    console.log("onMarkerClick ===> ", marker);
    marker.infoWindow.close();
    marker.setAnimation(null);
    marker.setAnimation(google.maps.Animation.BOUNCE);
    marker.setAnimation(null);
    marker.infoWindow.open(this.map, marker);
  }


  closeDialog(): void {
    this.dialogRef.close();
  }

    /**
   * Executes when the page is being destroyed
   */
  ngOnDestroy(): void {
    console.log('Destroying map dialog');
  }

}