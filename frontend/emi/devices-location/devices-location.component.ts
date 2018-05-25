import { Subscription } from 'rxjs/Subscription';
import { Observable } from 'rxjs/Observable';
import { DevicesLocationService } from './devices-location.service';
import { MapRef } from "./entities/agmMapRef";
import { MarkerRef, MarkerRefInfoWindowContent, MarkerRefTitleContent } from "./entities/markerRef";
import {
  Component,
  OnInit,
  ViewChild,
  OnDestroy,
  ElementRef,
  SimpleChanges,
  OnChanges
} from "@angular/core";
import { } from "googlemaps";
import { FormControl } from "@angular/forms";
// tslint:disable-next-line:import-blacklist
import * as Rx from "rxjs/Rx";
import { locale as english } from './i18n/en';
import { locale as spanish } from './i18n/es';
import { FuseTranslationLoaderService } from "../../../core/services/translation-loader.service";
import { TranslateService } from "@ngx-translate/core";
import { toArray, tap, mergeMap, filter } from 'rxjs/operators';

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
  autoComplete: google.maps.places.Autocomplete;
  @ViewChild("gmap") gmapElement: any;
  @ViewChild('input') input: ElementRef;
  map: MapRef;
  bounds: google.maps.LatLngBounds;

  subscribers: Subscription[] = [];
  deviceLocationSubscriptionSubscription: Subscription;
  deviceLocationQuerySubscription: Subscription;
  markers: MarkerRef[] = [];

  constructor(private translationLoader: FuseTranslationLoaderService,
    private translate: TranslateService, private devicesLocationService: DevicesLocationService) {
    this.translationLoader.loadTranslations(english, spanish);
  }

  ngOnInit(): void {
    
    this.initMap();
    this.bounds = new google.maps.LatLngBounds();

    this.deviceLocationQuerySubscription = this.devicesLocationService
      .getDevicesLocationByFilter(undefined, undefined)
      .pipe(
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
          marker.updateLocation(deviceLocation.currentLocation.lng, deviceLocation.currentLocation.lat, 1000, deviceLocation.currentLocation.timestamp);
        }},
        error => console.error(error),
        () => {
          this.map.fitBounds(this.bounds);
          this.map.panToBounds(this.bounds);
      });

    this.deviceLocationSubscriptionSubscription = this.devicesLocationService
      .subscribeDeviceLocation()
      .pipe(
        mergeMap(deviceLocation => {
          return this.manageMarkers(deviceLocation.data.deviceLocationReportedEvent);
        }),
        filter(([marker, deviceLocation]) => (marker as MarkerRef).lastTimeLocationReported < deviceLocation.currentLocation.timestamp)
      ).subscribe(([marker, deviceLocation]) => {
        if (!marker.getMap()) {
          marker.setMap(this.map);
          this.addMarkerToMap(marker);
        } else {
          marker.updateLocation(deviceLocation.currentLocation.lng, deviceLocation.currentLocation.lat, 1000, deviceLocation.currentLocation.timestamp);
        }
      });

    this.subscribers.push(this.deviceLocationQuerySubscription);
    this.subscribers.push(this.deviceLocationSubscriptionSubscription);

    this.subscribers.push(this.translate.onLangChange.subscribe(lang => {
      const translations = lang.translations.MARKER.INFOWINDOW;
      this.markers.forEach(m => {
        let originalInfoWindowContent = MarkerRefInfoWindowContent;
        const serialStr = (m.vehicle.serial ? m.vehicle.serial+'': '');
        const plateStr = (m.vehicle.plate? m.vehicle.plate: '');
        const groupNameStr = (m.vehicle.groupName ? m.vehicle.groupName: '');
        const lastLocationTimestampStr = (m.vehicle.groupName ? m.vehicle.groupName: '');
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
            groupName:  deviceLocation.groupName, 
            lastLocationTimestamp: deviceLocation.currentLocation.timestamp
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

        const serialStr = (marker.vehicle.serial ? marker.vehicle.serial+'': '');
        const groupNameStr = (marker.vehicle.groupName ? marker.vehicle.groupName: '');
        const lastLocationTimestampStr = (marker.vehicle.lastLocationTimestamp ? marker.vehicle.lastLocationTimestamp: '');
        const plateStr = (marker.vehicle.plate? marker.vehicle.plate: '');

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
    this.markers.forEach(m => {
      m.infoWindow.close();
    });
    marker.infoWindow.open(this.map, marker);
  }

  positionMarkerChangedEvent(marker: MarkerRef, event) {

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
