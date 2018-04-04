import { MapRef } from "./entities/agmMapRef";
import { MarkerRef, MarkerRefInfoWindowContent } from "./entities/markerRef";
import {
  Component,
  OnInit,
  ViewChild,
  OnDestroy,
  ElementRef
} from "@angular/core";
import {} from "googlemaps";
import { FormControl } from "@angular/forms";
// tslint:disable-next-line:import-blacklist
import * as Rx from "rxjs/Rx";
import { locale as english } from './i18n/en';
import { locale as spanish } from './i18n/es';
import { FuseTranslationLoaderService } from "../../../core/services/translation-loader.service";
import { TranslateService } from "@ngx-translate/core";
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
  timer = Rx.Observable.interval(3000);
  timerSubscription: Rx.Subscription;
  @ViewChild("gmap") gmapElement: any;
  @ViewChild('input') input: ElementRef;
  map: MapRef;

  markers: MarkerRef[] = [];

  constructor( private translationLoader: FuseTranslationLoaderService,
    private translate: TranslateService){
    this.translationLoader.loadTranslations(english, spanish);
  }

  ngOnInit(): void {
    this.initMap();
    this.initAutocomplete();
    this.timerSubscription = this.timer.subscribe(t => {
      const lat = 6.1701312 + Math.random() / 50 + 2 / 900;
      const lng = -75.6058417 + Math.random() / 50 + 2 / 900;

      const marker = new MarkerRef({
        position: { lat: lat, lng: lng },
        map: this.map
      });
      let infoWindowContent = marker.infoWindow.getContent();

      marker.vehicle.plate = this.getRandomNumber(3);
      marker.vehicle.serial = this.getRandomNumber(4);
      infoWindowContent =  infoWindowContent.toString().replace('$plate', 'TMP' + marker.vehicle.plate );
      infoWindowContent = infoWindowContent.toString().replace('$serial', '' + marker.vehicle.serial );
      marker.infoWindow.setContent(infoWindowContent);
      this.addMarkerToMap(marker);

      if (t >= 3) {

        Rx.Observable.interval(4000).subscribe( (turn) => {
          const pos = turn % this.markers.length;
          this.markers[pos].updateLocation(
            -75.60 + Math.random() / 50 + 2 / 500,
             6.17 + Math.random() / 50 + 2 / 500,
             1000 );
        });

        this.timerSubscription.unsubscribe();
      }
    });

    this.translate.onLangChange.subscribe(lang => {
      const translations = lang.translations.MARKER.INFOWINDOW;
      this.markers.forEach(m => {
        let originalContent = MarkerRefInfoWindowContent;
        let content =  m.infoWindow.getContent();
        content = originalContent.toString().replace('{PLATE}', translations.PLATE).replace('{TITLE}', translations.TITLE).replace('{VEHICLE}', translations.VEHICLE);
        content = content.toString().replace('$plate', 'TMP' + m.vehicle.plate );
        content = content.replace('$serial', '' + m.vehicle.serial);
        m.infoWindow.setContent(content);
      });
    });

  }

  ngOnDestroy(): void {

  }

  initAutocomplete(){
    this.autoComplete = new google.maps.places.Autocomplete(this.input.nativeElement);

    this.autoComplete.bindTo('bounds', this.map);
    this.autoComplete.addListener('place_changed', () => {
      const place = this.autoComplete.getPlace();
      if (!place.geometry){
        window.alert("No details available for input: '" + place.name + "'");
        return;
      }

      if (place.geometry.viewport) {
        this.map.fitBounds(place.geometry.viewport);
      } else {
        this.map.setCenter(place.geometry.location);
        this.map.setZoom(17);  // Why 17? Because it looks good.
      }

      const marker = new MarkerRef({
        position: { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() },
        map: this.map
      });
      let infoWindowContent = marker.infoWindow.getContent();

      marker.vehicle.plate = this.getRandomNumber(3);
      marker.vehicle.serial = this.getRandomNumber(4);
      infoWindowContent =  infoWindowContent.toString().replace('$plate', 'TMP' + marker.vehicle.plate );
      infoWindowContent = infoWindowContent.toString().replace('$serial', '' + marker.vehicle.serial );
      marker.infoWindow.setContent(infoWindowContent);
      this.addMarkerToMap(marker);
    });
  }
  initMap(){
    const mapOptions = {
      center: new google.maps.LatLng(6.1701312, -75.6058417),
      zoom: 14,
      mapTypeId: google.maps.MapTypeId.ROADMAP
    };

    this.map = new MapRef(this.gmapElement.nativeElement, mapOptions);
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

  getRandomNumber(length: number){
    let i = 0;
    let result = '';
    while( i < length){
      result = result + Math.floor((Math.random() * 10)).toString();
      i++;
    }
    return result;
  }
}
