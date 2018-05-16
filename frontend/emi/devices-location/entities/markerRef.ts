// tslint:disable-next-line:import-blacklist
import * as Rx from 'rxjs/Rx';
import {} from 'googlemaps';

export class Vehicle{
    plate: '';
    serial: ''
}

export class MarkerRef extends google.maps.Marker {

  animation_changedEvent = new  Rx.Subject();
  clickEvent = new Rx.Subject <google.maps.MouseEvent>();
  clickable_changedEvent = new  Rx.Subject();
  cursor_changedEvent = new  Rx.Subject();
  dblclickEvent = new  Rx.Subject();
  dragEvent = new  Rx.Subject();
  dragendEvent = new  Rx.Subject();
  draggable_changedEvent = new  Rx.Subject();
  dragstartEvent = new  Rx.Subject();
  flat_changedEvent = new  Rx.Subject();
  icon_changedEvent = new  Rx.Subject();
  mousedownEvent = new  Rx.Subject();
  mouseoutEvent = new  Rx.Subject();
  mouseoverEvent = new  Rx.Subject();
  mouseupEvent = new  Rx.Subject();
  position_changedEvent = new  Rx.Subject();
  rightclickEvent = new  Rx.Subject();
  shape_changedEvent = new  Rx.Subject();
  title_changedEvent = new  Rx.Subject();
  visible_changedEvent = new  Rx.Subject();
  zindex_changedEvent = new  Rx.Subject();


  contentString = '<div> <h2>Detalles del vehículo</h2>' +
  '<p> <strong>Placa: </strong>$plate</p>' +
  '<p> <strong>Vehículo: </strong>$serial</p>' +
  '</div>';

  titleString = '<h2>Detalles del vehículo</h2>' +
  '<p> <strong>Placa: </strong>$plate</p>' +
  '<p> <strong>Vehículo: </strong>$serial</p>';

  infoWindow =  new google.maps.InfoWindow({
    content: this.contentString
  });
  // vehicle = {
  //   plate: '',
  //   serial: ''
  // };

  vehicle = null;

  lastTimeLocationReported = null;

  index = 0;

  deltaLat = 0;

  deltaLng = 0;

  numDeltas = 80;

  delay = 10;


  constructor(vehicle: Vehicle, opts?: google.maps.MarkerOptions) {
    super(opts);
    this.setClickable(true);
    this.setLabel('');
    this.setTitle('TPM Medellín');
    //this.setDraggable(false);
    this.setIcon('./assets/devices-location/tpm_bus_30_30.png');
    this.vehicle = vehicle;
    this.lastTimeLocationReported = 0;
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

  updateLocation(lng: number, lat: number, delay: number, lastTimeLocationReported: number){
    console.log('Update location -> '+ lng + " -- "+ lat + " - Timestamp: " + lastTimeLocationReported);
    this.setVisibility(100);
    this.lastTimeLocationReported = lastTimeLocationReported;
    this.index = 0;
    this.deltaLat = (lat - this.getPosition().lat())/this.numDeltas;
    this.deltaLng = (lng - this.getPosition().lng())/this.numDeltas;

    this.moveMarker();
}

  moveMarker(){
    // console.log('Moving marker');
    const lat = this.getPosition().lat() + this.deltaLat;
    const lng = this.getPosition().lng() + this.deltaLng;
    this.setPosition(
      new google.maps.LatLng(lat,lng)
    );

    if(this.index != this.numDeltas){
        this.index++;
        setTimeout(this.moveMarker.bind(this), this.delay);
    }
  }

  setVisibility(visibility: number): void {
    this.setOpacity(visibility / 100);
  }

  setTitleMarker(title: string): void {
    this.setTitle(title);
  }

  inizialiteEvents(){
    this.addListener('click', (e: google.maps.MouseEvent) => { this.clickEvent.next(e); });
    this.addListener('dblclick', (e) => { this.dblclickEvent.next(e); });
    //this.addListener('dragend', (e) => { this.dragendEvent.next(e); });
    // this.addListener('position_changed', (e) => { this.position_changedEvent.next(e); });
  }

}

export const MarkerRefInfoWindowContent = '<div> <h2>{TITLE}</h2>' +
'<p> <strong>{PLATE}: </strong>$plate</p>' +
'<p> <strong>{VEHICLE}: </strong>$serial</p>' +
'</div>';

export const MarkerRefTitleContent =
'{PLATE}: $plate, ' +
'{VEHICLE}: $serial';