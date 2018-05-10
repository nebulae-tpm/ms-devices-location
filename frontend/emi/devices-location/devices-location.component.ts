import { Subscription } from 'rxjs/Subscription';
import { Observable } from 'rxjs/Observable';
import { DevicesLocationService } from './devices-location.service';
import { MapRef } from "./entities/agmMapRef";
import { MarkerRef, MarkerRefInfoWindowContent } from "./entities/markerRef";
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
import { toArray } from 'rxjs/operators';
@Component({
  selector: "devices-location",
  templateUrl: "./devices-location.component.html",
  styleUrls: ["./devices-location.component.scss"]
})
export class DevicesLocationComponent implements OnInit, OnDestroy, OnChanges {

  mapTypes = [
    google.maps.MapTypeId.HYBRID,
    google.maps.MapTypeId.ROADMAP,
    google.maps.MapTypeId.SATELLITE,
    google.maps.MapTypeId.TERRAIN
  ];
  autoComplete: google.maps.places.Autocomplete;
  timer = Rx.Observable.interval(100);
  timerSubscription: Rx.Subscription;
  @ViewChild("gmap") gmapElement: any;
  @ViewChild('input') input: ElementRef;
  map: MapRef;
  bounds: google.maps.LatLngBounds;

  deviceLocationSubscription: Subscription;
  deviceLocationDataSubscription: Subscription;
  markers: MarkerRef[] = [];

  constructor(private translationLoader: FuseTranslationLoaderService,
    private translate: TranslateService, private devicesLocationService: DevicesLocationService) {
    this.translationLoader.loadTranslations(english, spanish);
  }

  ngOnChanges(changes: SimpleChanges): void {
    //Called before any other lifecycle hook. Use it to inject dependencies, but avoid any serious work here.
    //Add '${implements OnChanges}' to the class.
  }

  ngOnInit(): void {
    this.initMap();
    //this.initAutocomplete();
    console.log('NgOnInit123');
    this.bounds  = new google.maps.LatLngBounds();
    this.deviceLocationDataSubscription = this.devicesLocationService.getDevicesLocation(0, 400)
    .do(val => console.log('deviceLocationDataSubscription', val))
    .mergeMap(devicesLocation => Observable.from(devicesLocation.data.getDevicesLocation))
    .mergeMap((deviceLocation: any) => {
      return this.manageMarkers(deviceLocation);
    })
    .subscribe((data: any) => {
      if (!data[0].getMap()) {
        data[0].setMap(this.map);
        //this.addMarker(data[0]);
        const loc = new google.maps.LatLng(data[0].getPosition().lat(), data[0].getPosition().lng());
        this.bounds.extend(loc);
        this.addMarkerToMap(data[0]);
      } else {
        data[0].updateLocation(data[1].lng, data[1].lat, 1000);
      }},
      error => console.log(error),
      () => {
        this.map.fitBounds(this.bounds);
        this.map.panToBounds(this.bounds);
      }
    );

    this.deviceLocationSubscription = this.devicesLocationService
      .subscribeDeviceLocation()
      .do(val => console.log('deviceLocationSubscription', val))
      .mergeMap(deviceLocation => {
        return this.manageMarkers(deviceLocation.data.deviceLocationReportedEvent);
      })
      .subscribe(data => {
        //this.manageMarkers(deviceLocation.data.deviceLocationReportedEvent);
        if (!data[0].getMap()) {
          data[0].setMap(this.map);
          //this.addMarker(data[0]);
          this.addMarkerToMap(data[0]);
        } else {
          data[0].updateLocation(data[1].lng, data[1].lat, 1000);
        }
      });

    this.translate.onLangChange.subscribe(lang => {
      const translations = lang.translations.MARKER.INFOWINDOW;
      this.markers.forEach(m => {
        let originalContent = MarkerRefInfoWindowContent;
        let content = m.infoWindow.getContent();
        content = originalContent.toString().replace('{PLATE}', translations.PLATE).replace('{TITLE}', translations.TITLE).replace('{VEHICLE}', translations.VEHICLE);
        content = content.toString().replace('$plate', m.vehicle.plate);
        content = content.replace('$serial', '' + m.vehicle.serial);
        m.infoWindow.setContent(content);
      });
    });

  }

  initAutocomplete() {
    this.autoComplete = new google.maps.places.Autocomplete(this.input.nativeElement);

    this.autoComplete.bindTo('bounds', this.map);
    this.autoComplete.addListener('place_changed', () => {
      const place = this.autoComplete.getPlace();
      if (!place.geometry) {
        window.alert("No details available for input: '" + place.name + "'");
        return;
      }

      if (place.geometry.viewport) {
        this.map.fitBounds(place.geometry.viewport);
      } else {
        this.map.setCenter(place.geometry.location);
        this.map.setZoom(17);  // Why 17? Because it looks good.
      }

      const marker = new MarkerRef(null, {
        position: { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() },
        map: this.map
      });
      let infoWindowContent = marker.infoWindow.getContent();

      marker.vehicle.plate = this.getRandomNumber(3);
      marker.vehicle.serial = this.getRandomNumber(4);
      infoWindowContent = infoWindowContent.toString().replace('$plate', marker.vehicle.plate);
      infoWindowContent = infoWindowContent.toString().replace('$serial', '' + marker.vehicle.serial);
      marker.infoWindow.setContent(infoWindowContent);
      this.addMarkerToMap(marker);
    });
  }

  manageMarkers(deviceLocation): Observable<[MarkerRef,any]> {
    console.log('manageMarkers');
    return Observable.from(this.markers)
      .do(marker => console.log('Marker ==> ', marker))
      .filter(marker => {
        return marker.vehicle.serial == deviceLocation.id;
      })
      .defaultIfEmpty(
        new MarkerRef(

          { plate: deviceLocation.hostname, serial: deviceLocation.id},
          {
          position: {
            lat: parseFloat(deviceLocation.lat),
            lng: parseFloat(deviceLocation.lng)
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

  initMap() {
    const mapOptions = {
      center: new google.maps.LatLng(6.1701312, -75.6058417),
      zoom: 14,
      mapTypeId: google.maps.MapTypeId.ROADMAP
    };

    this.map = new MapRef(this.gmapElement.nativeElement, mapOptions);
  }

  addMarker(marker: MarkerRef) {
    this.updateMarkerInfoContent(marker)
      .subscribe(marker => {
        this.addMarkerToMap(marker);
      });

    //         infoWindowContent =  infoWindowContent.toString().replace('$plate', this.translate.get('MARKER.INFOWINDOW.PLATE'). );
    //         infoWindowContent = infoWindowContent.toString().replace('$serial', deviceLocation.id );

    // let infoWindowContent = marker.infoWindow.getContent();
  }


  updateMarkerInfoContent(marker: MarkerRef) {
    return Rx.Observable.forkJoin(
      Rx.Observable.of(marker),
      this.translate.get('MARKER.INFOWINDOW.TITLE'),
      this.translate.get('MARKER.INFOWINDOW.PLATE'),
      this.translate.get('MARKER.INFOWINDOW.VEHICLE')
    )
      .map(([marker, title, plate, vehicle]) => {
        console.log("updateMarkerInfoContent ", plate, vehicle, marker);
        let infoWindowContent = MarkerRefInfoWindowContent;
        infoWindowContent = infoWindowContent.toString().replace('{TITLE}', title);
        infoWindowContent = infoWindowContent.toString().replace('{PLATE}', plate);
        infoWindowContent = infoWindowContent.toString().replace('{VEHICLE}', vehicle);
        infoWindowContent = infoWindowContent.toString().replace('$plate', marker.vehicle.plate);
        infoWindowContent = infoWindowContent.toString().replace('$serial', marker.vehicle.serial);
        marker.infoWindow.setContent(infoWindowContent);
        return marker;
      })
  }

  addMarkerToMap(marker: MarkerRef) {
    marker.inizialiteEvents();
    marker.dragendEvent.subscribe((event: google.maps.MouseEvent) => {
      this.onMarkerDragEnd(marker, event);
    });
    marker.clickEvent.subscribe(event => {
      this.onMarkerClick(marker, event);
    });
    marker.position_changedEvent.subscribe(event => {
      this.positionMarkerChangedEvent(marker, event);
    });

    this.markers.push(marker);
  }

  // event over Marker
  onMarkerDragEnd(marker: MarkerRef, event: google.maps.MouseEvent) {
  }

  onMarkerClick(marker: MarkerRef, event) {
    this.markers.forEach(m => {
      m.infoWindow.close();
    });
    marker.infoWindow.open(this.map, marker);
  }

  positionMarkerChangedEvent(marker: MarkerRef, event) {
  }

  getRandomNumber(length: number) {
    let i = 0;
    let result = '';
    while (i < length) {
      result = result + Math.floor((Math.random() * 10)).toString();
      i++;
    }
    return result;
  }

  ngOnDestroy(): void {
    if(this.deviceLocationSubscription){
      this.deviceLocationSubscription.unsubscribe();
    }

    if(this.deviceLocationDataSubscription){
      this.deviceLocationDataSubscription.unsubscribe();
    }
  }
}
