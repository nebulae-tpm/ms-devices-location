import { Router, ActivatedRoute } from '@angular/router';
import {MatSnackBar} from '@angular/material';
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
import { toArray, tap, mergeMap, filter, map, defaultIfEmpty, first, debounceTime , distinctUntilChanged, startWith} from 'rxjs/operators';
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

  /////////////// OPTIONS MAP ///////////////

  showDisconnectedDevices = true;

  ///////////////////////////////////////////

  constructor(private translationLoader: FuseTranslationLoaderService, public dialog: MatDialog, private router: Router,
    private translate: TranslateService, private devicesLocationService: DevicesLocationService, private datePipe: DatePipe,
    private activatedRouter: ActivatedRoute, public snackBar: MatSnackBar, private zone: NgZone) {

    window['angularComponentReference'] = {
        zone: this.zone,
        componentFn: (value) => this.goToDeviceDetail(),
        component: this,
    };

    window['DeviceViewerReference'] = {
      zone: this.zone,
      componentFn: () => this.openDeviceViewerDialog(),
      component: this,
    };

    this.deviceFilterCtrl = new FormControl();
    this.translationLoader.loadTranslations(english, spanish);
  }

  ngOnInit(): void {
    this.getParams();

    this.initObservables();
    this.initMap();

    this.refreshDeviceLocationQuery(undefined, undefined, true);
    this.createDeviceLocationSubscription();

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
          .replace('{LAST_LOCATION_TIMESTAMP}', translations.LAST_LOCATION_TIMESTAMP)
          .replace('{SEE_MORE}', translations.SEE_MORE)
          .replace('{FOLLOW}', translations.FOLLOW);

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
   * Gets the device groups
   */
  initObservables() {
    this.deviceLocationQueryFiltered$ =
      this.deviceFilterCtrl.valueChanges.pipe(
        startWith(undefined),
        debounceTime(500),
        distinctUntilChanged(),
        mergeMap((filterText:String) => {
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
        mergeMap(resp => this.graphQlAlarmsErrorHandler$(resp)),
        filter(resp => !resp.errors),
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
      }, error => {}, () => {
        if(!this.selectedMarker){
          this.showMessageSnackbar('LOCATION.VEHICLE_NOT_FOUND');
        }
      });
  }



  /**
   * Clears the current marker clusterer
   */
  clearMarkerClusterer(){
    if(this.markerClusterer){
      this.markerClusterer.clearMarkers();
    }
  }

  /**
   * Update markert clusterer
   */
  updateMarkerClusterer() {
    this.clearMarkerClusterer();

    if(this.markers && this.markers.length > 0){
      this.markerClusterer = new MarkerCluster(this.map, this.markers,
        {imagePath: 'https://developers.google.com/maps/documentation/javascript/examples/markerclusterer/m'});
    }
  }

  graphQlAlarmsErrorHandler$(response){
    return Rx.Observable.of(JSON.parse(JSON.stringify(response)))
    .pipe(
      tap((resp: any) => {
        if (resp.errors){
          this.showMessageSnackbar('ERRORS.'+resp.errors[0].message.code);

          resp.data.getDevicesLocation = []
          return resp;
        }
      })
    )
  }

  refreshDeviceLocationQuery(filterText: String, groupName: String, firstTime: Boolean = false) {
    this.deviceLocationQuerySubscription = this.devicesLocationService
      .getDevicesLocationByFilter(filterText, groupName, undefined)
      .pipe(
        mergeMap(resp => this.graphQlAlarmsErrorHandler$(resp)),
        filter((resp: any) => !resp.errors),
        mergeMap(devicesLocation => Observable.from(devicesLocation.data.getDevicesLocation)),
        mergeMap((deviceLocation: any) => {
          return this.manageMarkers(deviceLocation);
        }),
      ).subscribe(([marker, deviceLocation]) => {
        if (!marker.getMap()) {
          marker.setMap(this.map);
          marker.lastTimeLocationReported = deviceLocation.currentLocation.timestamp;
          this.addMarkerToMap(marker);
        } else {
          marker.updateData(deviceLocation.currentLocation.lng,
            deviceLocation.currentLocation.lat, 1000,
            deviceLocation.currentLocation.timestamp,
            deviceLocation.ramUsageAlarmActivated,
            deviceLocation.sdUsageAlarmActivated,
            deviceLocation.cpuUsageAlarmActivated,
            deviceLocation.temperatureAlarmActivated,
            deviceLocation.online, false, this.showDisconnectedDevices
          );
        }

        this.updateMarkerInfoContent(marker, deviceLocation).subscribe(val => {});
      },
        error => console.error(error),
        () => {
          if(this.markers && this.markers.length == 0){
            this.showMessageSnackbar('LOCATION.VEHICLES_NOT_FOUND_ON_GROUPNAME', 'LOCATION.SNACK_BAR_CLOSE');
          }else{
            this.adjustZoomAccordingToTheMarkers();
            if(firstTime && this.selectedDeviceSerial){
              this.getSelectedDevice(this.selectedDeviceSerial);
            }
          }

          this.updateMarkerClusterer();
        });
  }

  /**
   * Subscribe to graphql to receive device location events
   */
  createDeviceLocationSubscription(){
    this.deviceLocationSubscriptionSubscription = this.devicesLocationService
    .subscribeDeviceLocation()
    .pipe(
      mergeMap(deviceLocation => {
        return this.manageMarkers(deviceLocation.data.deviceLocationEvent);
      }),
    ).subscribe(([marker, deviceLocation]) => {
      console.log('createDeviceLocationSubscription ', deviceLocation);
      if(this.selectedDeviceGroup && deviceLocation.groupName != this.selectedDeviceGroup){
        console.log('this.selectedDeviceGroup ==> ', this.selectedDeviceGroup);
        console.log('deviceLocation.groupName ==> ', deviceLocation.groupName);
        console.log('deviceLocation.groupName ==> ', (this.selectedDeviceGroup && deviceLocation.groupName != this.selectedDeviceGroup));
        //return;
      }

      if (!this.isMarkerInArray(marker)) {
        marker.setMap(this.map);
        this.addMarkerToMap(marker);
      } else {
        marker.updateData(deviceLocation.currentLocation.lng,
          deviceLocation.currentLocation.lat, 1000,
          deviceLocation.currentLocation.timestamp,
          deviceLocation.ramUsageAlarmActivated,
          deviceLocation.sdUsageAlarmActivated,
          deviceLocation.cpuUsageAlarmActivated,
          deviceLocation.temperatureAlarmActivated,
          deviceLocation.online, false);
      }

      this.updateMarkerClusterer();
      this.updateMarkerInfoContent(marker, deviceLocation).subscribe(val => {
      });
    });
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
   * Indicates if the marker indicated exists in the array of markers
   * @param serial Serial number of the device to check
   */
  isMarkerInArray(markerToCheck: MarkerRef){
    const markersFiltered = this.markers.filter(marker => marker.vehicle.serial == markerToCheck.vehicle.serial);
    return markersFiltered && markersFiltered.length > 0;
  }

  getParams(){
    this.activatedRouter.params
    .subscribe(params => {
      this.selectedDeviceSerial = params['id'];
    });
  }

  /**
   * Adjusts the zoom according to the markers
   */
  adjustZoomAccordingToTheMarkers(){
    this.bounds = new google.maps.LatLngBounds();
    this.markers.forEach(marker => {
      const loc = new google.maps.LatLng(marker.getPosition().lat(), marker.getPosition().lng());
      this.bounds.extend(loc);
    });

    this.map.fitBounds(this.bounds);
    this.map.panToBounds(this.bounds);
  }

  /**
   * Shows/hides the markers of the devices that are disconnected
   */
  showAndHideDisconnectedDevices() {
    this.showDisconnectedDevices = !this.showDisconnectedDevices;
    this.markers.forEach(marker => {
      if(!marker.vehicle.online){
        marker.setVisible(this.showDisconnectedDevices);
      }
    });
  }

  /**
   * Refresh the devices according to the new device group selected
   */
  onDeviceGroupChanged(deviceGroup: String) {
    this.selectedDeviceGroup = deviceGroup;
    this.clearMap();
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

  manageMarkers(deviceLocation): Observable<[MarkerRef, any]> {
    return Observable.from(this.markers).
    pipe(
      filter(marker => {
        return marker.vehicle.serial == deviceLocation.id && deviceLocation.currentLocation != null;
      }),
      defaultIfEmpty(
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
      ),
      first(),
      mergeMap(marker => {
          return Rx.Observable.forkJoin(
            Rx.Observable.of(marker),
            Rx.Observable.of(deviceLocation)
          );
      })
    );
  }

  /**
   * Updates the information shown on the InfoWindows of the marker passed as a parameter
   * @param marker marker to be updated
   */
  updateMarkerInfoContent(marker: MarkerRef, deviceLocation) {
    return Rx.Observable.forkJoin(
      Rx.Observable.of(marker),
      this.translate.get('MARKER.INFOWINDOW.TITLE'),
      this.translate.get('MARKER.INFOWINDOW.PLATE'),
      this.translate.get('MARKER.INFOWINDOW.VEHICLE'),
      this.translate.get('MARKER.INFOWINDOW.GROUPNAME'),
      this.translate.get('MARKER.INFOWINDOW.LAST_LOCATION_TIMESTAMP'),
      this.translate.get('MARKER.INFOWINDOW.SEE_MORE'),
      this.translate.get('MARKER.INFOWINDOW.FOLLOW')
    )
      .map(([marker, title, plate, vehicle, groupName, lastLocationTimestamp, seeMore, follow]) => {
        let infoWindowContent = MarkerRefInfoWindowContent;
        if(deviceLocation){
          marker.vehicle.serial = (deviceLocation.id ? deviceLocation.id + '' : '');
          marker.vehicle.groupName = (deviceLocation.groupName ? deviceLocation.groupName + '' : '');
          marker.vehicle.plate = (deviceLocation.hostname ? deviceLocation.hostname + '' : '');
          marker.vehicle.cpuUsageAlarmActivated =(deviceLocation.cpuUsageAlarmActivated ? deviceLocation.cpuUsageAlarmActivated: false);
          marker.vehicle.ramUsageAlarmActivated =(deviceLocation.ramUsageAlarmActivated ? deviceLocation.ramUsageAlarmActivated: false);
          marker.vehicle.sdUsageAlarmActivated =(deviceLocation.sdUsageAlarmActivated ? deviceLocation.sdUsageAlarmActivated: false);
          marker.vehicle.temperatureAlarmActivated = (deviceLocation.temperatureAlarmActivated ? deviceLocation.temperatureAlarmActivated: false);
        }

        const serialStr = (marker.vehicle.serial ? marker.vehicle.serial + '' : '');
        const groupNameStr = (marker.vehicle.groupName ? marker.vehicle.groupName : '');
        const lastLocationTimestampStr = (marker.lastTimeLocationReported ?
          this.datePipe.transform(new Date(marker.lastTimeLocationReported), 'yyyy-MM-dd HH:mm') : '');
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
    if(this.selectedMarker){
      this.router.navigate(['/devices/device', this.selectedMarker.vehicle.serial]);
    }
  }

  /**
   * Opens a device viewer dialog, this dialog shows information about the selected vehicle
   */
  openDeviceViewerDialog(): void {
    const dialogConfig = new MatDialogConfig();
    dialogConfig.hasBackdrop = false;
    dialogConfig.width = '400px';
    dialogConfig.height = '385px';
    dialogConfig.data = { followedMarkerId: this.selectedMarker.vehicle.serial };

    let dialogRef = this.dialog.open(MapDialogComponent, dialogConfig);
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
