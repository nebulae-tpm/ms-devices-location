import { Router, ActivatedRoute } from '@angular/router';
import { MapDialogComponent } from './dialog/map-dialog.component';
import { DatePipe } from '@angular/common';
import { Subscription } from 'rxjs/Subscription';
import { Observable } from 'rxjs/Observable';
import { DevicesLocationService } from './devices-location.service';
import { MapRef } from "./entities/agmMapRef";
import { MarkerCluster } from "./entities/markerCluster";
import { MarkerRef, MarkerRefInfoWindowContent, MarkerRefTitleContent } from "./entities/markerRef";
import {
  Component,
  OnInit,
  ViewChild,
  OnDestroy,
  ElementRef,
  SimpleChanges,
  OnChanges,
  Inject,
  NgZone
} from "@angular/core";
import { } from "google-maps";
import { } from "googlemaps";
import { } from "markerclustererplus";
import { FormControl } from "@angular/forms";
// tslint:disable-next-line:import-blacklist
import * as Rx from "rxjs/Rx";
import { locale as english } from './i18n/en';
import { locale as spanish } from './i18n/es';
import { FuseTranslationLoaderService } from "../../../core/services/translation-loader.service";
import { TranslateService } from "@ngx-translate/core";
import { toArray, tap, mergeMap, filter, map } from 'rxjs/operators';
import { startWith } from 'rxjs/operators/startWith';
import { distinctUntilChanged } from 'rxjs/operators/distinctUntilChanged';
import { MatDialog, MatDialogConfig, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';

@Component({
  selector: "devices-location",
  templateUrl: "./devices-location.component.html",
  styleUrls: ["./devices-location.component.scss"]
})
export class DevicesLocationComponent implements OnInit, OnDestroy {

  mapTypes = [
    google.maps.MapTypeId.HYBRID,
    google.maps.MapTypeId.ROADMAP,
    google.maps.MapTypeId.SATELLITE,
    google.maps.MapTypeId.TERRAIN
  ];

  @ViewChild("gmap") gmapElement: any;
  @ViewChild('input') input: ElementRef;
  map: MapRef;
  bounds: google.maps.LatLngBounds;
  markerClusterer: MarkerCluster;

  deviceGroups$: Observable<any>;
  deviceLocationQueryFiltered$: Observable<any[]>;
  selectedDeviceGroup: String;
  selectedMarker: MarkerRef;
  selectedDeviceSerial = String;
  subscribers: Subscription[] = [];
  deviceLocationSubscriptionSubscription: Subscription;
  deviceLocationQuerySubscription: Subscription;
  markers: MarkerRef[] = [];
  deviceFilterCtrl: FormControl;

  constructor(private translationLoader: FuseTranslationLoaderService, public dialog: MatDialog, private router: Router,
    private translate: TranslateService, private devicesLocationService: DevicesLocationService, private datePipe: DatePipe,
    private activatedRouter: ActivatedRoute, private zone: NgZone) {

      window['angularComponentReference'] = {
        zone: this.zone,
        componentFn: (value) => this.goToDeviceDetail(),
        component: this,
    };

    this.deviceFilterCtrl = new FormControl();
    this.translationLoader.loadTranslations(english, spanish);
  }

  /**
   * Gets the device groups
   */
  initObservables() {
    this.deviceLocationQueryFiltered$ =
      this.deviceFilterCtrl.valueChanges.pipe(
        startWith(undefined),
        mergeMap((filterText) => {
          console.log('this.selectedDeviceGroup ******* ', filterText, this.selectedDeviceGroup);
          return this.getAllDevicesFiltered(filterText, this.selectedDeviceGroup, 10);
        })
      );

    this.deviceGroups$ =
      this.devicesLocationService
        .getDeviceGroups()
        .pipe(
          map(response => response.data.getDeviceGroups)
        );
  }

  getAllDevicesFiltered(filterText: String, groupName: String, limit: number): Observable<any[]> {
    return this.devicesLocationService
      .getDevicesLocationByFilter(filterText, groupName, limit)
      .pipe(
        mergeMap(devicesLocation => Observable.from(devicesLocation.data.getDevicesLocation)),
        toArray()
      );
  }

  getSelectedDevice(selectedDeviceId) {
    Observable.from(this.markers)
      .filter(marker => marker.vehicle.serial == selectedDeviceId)
      .subscribe((marker: any) => {
        this.bounds = new google.maps.LatLngBounds();
        this.bounds.extend(marker.getPosition());
        this.map.setCenter(marker.getPosition());
        this.map.fitBounds(this.bounds);
        this.onMarkerClick(marker, null);
      });
  }

  /**
   * Clears the current marker clusterer
   */
  clearMarkerClusterer(){
    if(this.markerClusterer ){
      this.markerClusterer.clearMarkers();
      //this.markerClusterer.setMap(null);
    }
  }

  updateMarkerClusterer() {
    console.log('updateMarkerClusterer ', this.markers);

    this.clearMarkerClusterer();

    this.markerClusterer = new MarkerCluster(this.map, this.markers,
      {imagePath: 'https://developers.google.com/maps/documentation/javascript/examples/markerclusterer/m'});
  }


  refreshDeviceLocationQuery(filterText: String, groupName: String, firstTime: Boolean = false) {
    this.bounds = new google.maps.LatLngBounds();
    this.deviceLocationQuerySubscription = this.devicesLocationService
      .getDevicesLocationByFilter(filterText, groupName, undefined)
      .pipe(
        tap(val => console.log('refreshDeviceLocationQuery ', val)),
        mergeMap(devicesLocation => Observable.from(devicesLocation.data.getDevicesLocation)),
        mergeMap((deviceLocation: any) => {
          return this.manageMarkers(deviceLocation);
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
          this.map.fitBounds(this.bounds);
          this.map.panToBounds(this.bounds);
          if(firstTime && this.selectedDeviceSerial){
            console.log('First time: ', this.selectedDeviceSerial);
            this.getSelectedDevice(this.selectedDeviceSerial);
          }
          this.updateMarkerClusterer();
        });
  }

  onDeviceGroupChanged(deviceGroup: String) {
    console.log('Selected device group => ', deviceGroup);
    this.selectedDeviceGroup = deviceGroup;
    this.clearMap();
    //this.clearMarkerClusterer();
    this.refreshDeviceLocationQuery(undefined, this.selectedDeviceGroup);
    this.deviceFilterCtrl.setValue("", { emitEvent: true });
  }

  /**
   * Deletes all the markers from the map and clear markers array
   */
  clearMap() {
    for (var i = 0; i < this.markers.length; i++) {
      this.markers[i].setMap(null);
    }
    this.markers = [];
  }

  getParams(){
    this.activatedRouter.params
    .subscribe(params => {
      this.selectedDeviceSerial = params['id'];
      console.log('getParam ===> ', this.selectedDeviceSerial);
    });
  }

  ngOnInit(): void {
    this.getParams();


    this.initObservables();
    this.initMap();
    this.refreshDeviceLocationQuery(undefined, undefined, true);

    this.deviceLocationSubscriptionSubscription = this.devicesLocationService
      .subscribeDeviceLocation()
      .pipe(
        mergeMap(deviceLocation => {
          console.log('EVENT deviceLocationSubscriptionSubscription ', JSON.stringify(deviceLocation));
          return this.manageMarkers(deviceLocation.data.deviceLocationEvent);
        }),
        filter(([marker, deviceLocation]) => (marker as MarkerRef).lastTimeLocationReported < deviceLocation.currentLocation.timestamp)
      ).subscribe(([marker, deviceLocation]) => {
        if (!marker.getMap()) {
          marker.setMap(this.map);
          this.addMarkerToMap(marker);
        } else {
          marker.updateData(deviceLocation.currentLocation.lng,
            deviceLocation.currentLocation.lat, 1000,
            deviceLocation.currentLocation.timestamp,
            deviceLocation.currentLocation.ramUsageAlarmActivated,
            deviceLocation.currentLocation.sdUsageAlarmActivated,
            deviceLocation.currentLocation.cpuUsageAlarmActivated,
            deviceLocation.currentLocation.temperatureAlarmActivated,
            deviceLocation.currentLocation.online);
        }
        this.updateMarkerClusterer();
      });

    this.subscribers.push(this.deviceLocationQuerySubscription);
    this.subscribers.push(this.deviceLocationSubscriptionSubscription);

    this.subscribers.push(this.translate.onLangChange.subscribe(lang => {
      const translations = lang.translations.MARKER.INFOWINDOW;
      this.markers.forEach(m => {
        let originalInfoWindowContent = MarkerRefInfoWindowContent;
        const serialStr = (m.vehicle.serial ? m.vehicle.serial + '' : '');
        const plateStr = (m.vehicle.plate ? m.vehicle.plate : '');
        const groupNameStr = (m.vehicle.groupName ? m.vehicle.groupName : '');

        const lastLocationTimestampStr = (m.vehicle.lastLocationTimestamp ?
          this.datePipe.transform(new Date(m.vehicle.lastLocationTimestamp), 'yyyy-MM-dd HH:mm') : '');
        let content = m.infoWindow.getContent();
        content = originalInfoWindowContent.toString()
          .replace('{PLATE}', translations.PLATE)
          .replace('{TITLE}', translations.TITLE)
          .replace('{VEHICLE}', translations.VEHICLE)
          .replace('{GROUPNAME}', translations.GROUPNAME)
          .replace('{LAST_LOCATION_TIMESTAMP}', translations.LAST_LOCATION_TIMESTAMP);
        content = content.toString().replace('$plate', plateStr);
        content = content.replace('$serial', serialStr);
        m.infoWindow.setContent(content);

        let originalTitleContent = MarkerRefTitleContent;
        let title = '';
        title = originalTitleContent.toString().replace('{PLATE}', translations.PLATE).replace('{TITLE}', translations.TITLE).replace('{VEHICLE}', translations.VEHICLE);
        title = title.toString().replace('$plate', plateStr);
        title = title.replace('$serial', serialStr);
        m.setTitleMarker(title);
      });
    }));

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

  manageMarkers(deviceLocation): Observable<[MarkerRef, any]> {
    console.log('manageMarkers =====> ', deviceLocation);
    return Observable.from(this.markers)
      .filter(marker => {
        return marker.vehicle.serial == deviceLocation.id;
      })
      .defaultIfEmpty(
        new MarkerRef(
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
          })
      )
      .first()
      .mergeMap(marker => this.updateMarkerInfoContent(marker))
      .mergeMap(marker => {
        return Rx.Observable.forkJoin(
          Rx.Observable.of(marker),
          Rx.Observable.of(deviceLocation)
        );
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

  /**
   * Adds a marker to the map and configure observables to listen to the events associated with the marker (Click, etc)
   * @param marker marker to be added
   */
  addMarkerToMap(marker: MarkerRef) {
    marker.inizialiteEvents();
    marker.clickEvent.subscribe(event => {
      this.onMarkerClick(marker, event);
    });
    marker.position_changedEvent.subscribe(event => {
      this.positionMarkerChangedEvent(marker, event);
    });

    this.markers.push(marker);
  }

  // Executes when a marker is dragged
  onMarkerDragEnd(marker: MarkerRef, event: google.maps.MouseEvent) {

  }

  /**
   * Opens the infoWindow of the clicked marker and closes the other infoWindows in case that these were open.
   * @param marker clicked marker
   * @param event Event
   */
  onMarkerClick(marker: MarkerRef, event) {
    console.log("onMarkerClick ===> ", marker);
    this.selectedMarker = marker;
    this.markers.forEach(m => {
      m.infoWindow.close();
      m.setAnimation(null);
    });
    marker.setAnimation(google.maps.Animation.BOUNCE);
    marker.setAnimation(null);
    marker.infoWindow.open(this.map, marker);
  }

  positionMarkerChangedEvent(marker: MarkerRef, event) {

  }

  /**
   * Navigates to the device detail page of the selected vehicle
   */
  goToDeviceDetail() {
    console.log('goToDeviceDetail');
    if(this.selectedMarker){
      console.log('Navigates ===> ', this.selectedMarker.vehicle.serial);
      this.router.navigate(['device', this.selectedMarker.vehicle.serial]);
    }
  }

  openDialog(): void {
    const dialogConfig = new MatDialogConfig();
    dialogConfig.hasBackdrop = false;
    dialogConfig.width = '400px';
    dialogConfig.height = '350px';
    dialogConfig.data = { followedMarkerId: this.selectedMarker.vehicle.serial };
    
    let dialogRef = this.dialog.open(MapDialogComponent, dialogConfig);

    dialogRef.afterClosed().subscribe(result => {
      console.log('The dialog was closed');
      //this.animal = result;
    });
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
