import { MapRef } from './entities/agmMapRef';
import { MarkerRef } from './entities/markerRef';
import {
  Component,
  ElementRef,
  NgZone,
  OnInit,
  ViewChild
} from '@angular/core';
import {} from 'googlemaps';
import { FormControl } from '@angular/forms';
// tslint:disable-next-line:import-blacklist
import * as Rx from 'rxjs/Rx';
@Component({
  selector: 'devices-location',
  templateUrl: './devices-location.component.html',
  styleUrls: ['./devices-location.component.scss']
})
export class DevicesLocationComponent implements OnInit {
  mapTypes = [
    google.maps.MapTypeId.HYBRID,
    google.maps.MapTypeId.ROADMAP,
    google.maps.MapTypeId.SATELLITE,
    google.maps.MapTypeId.TERRAIN
  ];

  timer = Rx.Observable.interval(3000);
  @ViewChild('gmap') gmapElement: any;
  map: MapRef;

  markers: MarkerRef[] = [];

  constructor() {}

  ngOnInit(): void {
    const mapOpt = {
      center: new google.maps.LatLng(6.1701312, -75.6058417),
      zoom: 18,
      mapTypeId: google.maps.MapTypeId.ROADMAP
    };
      this.map = new MapRef(this.gmapElement.nativeElement, mapOpt);
    const timerSubscription = this.timer.subscribe(t => {
      const lat = 6.17 + Math.random() / 50 + 2 / 500;
      const lng = -75.60 + Math.random() / 50 + 2 / 500;

      const marker = new MarkerRef({
        position: {lat: lat, lng: lng},
        map: this.map
      });
      this.addMarkerToMap(marker);

      console.log('MARKERS ==> ' + this.markers.length);
      if (t >= 3) {


        // Rx.Observable.interval(4000).subscribe( (turn) => {
        //   const pos = turn % 4;
        //   console.log('moviente intem --> ' + pos );
        //   this.markers[pos].updateLocation(
        //     -75.60 + Math.random() / 50 + 2 / 500,
        //      6.17 + Math.random() / 50 + 2 / 500,
        //      1000 );
        // });

        timerSubscription.unsubscribe(); }

    });
  }

  addMarkerToMap(marker: MarkerRef){
    marker.inizialiteEvents();
    marker.dragendEvent.subscribe((event: google.maps.MouseEvent) => { this.onMarkerDragEnd(marker, event); });
    marker.clickEvent.subscribe(event => { this.onMarkerClick(marker, event); } );
    marker.position_changedEvent.subscribe(event => { this.positionMarkerChangedEvent(marker, event); });
    this.markers.push(marker);
  }



   // event over Marker
   onMarkerDragEnd(marker: MarkerRef, event: google.maps.MouseEvent){
      console.log('Marker moved... ');
      console.log(marker.getPosition().lat());
      console.log(marker.getPosition().lng());
   }

   onMarkerClick(marker: MarkerRef, event){
     console.log('Click on Marker...');
     marker.updateLocation(-75.59703077796905, 6.174571880991593, 2000);
     marker.infoWindow.open(this.map, marker);

   }

   positionMarkerChangedEvent(marker: MarkerRef, event){
     console.log('positionMarkerChangedEvent ', event);
   }

}
