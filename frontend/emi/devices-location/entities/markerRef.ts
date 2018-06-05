// tslint:disable-next-line:import-blacklist
import * as Rx from 'rxjs/Rx';
import { } from 'googlemaps';
import { MapRef } from "./agmMapRef";

export class Vehicle {
  plate: '';
  serial: '';
  groupName: '';
  lastLocationTimestamp: undefined;
  cpuUsageAlarmActivated: false;
  ramUsageAlarmActivated: false;
  sdUsageAlarmActivated: false;
  temperatureAlarmActivated: false;
  online: false;
}


export class LocationPath {
  lat: number;
  lng: number;
  timestamp: number;
}

export class MarkerRef extends google.maps.Marker {

  animation_changedEvent = new Rx.Subject();
  clickEvent = new Rx.Subject<google.maps.MouseEvent>();
  clickable_changedEvent = new Rx.Subject();
  cursor_changedEvent = new Rx.Subject();
  dblclickEvent = new Rx.Subject();
  dragEvent = new Rx.Subject();
  dragendEvent = new Rx.Subject();
  draggable_changedEvent = new Rx.Subject();
  dragstartEvent = new Rx.Subject();
  flat_changedEvent = new Rx.Subject();
  icon_changedEvent = new Rx.Subject();
  mousedownEvent = new Rx.Subject();
  mouseoutEvent = new Rx.Subject();
  mouseoverEvent = new Rx.Subject();
  mouseupEvent = new Rx.Subject();
  position_changedEvent = new Rx.Subject();
  rightclickEvent = new Rx.Subject();
  shape_changedEvent = new Rx.Subject();
  title_changedEvent = new Rx.Subject();
  visible_changedEvent = new Rx.Subject();
  zindex_changedEvent = new Rx.Subject();


  contentString = '<div> <h2>Detalles del vehículo</h2>' +
    '<p> <strong>Placa: </strong>$plate</p>' +
    '<p> <strong>Vehículo: </strong>$serial</p>' +
    '</div>';

  titleString = '<h2>Detalles del vehículo</h2>' +
    '<p> <strong>Placa: </strong>$plate</p>' +
    '<p> <strong>Vehículo: </strong>$serial</p>';

  infoWindow = new google.maps.InfoWindow({
    content: this.contentString
  });

  /**
   * Historical route path of the vehicle
   */
  routePath: google.maps.Polyline;

  vehicle = null;

  lastTimeLocationReported = null;

  index = 0;

  deltaLat = 0;

  deltaLng = 0;

  lastLat = 0;

  lastLng = 0;

  numDeltas = 80;

  delay = 10;

  allMap: MapRef;


  constructor(vehicle: Vehicle, opts?: google.maps.MarkerOptions) {
    super(opts);
    // const icon = {
    //   url: "./assets/devices-location/bus.svg",
    //   anchor: new google.maps.Point(30, 30),
    //   scaledSize: new google.maps.Size(30, 30)
    // };
    this.setClickable(true);
    this.setLabel('');
    this.setTitle('D-HUB');
    //this.setDraggable(false);
    //this.setIcon('./assets/devices-location/tpm_bus_30_30.png');
    // this.setIcon(icon);
    this.vehicle = vehicle;
    this.lastTimeLocationReported = 0;
    this.updateIcon();
  }

  /**
   * Updates the marker icon according to the vehicle states (Online, Alarmed, Offline)
   */
  updateIcon() {
    console.log('****** UPDATE ICON ****** ', JSON.stringify(this.vehicle));

    let iconUrl = "./assets/devices-location/busOnline.svg";
    if ((this.vehicle.ramUsageAlarmActivated
      || this.vehicle.sdUsageAlarmActivated
      || this.vehicle.cpuUsageAlarmActivated
      || this.vehicle.temperatureAlarmActivated) && this.vehicle.online) {
      iconUrl = "./assets/devices-location/busAlarmed.svg";
    } else if (this.vehicle.online) {
      iconUrl = "./assets/devices-location/busOnline.svg";
    } else {
      iconUrl = "./assets/devices-location/busOffline.svg";
    }

    //iconUrl = "./assets/devices-location/location-icon.svg";

    const icon = {
      url: iconUrl,
      anchor: new google.maps.Point(30, 30),
      scaledSize: new google.maps.Size(30, 30)
    };
    this.setIcon(icon);
  }

  // updateLocation1(lng: number, lat: number, delay: number, lastTimeLocationReported: number): void {
  //   console.log('Update location -> '+ lng + " -- "+ lat + " - Timestamp: " + lastTimeLocationReported);
  //   // X refer to logitude
  //   // Y refer to latitude
  //   this.setVisibility(100);
  //   this.lastTimeLocationReported = lastTimeLocationReported;
  //   const currentLng = this.getPosition().lng();
  //   const currentLat = this.getPosition().lat();
  //   const updateDelay = 5;
  //   const vx = (lng - currentLng) / delay;
  //   const vy = (lat - currentLat) / delay;
  //   const timer = Rx.Observable.interval(updateDelay);
  //   const maximunSteps = delay / updateDelay;
  //   let steps = 0;
  //   const subcription = timer.subscribe(() => {
  //     this.setPosition(
  //       new google.maps.LatLng(
  //         this.getPosition().lat() + vy * updateDelay,
  //         this.getPosition().lng() + vx * updateDelay
  //       )
  //     );
  //     steps++;
  //     const distance = this.distanceBetweenTwoPoints(
  //       this.getPosition().lng(), lng,
  //       this.getPosition().lat(), lat
  //     );
  //     if (steps >= maximunSteps || distance < 0.00001) {
  //       subcription.unsubscribe();
  //     }
  //   });
  // }

  // distanceBetweenTwoPoints(x1, y1, x2, y2) {
  //   return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  // }

  /**
   *
   * @param lng
   * @param lat
   * @param delay
   * @param lastTimeLocationReported
   * @param vehicle
   */
  updateData(lng: number, lat: number, delay: number, lastTimeLocationReported: number, ramUsageAlarmActivated: Boolean,
    sdUsageAlarmActivated: Boolean, cpuUsageAlarmActivated: Boolean, temperatureAlarmActivated: Boolean, online: Boolean, center = false) {
    console.log('Update location -> ' + lng + " -- " + lat + " - Timestamp: " + lastTimeLocationReported);
    this.setVisibility(100);
    this.lastTimeLocationReported = lastTimeLocationReported;
    this.index = 0;

    this.deltaLat = (lat - this.getPosition().lat()) / this.numDeltas;
    this.deltaLng = (lng - this.getPosition().lng()) / this.numDeltas;
    this.lastLat = lat;
    this.lastLng = lng;

    this.vehicle.ramUsageAlarmActivated = ramUsageAlarmActivated;

    this.vehicle.sdUsageAlarmActivated = sdUsageAlarmActivated;

    this.vehicle.cpuUsageAlarmActivated = cpuUsageAlarmActivated;

    this.vehicle.temperatureAlarmActivated = temperatureAlarmActivated;

    this.vehicle.online = online;

    this.updateIcon();
    this.moveMarker(center);
  }

  putMap(map: MapRef){
    this.allMap = map;
  }

  /**
   * Updates the location path of the marker (polyline)
   * @param locationPath
   */
  updateRoutePath(map, locationPath?: [LocationPath]) {
    console.log('updateRoutePath ', locationPath);
    if (!locationPath) {
      return;
    }
    let routePathCoordinates = [];

    for (let i = 0; i < locationPath.length; i++) {
      routePathCoordinates.push({ lat: locationPath[i].lat, lng: locationPath[i].lng });
    }

    if (this.routePath) {
      this.routePath.setMap(null);
    }

    this.routePath = new google.maps.Polyline({
      path: routePathCoordinates,
      geodesic: true,
      strokeColor: '#FF0000',
      strokeOpacity: 1.0,
      strokeWeight: 2
    });

    this.routePath.setMap(map);
  }

  moveMarker(center = false) {
    const lat = this.getPosition().lat() + this.deltaLat;
    const lng = this.getPosition().lng() + this.deltaLng;
    this.setPosition(
      new google.maps.LatLng(lat, lng)
    );

    if(this.allMap){
      this.allMap.setCenter(this.getPosition());
    }
    
    console.log('Moving marker ==> ', lat, lng);

    if (this.index != this.numDeltas) {
      this.index++;
      setTimeout(this.moveMarker.bind(this), this.delay);
    } else {
      const lat = this.lastLat;
      const lng = this.lastLng;
      this.setPosition(
        new google.maps.LatLng(lat, lng)
      );
      if(this.allMap){
        this.allMap.setCenter(this.getPosition());
      }
    }    
  }

  setVisibility(visibility: number): void {
    this.setOpacity(visibility / 100);
  }

  setTitleMarker(title: string): void {
    this.setTitle(title);
  }

  inizialiteEvents() {
    this.addListener('click', (e: google.maps.MouseEvent) => { this.clickEvent.next(e); });
    this.addListener('dblclick', (e) => { this.dblclickEvent.next(e); });
    //this.addListener('dragend', (e) => { this.dragendEvent.next(e); });
    // this.addListener('position_changed', (e) => { this.position_changedEvent.next(e); });
  }
}

export const MarkerRefInfoWindowContent = '<div> <h2>{TITLE}</h2>' +
  '<p> <strong>{PLATE}: </strong>$plate</p>' +
  '<p> <strong>{VEHICLE}: </strong>$serial</p>' +
  '<p> <strong>{GROUPNAME}: </strong>$groupName</p>' +
  '<p align="right"> $lastLocationTimestamp </p>' +
  '<p align="right"> <strong> {LAST_LOCATION_TIMESTAMP} </strong> </p>' +
  '<input type="button" name="Edit" value="Ver más ..." onclick="window.angularComponentReference.zone.run(() => {window.angularComponentReference.componentFn(\'test\');});">' +
  //'">'+
  '</div>';

export const MarkerRefTitleContent =
  '{PLATE}: $plate, ' +
  '{VEHICLE}: $serial';
